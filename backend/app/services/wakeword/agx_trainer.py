"""
AGX trainer service — dashboard side.
Communicates with robot_sync.py on the AGX (port 9000).
"""

import json
from typing import Optional
import httpx

from app.core.logging import logger


def _agx_url(robot_local_ip: str, path: str) -> str:
    return f"http://{robot_local_ip}:9000{path}"


def check_reachable(robot_local_ip: str) -> bool:
    try:
        r = httpx.get(_agx_url(robot_local_ip, "/health"), timeout=5)
        return r.status_code == 200
    except Exception:
        return False


def get_maintenance_status(robot_local_ip: str) -> dict:
    r = httpx.get(_agx_url(robot_local_ip, "/maintenance/status"), timeout=10)
    r.raise_for_status()
    return r.json()


def enter_maintenance(robot_local_ip: str) -> dict:
    """Stop NLP pipeline on AGX, free GPU for training."""
    r = httpx.post(_agx_url(robot_local_ip, "/maintenance/start"), timeout=30)
    r.raise_for_status()
    return r.json()


def exit_maintenance(robot_local_ip: str) -> dict:
    """Restart NLP pipeline on AGX after training."""
    r = httpx.post(_agx_url(robot_local_ip, "/maintenance/stop"), timeout=30)
    r.raise_for_status()
    return r.json()


def start_training(robot_local_ip: str, wake_phrase: str, model_name: str,
                   steps: int, n_samples: int,
                   negative_phrases: list, sample_files: list) -> dict:
    """
    Send training request to AGX.
    sample_files: list of (filename, bytes) tuples
    """
    files = [("samples", (name, data, "audio/wav")) for name, data in sample_files]
    data = {
        "wake_phrase":       wake_phrase,
        "model_name":        model_name,
        "steps":             str(steps),
        "n_samples":         str(n_samples),
        "negative_phrases":  json.dumps(negative_phrases),
    }
    r = httpx.post(
        _agx_url(robot_local_ip, "/wakeword/train"),
        data=data,
        files=files if files else None,
        timeout=60,
    )
    r.raise_for_status()
    return r.json()


def get_training_status(robot_local_ip: str) -> dict:
    r = httpx.get(_agx_url(robot_local_ip, "/wakeword/train/status"), timeout=10)
    r.raise_for_status()
    return r.json()


def cancel_training(robot_local_ip: str) -> dict:
    r = httpx.delete(_agx_url(robot_local_ip, "/wakeword/train"), timeout=10)
    r.raise_for_status()
    return r.json()


def download_model(robot_local_ip: str, model_name: str, dest_path: str) -> str:
    """Download the trained ONNX from AGX to local disk."""
    import pathlib
    r = httpx.get(
        _agx_url(robot_local_ip, f"/wakeword/models/{model_name}.onnx"),
        timeout=60
    )
    r.raise_for_status()
    dest = pathlib.Path(dest_path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(r.content)
    logger.info(f"Downloaded {model_name}.onnx from AGX to {dest}")
    return str(dest)


def list_models(robot_local_ip: str) -> list:
    r = httpx.get(_agx_url(robot_local_ip, "/wakeword/models"), timeout=10)
    r.raise_for_status()
    return r.json().get("models", [])
