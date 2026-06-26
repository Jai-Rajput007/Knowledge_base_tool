"""Wake word training job model."""

from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, JSON
from app.db.database import Base


class WakewordJobStatus(str, PyEnum):
    QUEUED      = "queued"
    UPLOADING   = "uploading"    # uploading config dataset to Kaggle
    RUNNING     = "running"      # Kaggle kernel running
    DOWNLOADING = "downloading"  # kernel done, downloading ONNX
    READY       = "ready"        # ONNX downloaded, ready to deploy
    DEPLOYED    = "deployed"
    CANCELLED   = "cancelled"
    ERROR       = "error"


class WakewordJob(Base):
    __tablename__ = "wakeword_jobs"

    id              = Column(Integer, primary_key=True, index=True)
    wake_phrase     = Column(String(100), nullable=False)   # "hey jai"
    model_name      = Column(String(100), nullable=False)   # "hey_jai"
    backend         = Column(String(20), default="kaggle")  # "kaggle" | "local_agx"
    robot_ip        = Column(String(50), nullable=True)     # AGX IP for local_agx backend
    quality         = Column(String(20), default="standard")  # draft/standard/production
    steps           = Column(Integer, default=50000)
    n_samples       = Column(Integer, default=10000)
    sample_count    = Column(Integer, default=0)
    sample_dir      = Column(String(500), nullable=True)    # local path with WAV files
    negative_phrases = Column(JSON, default=list)

    # Kaggle tracking
    kaggle_kernel   = Column(String(200), nullable=True)    # "username/kernel-name"
    kaggle_run_id   = Column(String(100), nullable=True)    # version number

    # Output
    onnx_path       = Column(String(500), nullable=True)    # local path to .onnx
    optimal_threshold = Column(Float, nullable=True)
    recall          = Column(Float, nullable=True)
    fpph            = Column(Float, nullable=True)
    aut             = Column(Float, nullable=True)

    status          = Column(String(30), default=WakewordJobStatus.QUEUED)
    error_message   = Column(Text, nullable=True)
    kaggle_log_url  = Column(String(500), nullable=True)

    created_at      = Column(DateTime, default=datetime.utcnow)
    started_at      = Column(DateTime, nullable=True)
    completed_at    = Column(DateTime, nullable=True)
    deployed_at     = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            "id":                self.id,
            "wake_phrase":       self.wake_phrase,
            "model_name":        self.model_name,
            "backend":           self.backend,
            "robot_ip":          self.robot_ip,
            "quality":           self.quality,
            "steps":             self.steps,
            "n_samples":         self.n_samples,
            "sample_count":      self.sample_count,
            "status":            self.status,
            "optimal_threshold": self.optimal_threshold,
            "recall":            round(self.recall * 100, 1) if self.recall else None,
            "fpph":              round(self.fpph, 3) if self.fpph else None,
            "onnx_path":         self.onnx_path,
            "kaggle_kernel":     self.kaggle_kernel,
            "kaggle_log_url":    self.kaggle_log_url,
            "error_message":     self.error_message,
            "created_at":        self.created_at.isoformat() if self.created_at else None,
            "started_at":        self.started_at.isoformat() if self.started_at else None,
            "completed_at":      self.completed_at.isoformat() if self.completed_at else None,
        }
