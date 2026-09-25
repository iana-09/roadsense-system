"""
Reports Router
GET /api/reports/summary  — aggregated stats for the reports page
GET /api/reports/jobs     — per-job breakdown with detection counts
"""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import (
    get_db, Job, Detection, Report,
    JobStatus, DetectionClass, Severity, DetectionStatus,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/summary")
def get_reports_summary(db: Session = Depends(get_db)):
    """
    Returns aggregated detection + job stats for the Reports page.
    All numbers come from the live database.
    """

    # ── Job counts ────────────────────────────────────────────────────────────
    total_jobs  = db.query(Job).count()
    completed   = db.query(Job).filter(Job.status == JobStatus.COMPLETED).count()
    failed      = db.query(Job).filter(Job.status == JobStatus.FAILED).count()

    # ── Detection counts ──────────────────────────────────────────────────────
    total_detections = db.query(Detection).count()

    # By class
    pothole_minor = db.query(Detection).filter(
        Detection.class_name == DetectionClass.POTHOLE_MINOR
    ).count()
    pothole_major = db.query(Detection).filter(
        Detection.class_name == DetectionClass.POTHOLE_MAJOR
    ).count()
    cracks = db.query(Detection).filter(
        Detection.class_name == DetectionClass.CRACK
    ).count()
    road_patching = db.query(Detection).filter(
        Detection.class_name == DetectionClass.ROAD_PATCHING
    ).count()

    # By severity
    low      = db.query(Detection).filter(Detection.severity == Severity.LOW).count()
    medium   = db.query(Detection).filter(Detection.severity == Severity.MEDIUM).count()
    high     = db.query(Detection).filter(Detection.severity == Severity.HIGH).count()

    # By verification status
    unverified     = db.query(Detection).filter(Detection.status == DetectionStatus.UNVERIFIED).count()
    verified       = db.query(Detection).filter(Detection.status == DetectionStatus.VERIFIED).count()
    false_positive = db.query(Detection).filter(Detection.status == DetectionStatus.FALSE_POSITIVE).count()
    fixed          = db.query(Detection).filter(Detection.status == DetectionStatus.FIXED).count()

    # Average confidence (handle empty table)
    avg_conf_row = db.query(func.avg(Detection.confidence)).scalar()
    avg_confidence = round(float(avg_conf_row) * 100, 1) if avg_conf_row else 0.0

    # ── Verification rate ─────────────────────────────────────────────────────
    verification_rate = (
        round((verified / total_detections) * 100, 1)
        if total_detections > 0 else 0.0
    )

    return {
        "jobs": {
            "total":     total_jobs,
            "completed": completed,
            "failed":    failed,
        },
        "detections": {
            "total":           total_detections,
            "avg_confidence":  avg_confidence,
            "verification_rate": verification_rate,
            "by_class": {
                "pothole_minor": pothole_minor,
                "pothole_major": pothole_major,
                "cracks":        cracks,
                "road_patching": road_patching,
            },
            "by_severity": {
                "low":    low,
                "medium": medium,
                "high":   high,
            },
            "by_status": {
                "unverified":     unverified,
                "verified":       verified,
                "false_positive": false_positive,
                "fixed":          fixed,
            },
        },
    }


@router.get("/jobs")
def get_reports_jobs(limit: int = 20, db: Session = Depends(get_db)):
    """
    Returns recent completed jobs with their detection breakdown.
    Used by the per-job table in the Reports page.
    """
    limit = max(1, min(limit, 100))
    jobs = (
        db.query(Job)
        .filter(Job.status == JobStatus.COMPLETED)
        .order_by(Job.completed_at.desc())
        .limit(limit)
        .all()
    )

    rows = []
    for job in jobs:
        detections = db.query(Detection).filter(Detection.job_id == job.id).all()

        total = len(detections)
        by_class = {}
        for d in detections:
            key = d.class_name.value if hasattr(d.class_name, 'value') else str(d.class_name)
            by_class[key] = by_class.get(key, 0) + 1

        verified_count = sum(1 for d in detections if d.status == DetectionStatus.VERIFIED)
        avg_conf = (
            round(sum(d.confidence for d in detections) / total * 100, 1)
            if total > 0 else 0.0
        )

        rows.append({
            "job_id":          job.id,
            "video_filename":  job.video_filename,
            "completed_at":    job.completed_at.isoformat() if job.completed_at else None,
            "total_detections": total,
            "verified":        verified_count,
            "avg_confidence":  avg_conf,
            "by_class":        by_class,
        })

    return {"jobs": rows}
