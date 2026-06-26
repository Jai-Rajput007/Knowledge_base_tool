"""
Kaggle API wrapper for automated wake word training.

Flow:
  1. Write config.json + audio samples to a temp folder
  2. Push that folder as a new version of the config dataset on Kaggle
  3. Push the training kernel (creates a new version, Kaggle auto-runs it)
  4. Poll kernel status every 60s
  5. When complete → download ONNX output
  6. Parse eval metrics from output
"""

import asyncio
import json
import os
import pathlib
import shutil
import tempfile
import time
from typing import Optional

from app.core.config import settings
from app.core.logging import logger


QUALITY_PRESETS = {
    "draft":      {"steps": 30000,  "n_samples": 5000},
    "standard":   {"steps": 50000,  "n_samples": 10000},
    "production": {"steps": 100000, "n_samples": 25000},
}


def _get_api():
    """Return authenticated Kaggle API instance."""
    if settings.KAGGLE_USERNAME and settings.KAGGLE_KEY:
        # Legacy auth — used by KaggleApi basic-auth layer
        os.environ["KAGGLE_USERNAME"]  = settings.KAGGLE_USERNAME
        os.environ["KAGGLE_KEY"]       = settings.KAGGLE_KEY
        # New kagglesdk layer uses KAGGLE_API_TOKEN (Bearer) for actual API calls
        # The KGAT_ token from Kaggle settings is the right value here
        os.environ["KAGGLE_API_TOKEN"] = settings.KAGGLE_KEY

    from kaggle.api.kaggle_api_extended import KaggleApi
    api = KaggleApi()
    api.authenticate()
    return api


def _kaggle_kernel_id() -> str:
    return f"{settings.KAGGLE_USERNAME}/{settings.KAGGLE_KERNEL_NAME}"


def _kaggle_config_dataset_id() -> str:
    return f"{settings.KAGGLE_USERNAME}/{settings.KAGGLE_CONFIG_DATASET}"


# ─── Dataset (config carrier) ──────────────────────────────────────────────

def push_config_dataset(job_id: int, wake_phrase: str, model_name: str,
                         steps: int, n_samples: int,
                         negative_phrases: list, sample_dir: Optional[str]) -> None:
    """
    Upload config.json (+ audio samples) to Kaggle as a new dataset version.
    The training kernel reads from /kaggle/input/{dataset_name}/config.json
    """
    api = _get_api()

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)

        # Build config.json
        config = {
            "job_id":            job_id,
            "wake_phrase":       wake_phrase,
            "model_name":        model_name,
            "steps":             steps,
            "n_samples":         n_samples,
            "n_samples_val":     max(500, n_samples // 5),
            "aug_rounds":        3,
            "skip_acav":         True,
            "model_type":        "conv_attention",
            "model_size":        "medium",
            "negative_phrases":  negative_phrases,
        }
        (tmp / "config.json").write_text(json.dumps(config, indent=2))

        # Copy audio samples if provided
        if sample_dir and pathlib.Path(sample_dir).exists():
            samples_dest = tmp / "samples"
            samples_dest.mkdir()
            for wav in pathlib.Path(sample_dir).glob("*.wav"):
                shutil.copy(wav, samples_dest / wav.name)
            logger.info(f"Copied {len(list(samples_dest.glob('*.wav')))} samples to dataset")

        # Dataset metadata (needed for create, not for version update)
        dataset_meta = {
            "title":     settings.KAGGLE_CONFIG_DATASET,
            "id":        _kaggle_config_dataset_id(),
            "licenses":  [{"name": "other"}],
        }
        (tmp / "dataset-metadata.json").write_text(json.dumps(dataset_meta))

        # Try version update first; if dataset doesn't exist, create it
        try:
            api.dataset_create_version(
                folder=str(tmp),
                version_notes=f"job-{job_id} | {wake_phrase}",
                quiet=True,
                convert_to_csv=False,
                delete_old_versions=True,
            )
            logger.info(f"Config dataset updated for job {job_id}")
        except Exception as e:
            # Kaggle returns 403 or 404 when dataset does not exist yet
            if any(code in str(e) for code in ("403", "404", "NotFound", "Forbidden")):
                logger.info(f"Config dataset not found — creating new: {_kaggle_config_dataset_id()}")
                api.dataset_create_new(folder=str(tmp), public=False, quiet=True)
                logger.info(f"Config dataset created for job {job_id}")
            else:
                raise


# ─── Kernel ────────────────────────────────────────────────────────────────

def push_kernel(model_name: str) -> str:
    """
    Push a new version of the training kernel on Kaggle.
    Returns the kernel version number as a string.
    Kaggle auto-starts execution when a new version is pushed with GPU enabled.
    """
    api = _get_api()
    
    kernel_dir = pathlib.Path(__file__).parent.parent.parent.parent.parent / "kaggle_training"

    if not kernel_dir.exists():
        raise FileNotFoundError(f"Kaggle training dir not found: {kernel_dir}")

    # Update kernel-metadata.json with correct username and config dataset
    meta_path = kernel_dir / "kernel-metadata.json"
    meta = json.loads(meta_path.read_text())
    meta["id"] = _kaggle_kernel_id()
    extra = [d.strip() for d in settings.KAGGLE_EXTRA_DATASETS.split(",")
             if settings.KAGGLE_EXTRA_DATASETS and d.strip()]
    meta["dataset_sources"] = [_kaggle_config_dataset_id()] + extra
    meta_path.write_text(json.dumps(meta, indent=2))

    api.kernels_push(folder=str(kernel_dir))
    logger.info(f"Kernel pushed: {_kaggle_kernel_id()}")

    # Small wait then fetch the new version number
    time.sleep(5)
    status = api.kernels_status(kernel=_kaggle_kernel_id())
    return str(getattr(status, "currentRunningVersion", "unknown"))


# ─── Status polling ────────────────────────────────────────────────────────

def get_kernel_status(kernel_id: Optional[str] = None) -> dict:
    """
    Returns {'status': str, 'log_url': str}
    Normalises Kaggle statuses to lowercase: running, complete, error, cancelacknowledged
    """
    api = _get_api()
    kid = kernel_id or _kaggle_kernel_id()

    try:
        raw     = api.kernels_status(kernel=kid)
        d       = raw.to_dict() if hasattr(raw, "to_dict") else {"status": str(raw)}
        status  = d.get("status", "unknown").lower()
        log_url = f"https://www.kaggle.com/code/{kid}"
        return {"status": status, "log_url": log_url}
    except Exception as e:
        logger.error(f"Kaggle status check failed: {e}")
        return {"status": "error", "log_url": ""}


# ─── Download output ───────────────────────────────────────────────────────

def download_output(model_name: str, dest_dir: str) -> Optional[str]:
    """
    Download kernel output and extract the ONNX model.
    Returns local path to the ONNX file, or None on failure.
    """
    api = _get_api()
    dest = pathlib.Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)

    try:
        api.kernels_output(
            kernel=_kaggle_kernel_id(),
            path=str(dest),
            force=True,
            quiet=True,
        )
    except Exception as e:
        logger.error(f"Failed to download kernel output: {e}")
        return None

    # Find the ONNX file
    onnx_files = list(dest.rglob("*.onnx"))
    if not onnx_files:
        logger.error("No .onnx file found in kernel output")
        return None

    # Move to wakeword_models/ with clean name
    models_dir = pathlib.Path(settings.WAKEWORD_MODELS_DIR)
    models_dir.mkdir(parents=True, exist_ok=True)
    final_path = models_dir / f"{model_name}.onnx"
    shutil.copy(onnx_files[0], final_path)

    logger.info(f"ONNX saved to {final_path}")
    return str(final_path)


