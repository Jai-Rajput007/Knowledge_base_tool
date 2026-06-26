"""Wake word training API endpoints."""

import asyncio
import os
import pathlib
import shutil
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.db.database import get_db
from app.models.wakeword_job import WakewordJob, WakewordJobStatus
from app.services.wakeword import negatives as neg_gen
from app.services.wakeword import kaggle_trainer as kaggle
from app.services.wakeword import agx_trainer as agx

router = APIRouter()

QUALITY_PRESETS = {
    "draft":      {"steps": 30000,  "n_samples": 5000,  "label": "Draft (~1.5 hrs)"},
    "standard":   {"steps": 50000,  "n_samples": 10000, "label": "Standard (~2.5 hrs)"},
    "production": {"steps": 100000, "n_samples": 25000, "label": "Production (~4.5 hrs)"},
}


def _check_kaggle_config():
    """Raise if Kaggle credentials are not set."""
    if not settings.KAGGLE_USERNAME or not settings.KAGGLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Kaggle credentials not configured. Set KAGGLE_USERNAME and KAGGLE_KEY in .env"
        )
    if not settings.KAGGLE_KERNEL_NAME or not settings.KAGGLE_CONFIG_DATASET:
        raise HTTPException(
            status_code=503,
            detail="Set KAGGLE_KERNEL_NAME and KAGGLE_CONFIG_DATASET in .env"
        )


def _active_job(db: Session) -> Optional[WakewordJob]:
    """Return any currently running or queued job."""
    return db.query(WakewordJob).filter(
        WakewordJob.status.in_([
            WakewordJobStatus.QUEUED,
            WakewordJobStatus.UPLOADING,
            WakewordJobStatus.RUNNING,
            WakewordJobStatus.DOWNLOADING,
        ])
    ).first()


# ─── POST /wakeword/train ─────────────────────────────────────────────────

