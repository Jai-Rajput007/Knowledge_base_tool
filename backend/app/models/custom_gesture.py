from sqlalchemy import Column, String, DateTime, Integer, Float, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
import uuid

from app.db.database import Base


class CustomGesture(Base):
    """
    A hand-taught arm gesture recorded on the robot and persisted here so it
    survives a Thor reflash or container rebuild. The Thor filesystem
    (data/gestures/*.gesture) is a cache of this row, not the source of truth
    — see knowledge_base_tool/GESTURE_SYSTEM_PLAN.md §6.
    """

    __tablename__ = "custom_gestures"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("Tenant.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    # Recording payload: [[t, q0, q1, ..., q13], ...] — 14 arm joint angles per sample.
    waypoints = Column(JSON, nullable=False)
    sample_count = Column(Integer, nullable=False)
    duration_s = Column(Float, nullable=False)
    joint_count = Column(Integer, default=14)

    # Provenance — lets a swapped robot unit (different joint calibration) be detected.
    recorded_on = Column(String, nullable=True)
    schema_version = Column(Integer, default=1)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_gesture_tenant_name"),
    )

    def to_dict(self, include_waypoints: bool = False):
        d = {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "name": self.name,
            "description": self.description,
            "sample_count": self.sample_count,
            "duration_s": self.duration_s,
            "joint_count": self.joint_count,
            "recorded_on": self.recorded_on,
            "schema_version": self.schema_version,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_waypoints:
            d["waypoints"] = self.waypoints
        return d