def parse_eval_metrics(model_name: str, output_dir: str) -> dict:
    """Read eval JSON from downloaded kernel output."""
    output_path = pathlib.Path(output_dir)

    # Kaggle downloads output as a zip; search for eval json
    for candidate in output_path.rglob("*_eval.json"):
        try:
            data = json.loads(candidate.read_text())
            return {
                "optimal_threshold": data.get("optimal_threshold"),
                "recall":            data.get("optimal_recall"),
                "fpph":              data.get("optimal_fpph"),
                "aut":               data.get("aut"),
            }
        except Exception:
            continue

    return {}


# ─── Cancel ────────────────────────────────────────────────────────────────

def cancel_kernel() -> bool:
    """Stop the currently running Kaggle kernel via CLI subprocess."""
    import subprocess
    try:
        result = subprocess.run(
            ["kaggle", "kernels", "cancel", _kaggle_kernel_id()],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            logger.info("Kaggle kernel cancel requested via CLI")
            return True
        logger.warning(f"Kaggle cancel returned non-zero: {result.stderr}")
        return False
    except Exception as e:
        logger.error(f"Failed to cancel kernel: {e}")
        return False


# ─── Async polling loop (runs as background task) ──────────────────────────

async def poll_until_done(job_id: int, model_name: str, output_dir: str) -> None:
    """
    Background coroutine: polls Kaggle every 60s until kernel finishes.
    Opens its own DB session each poll — never receives one from the caller.
    """
    from app.models.wakeword_job import WakewordJob, WakewordJobStatus
    from app.db.database import SessionLocal
    from datetime import datetime

    POLL_INTERVAL = 60  # seconds

    def _update(**kwargs):
        with SessionLocal() as s:
            job = s.query(WakewordJob).filter(WakewordJob.id == job_id).first()
            if job:
                for k, v in kwargs.items():
                    setattr(job, k, v)
                s.commit()

    while True:
        await asyncio.sleep(POLL_INTERVAL)

        result = get_kernel_status()
        status = result["status"]
        log_url = result["log_url"]

        logger.info(f"Job {job_id} Kaggle status: {status}")

        if status == "running":
            _update(status=WakewordJobStatus.RUNNING, kaggle_log_url=log_url)

        elif status == "complete":
            _update(status=WakewordJobStatus.DOWNLOADING)

            onnx_path = download_output(model_name, output_dir)
            metrics   = parse_eval_metrics(model_name, output_dir)

            _update(
                status            = WakewordJobStatus.READY if onnx_path else WakewordJobStatus.ERROR,
                onnx_path         = onnx_path,
                optimal_threshold = metrics.get("optimal_threshold"),
                recall            = metrics.get("recall"),
                fpph              = metrics.get("fpph"),
                aut               = metrics.get("aut"),
                completed_at      = datetime.utcnow(),
                error_message     = None if onnx_path else "ONNX file not found in kernel output",
            )
            logger.info(f"Job {job_id} complete. ONNX: {onnx_path}")
            return

        elif status in ("error", "cancelacknowledged", "cancel_acknowledged"):
            _update(
                status        = (WakewordJobStatus.CANCELLED
                                 if "cancel" in status
                                 else WakewordJobStatus.ERROR),
                error_message = f"Kaggle kernel ended with status: {status}",
            )
            logger.error(f"Job {job_id} ended with status: {status}")
            return