@router.post("/train")
async def start_training(
    wake_phrase: str            = Form(..., description="e.g. 'hey jai'"),
    quality:     str            = Form("standard", description="draft / standard / production"),
    samples:     List[UploadFile] = File(default=[], description="WAV recordings of the wake phrase"),
    db: Session                 = Depends(get_db),
):
    """
    Start a wake word training job.

    Backend is determined by WAKEWORD_BACKEND in .env:
      local_agx → trains on the robot's AGX GPU (robot_sync.py must be running on AGX)
      kaggle    → trains on Kaggle free cloud GPU

    Switch backend by changing WAKEWORD_BACKEND in .env and restarting the server.
    No code changes needed.
    """
    backend = settings.WAKEWORD_BACKEND  # "local_agx" | "kaggle"

    # Validate backend config upfront
    if backend == "kaggle":
        _check_kaggle_config()
    elif backend == "local_agx":
        robot_ip = settings.WAKEWORD_AGX_IP
        if not robot_ip:
            raise HTTPException(
                status_code=503,
                detail="WAKEWORD_AGX_IP not set in .env — needed for local_agx backend"
            )
        if not agx.check_reachable(robot_ip):
            raise HTTPException(
                status_code=503,
                detail=f"Cannot reach AGX at {robot_ip}:9000 — is robot_sync.py running on the robot?"
            )
        maint = agx.get_maintenance_status(robot_ip)
        if not maint.get("maintenance_mode"):
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Robot at {robot_ip} is NOT in maintenance mode. "
                    f"Call POST /wakeword/robot/{robot_ip}/maintenance/start first "
                    f"to stop the NLP pipeline and free the GPU."
                )
            )
    else:
        raise HTTPException(status_code=400,
                            detail=f"Unknown WAKEWORD_BACKEND '{backend}'. Must be 'kaggle' or 'local_agx'")

    # Block if another job is already active
    active = _active_job(db)
    if active:
        raise HTTPException(
            status_code=409,
            detail=f"Job #{active.id} ('{active.wake_phrase}') is already {active.status}. "
                   f"Cancel it first or wait for it to finish."
        )

    if quality not in QUALITY_PRESETS:
        raise HTTPException(status_code=400,
                            detail=f"quality must be one of: {list(QUALITY_PRESETS)}")

    phrase     = wake_phrase.lower().strip()
    model_name = phrase.replace(" ", "_").replace("-", "_")
    preset     = QUALITY_PRESETS[quality]

    # Save uploaded samples locally
    sample_dir = pathlib.Path(settings.WAKEWORD_SAMPLES_DIR) / model_name
    sample_dir.mkdir(parents=True, exist_ok=True)

    sample_files = []   # (filename, bytes) — used by AGX backend
    saved = 0
    for upload in samples:
        if not upload.filename.lower().endswith((".wav", ".mp3", ".m4a")):
            continue
        content = await upload.read()
        dest = sample_dir / f"sample_{saved:04d}_{upload.filename}"
        dest.write_bytes(content)
        sample_files.append((upload.filename, content))
        saved += 1

    logger.info(f"Saved {saved} sample(s) for '{phrase}' (backend={backend})")

    negative_phrases = neg_gen.generate(phrase, count=60)

    # Create job record
    job = WakewordJob(
        wake_phrase      = phrase,
        model_name       = model_name,
        backend          = backend,
        robot_ip         = settings.WAKEWORD_AGX_IP if backend == "local_agx" else None,
        quality          = quality,
        steps            = preset["steps"],
        n_samples        = preset["n_samples"],
        sample_count     = saved,
        sample_dir       = str(sample_dir) if saved > 0 else None,
        negative_phrases = negative_phrases,
        kaggle_kernel    = (f"{settings.KAGGLE_USERNAME}/{settings.KAGGLE_KERNEL_NAME}"
                            if backend == "kaggle" else None),
        status           = WakewordJobStatus.UPLOADING,
        started_at       = datetime.utcnow(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Launch background task for the chosen backend
    if backend == "kaggle":
        asyncio.create_task(_run_training(
            job.id, phrase, model_name,
            preset["steps"], preset["n_samples"],
            negative_phrases,
            str(sample_dir) if saved > 0 else None
        ))
        est = {"draft": 90, "standard": 150, "production": 270}[quality]
        warning = None
    else:
        asyncio.create_task(_run_local_training(
            job.id, settings.WAKEWORD_AGX_IP, phrase, model_name,
            preset["steps"], preset["n_samples"],
            negative_phrases, sample_files
        ))
        est = {"draft": 150, "standard": 300, "production": 600}[quality]
        warning = "Robot is in maintenance mode and unavailable during training."

    response = {
        "job_id":           job.id,
        "wake_phrase":      phrase,
        "model_name":       model_name,
        "backend":          backend,
        "quality":          quality,
        "steps":            preset["steps"],
        "n_samples":        preset["n_samples"],
        "samples_uploaded": saved,
        "status":           job.status,
        "estimated_minutes": est,
        "message":          f"Training started on {backend}. Poll /wakeword/jobs/{job.id} for status.",
    }
    if warning:
        response["warning"] = warning
    return response


async def _run_training(job_id: int, wake_phrase: str, model_name: str,
                         steps: int, n_samples: int,
                         negative_phrases: list, sample_dir: Optional[str]):
    """Background task: upload config → push kernel → poll until done.
    Opens its own DB session — never reuse the request session here.
    """
    from app.db.database import SessionLocal

    def _update_job(**kwargs):
        with SessionLocal() as s:
            job = s.query(WakewordJob).filter(WakewordJob.id == job_id).first()
            if job:
                for k, v in kwargs.items():
                    setattr(job, k, v)
                s.commit()

    try:
        # Step 1: Upload config dataset to Kaggle
        logger.info(f"Job {job_id}: uploading config dataset to Kaggle")
        await asyncio.to_thread(
            kaggle.push_config_dataset,
            job_id, wake_phrase, model_name, steps, n_samples,
            negative_phrases, sample_dir
        )

        # Step 2: Push training kernel
        logger.info(f"Job {job_id}: pushing training kernel")
        run_id = await asyncio.to_thread(kaggle.push_kernel, model_name)

        _update_job(status=WakewordJobStatus.RUNNING, kaggle_run_id=run_id)
        logger.info(f"Job {job_id}: kernel running (version {run_id})")

        # Step 3: Poll until done
        output_dir = pathlib.Path(settings.WAKEWORD_SAMPLES_DIR) / f"{model_name}_output"
        await kaggle.poll_until_done(job_id, model_name, str(output_dir))

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        _update_job(status=WakewordJobStatus.ERROR, error_message=str(e))


# ─── GET /wakeword/jobs ───────────────────────────────────────────────────

@router.get("/jobs")
def list_jobs(
    limit:  int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """List all wake word training jobs, newest first."""
    jobs  = (db.query(WakewordJob)
               .order_by(WakewordJob.created_at.desc())
               .offset(offset).limit(limit).all())
    total = db.query(WakewordJob).count()

    return {
        "total":  total,
        "jobs":   [j.to_dict() for j in jobs],
        "active": next((j.to_dict() for j in jobs
                        if j.status in (WakewordJobStatus.RUNNING,
                                        WakewordJobStatus.UPLOADING,
                                        WakewordJobStatus.QUEUED,
                                        WakewordJobStatus.DOWNLOADING)), None),
    }


# ─── GET /wakeword/jobs/{id} ─────────────────────────────────────────────

@router.get("/jobs/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    """Get status and details of a specific training job."""
    job = db.query(WakewordJob).filter(WakewordJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    data = job.to_dict()

    # Add human-readable progress label
    progress_map = {
        WakewordJobStatus.QUEUED:      "Waiting to start",
        WakewordJobStatus.UPLOADING:   "Uploading config to Kaggle...",
        WakewordJobStatus.RUNNING:     (f"Training on AGX GPU — poll /jobs/{job.id}/local-status for live progress"
                                          if job.backend == "local_agx"
                                          else "Training on Kaggle GPU (check kaggle_log_url for live logs)"),
        WakewordJobStatus.DOWNLOADING: "Downloading trained model...",
        WakewordJobStatus.READY:       "Ready to deploy",
        WakewordJobStatus.DEPLOYED:    "Deployed to robot",
        WakewordJobStatus.CANCELLED:   "Cancelled",
        WakewordJobStatus.ERROR:       f"Error: {job.error_message}",
    }
    data["progress_label"] = progress_map.get(job.status, job.status)
    return data


# ─── DELETE /wakeword/jobs/{id} ──────────────────────────────────────────

@router.delete("/jobs/{job_id}")
def cancel_job(job_id: int, db: Session = Depends(get_db)):
    """Cancel a running training job."""
    job = db.query(WakewordJob).filter(WakewordJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if job.status not in (WakewordJobStatus.RUNNING, WakewordJobStatus.UPLOADING,
                          WakewordJobStatus.QUEUED):
        raise HTTPException(
            status_code=400,
            detail=f"Job is {job.status}, cannot cancel"
        )

    # Send stop signal to Kaggle
    cancelled = kaggle.cancel_kernel()

    job.status = WakewordJobStatus.CANCELLED
    db.commit()

    return {
        "job_id":          job_id,
        "status":          "cancelled",
        "kaggle_stopped":  cancelled,
        "message":         "Kaggle kernel stop requested. May take a minute to reflect."
    }


# ─── POST /wakeword/jobs/{id}/deploy ─────────────────────────────────────

@router.post("/jobs/{job_id}/deploy")
def deploy_model(job_id: int, db: Session = Depends(get_db)):
    """
    Deploy a trained wake word model.
    Copies ONNX to the models directory and returns the config snippet
    to paste into app_config.json on the robot.
    """
    job = db.query(WakewordJob).filter(WakewordJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if job.status != WakewordJobStatus.READY:
        raise HTTPException(
            status_code=400,
            detail=f"Job is {job.status}. Only READY jobs can be deployed."
        )

    if not job.onnx_path or not pathlib.Path(job.onnx_path).exists():
        raise HTTPException(status_code=500, detail="ONNX file missing on disk")

    # Final model path (where humanoid_nlp expects it)
    deploy_path = pathlib.Path(settings.WAKEWORD_MODELS_DIR) / f"{job.model_name}.onnx"
    if str(deploy_path) != job.onnx_path:
        shutil.copy(job.onnx_path, deploy_path)

    job.status      = WakewordJobStatus.DEPLOYED
    job.deployed_at = datetime.utcnow()
    db.commit()

    # The snippet the user needs in app_config.json
    robot_config_snippet = {
        "wake_word": {
            "backend":   "livekit",
            "model":     f"models/{job.model_name}.onnx",
            "threshold": round(job.optimal_threshold or 0.90, 2),
        }
    }

    return {
        "job_id":        job_id,
        "status":        "deployed",
        "onnx_path":     str(deploy_path),
        "wake_phrase":   job.wake_phrase,
        "threshold":     job.optimal_threshold,
        "recall":        job.recall,
        "fpph":          job.fpph,
        "robot_config":  robot_config_snippet,
        "message":       (
            f"Copy {deploy_path} to your robot's models/ directory, "
            f"then update app_config.json with the robot_config snippet above."
        ),
    }


# ══════════════════════════════════════════════════════════════════════════
# LOCAL AGX TRAINING
# ══════════════════════════════════════════════════════════════════════════

@router.get("/robot/{robot_ip}/status")
def agx_status(robot_ip: str):
    """Check AGX robot reachability and maintenance status."""
    reachable = agx.check_reachable(robot_ip)
    if not reachable:
        raise HTTPException(status_code=503,
                            detail=f"Cannot reach robot at {robot_ip}:9000")
    return agx.get_maintenance_status(robot_ip)


@router.post("/robot/{robot_ip}/maintenance/start")
def agx_enter_maintenance(robot_ip: str):
    """
    Stop the NLP pipeline on AGX to free GPU for training.
    Always call this before starting local training.
    """
    if not agx.check_reachable(robot_ip):
        raise HTTPException(status_code=503,
                            detail=f"Cannot reach robot at {robot_ip}:9000")
    return agx.enter_maintenance(robot_ip)


@router.post("/robot/{robot_ip}/maintenance/stop")
def agx_exit_maintenance(robot_ip: str):
    """Resume normal robot operation after training."""
    if not agx.check_reachable(robot_ip):
        raise HTTPException(status_code=503,
                            detail=f"Cannot reach robot at {robot_ip}:9000")
    return agx.exit_maintenance(robot_ip)


async def _run_local_training(job_id: int, robot_ip: str, wake_phrase: str,
                               model_name: str, steps: int, n_samples: int,
                               negative_phrases: list, sample_files: list):
    """Background task: send training job to AGX, poll until done."""
    from app.db.database import SessionLocal

    def _update(**kwargs):
        with SessionLocal() as s:
            job = s.query(WakewordJob).filter(WakewordJob.id == job_id).first()
            if job:
                for k, v in kwargs.items():
                    setattr(job, k, v)
                s.commit()

    try:
        # Send to AGX
        result = await asyncio.to_thread(
            agx.start_training,
            robot_ip, wake_phrase, model_name, steps, n_samples,
            negative_phrases, sample_files
        )
        _update(status=WakewordJobStatus.RUNNING)
        logger.info(f"Local job {job_id}: training started on AGX (pid {result.get('pid')})")

        # Poll AGX every 60s
        while True:
            await asyncio.sleep(60)
            try:
                status_data = await asyncio.to_thread(agx.get_training_status, robot_ip)
            except Exception as e:
                logger.warning(f"Local job {job_id}: poll failed — {e}")
                continue

            agx_status = status_data.get("status", "unknown")
            logger.info(f"Local job {job_id}: AGX status = {agx_status} — {status_data.get('message')}")

            if agx_status == "complete":
                # Download ONNX from AGX
                _update(status=WakewordJobStatus.DOWNLOADING)
                onnx_dest = f"{settings.WAKEWORD_MODELS_DIR}/{model_name}.onnx"
                try:
                    onnx_path = await asyncio.to_thread(
                        agx.download_model, robot_ip, model_name, onnx_dest
                    )
                except Exception as e:
                    _update(status=WakewordJobStatus.ERROR,
                            error_message=f"ONNX download failed: {e}")
                    return

                _update(
                    status            = WakewordJobStatus.READY,
                    onnx_path         = onnx_path,
                    optimal_threshold = status_data.get("optimal_threshold"),
                    recall            = status_data.get("recall"),
                    fpph              = status_data.get("fpph"),
                    aut               = status_data.get("aut"),
                    completed_at      = datetime.utcnow(),
                )
                logger.info(f"Local job {job_id}: complete. ONNX at {onnx_path}")

                # Auto-exit maintenance mode
                try:
                    await asyncio.to_thread(agx.exit_maintenance, robot_ip)
                    logger.info(f"Local job {job_id}: maintenance mode ended, robot restarted")
                except Exception as e:
                    logger.warning(f"Could not exit maintenance mode automatically: {e}")
                return

            elif agx_status in ("error", "cancelled"):
                _update(
                    status        = (WakewordJobStatus.CANCELLED if agx_status == "cancelled"
                                     else WakewordJobStatus.ERROR),
                    error_message = status_data.get("message", agx_status),
                )
                # Also exit maintenance so robot recovers
                try:
                    await asyncio.to_thread(agx.exit_maintenance, robot_ip)
                except Exception:
                    pass
                return

    except Exception as e:
        logger.error(f"Local job {job_id} failed: {e}")
        _update(status=WakewordJobStatus.ERROR, error_message=str(e))


@router.get("/jobs/{job_id}/local-status")
def local_training_status(job_id: int, db: Session = Depends(get_db)):
    """Get live training status directly from AGX (detailed progress)."""
    job = db.query(WakewordJob).filter(WakewordJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    if job.backend != "local_agx":
        raise HTTPException(status_code=400, detail="This job used Kaggle, not local AGX")
    if not job.robot_ip:
        raise HTTPException(status_code=400, detail="No robot IP stored for this job")

    try:
        live = agx.get_training_status(job.robot_ip)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Cannot reach AGX: {e}")

    return {
        "job_id":        job_id,
        "db_status":     job.status,
        "agx_live":      live,
        "log_tail":      live.get("log_tail", []),
        "progress_pct":  round(live.get("step", 0) / max(live.get("total_steps", 1), 1) * 100),
    }


@router.delete("/jobs/{job_id}/local-cancel")
def cancel_local_training(job_id: int, db: Session = Depends(get_db)):
    """Cancel a running local AGX training job."""
    job = db.query(WakewordJob).filter(WakewordJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    if job.backend != "local_agx":
        raise HTTPException(status_code=400, detail="Use DELETE /jobs/{id} for Kaggle jobs")
    if job.status not in (WakewordJobStatus.RUNNING, WakewordJobStatus.UPLOADING):
        raise HTTPException(status_code=400, detail=f"Job is {job.status}, cannot cancel")

    try:
        agx.cancel_training(job.robot_ip)
    except Exception as e:
        logger.warning(f"AGX cancel failed: {e}")

    job.status = WakewordJobStatus.CANCELLED
    db.commit()

    # Try to restore robot
    try:
        agx.exit_maintenance(job.robot_ip)
    except Exception:
        pass

    return {"job_id": job_id, "status": "cancelled",
            "message": "Robot maintenance mode ended. NLP pipeline restarting."}


# ─── GET /wakeword/presets ────────────────────────────────────────────────

@router.get("/presets")
def list_presets():
    """Return available quality presets with estimated training times."""
    return {"presets": QUALITY_PRESETS}


# ─── POST /wakeword/jobs/{id}/sync ───────────────────────────────────────

@router.post("/jobs/{job_id}/sync")
def sync_job_status(job_id: int, db: Session = Depends(get_db)):
    """
    Force-sync job status from Kaggle (useful after server restart).
    If kernel is complete, downloads the ONNX immediately.
    """
    job = db.query(WakewordJob).filter(WakewordJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if job.status in (WakewordJobStatus.READY, WakewordJobStatus.DEPLOYED,
                      WakewordJobStatus.CANCELLED):
        return {"message": f"Job is already {job.status}, no sync needed",
                "status": job.status}

    _check_kaggle_config()
    result = kaggle.get_kernel_status()
    status = result["status"]

    from datetime import datetime
    if status == "running":
        job.status = WakewordJobStatus.RUNNING
        job.kaggle_log_url = result["log_url"]
        db.commit()

    elif status == "complete":
        job.status = WakewordJobStatus.DOWNLOADING
        db.commit()
        output_dir = pathlib.Path(settings.WAKEWORD_SAMPLES_DIR) / f"{job.model_name}_output"
        onnx_path  = kaggle.download_output(job.model_name, str(output_dir))
        metrics    = kaggle.parse_eval_metrics(job.model_name, str(output_dir))
        job.status            = WakewordJobStatus.READY if onnx_path else WakewordJobStatus.ERROR
        job.onnx_path         = onnx_path
        job.optimal_threshold = metrics.get("optimal_threshold")
        job.recall            = metrics.get("recall")
        job.fpph              = metrics.get("fpph")
        job.aut               = metrics.get("aut")
        job.completed_at      = datetime.utcnow()
        job.error_message     = None if onnx_path else "ONNX not found in output"
        db.commit()

    elif "cancel" in status or status == "error":
        job.status        = (WakewordJobStatus.CANCELLED if "cancel" in status
                             else WakewordJobStatus.ERROR)
        job.error_message = f"Kaggle kernel: {status}"
        db.commit()

    return job.to_dict()


# ─── GET /wakeword/kaggle-status ─────────────────────────────────────────

@router.get("/kaggle-status")
def kaggle_status():
    """Check live Kaggle kernel status directly (bypass DB)."""
    try:
        _check_kaggle_config()
        return kaggle.get_kernel_status()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
