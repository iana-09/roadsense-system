"""
Dashboard Router
GET /api/dashboard/stats
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from config import settings
from database import get_db, Job, Detection, JobStatus, DetectionClass
from services.gpu_service import get_gpu_worker_preview, get_gpu_worker_status

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_jobs  = db.query(Job).count()
    completed   = db.query(Job).filter(Job.status == JobStatus.COMPLETED).count()
    processing  = db.query(Job).filter(Job.status == JobStatus.PROCESSING).count()
    pending     = db.query(Job).filter(Job.status == JobStatus.PENDING).count()
    failed      = db.query(Job).filter(Job.status == JobStatus.FAILED).count()

    total_detections = db.query(Detection).count()
    pothole_minor = db.query(Detection).filter(
        Detection.class_name == DetectionClass.POTHOLE_MINOR
    ).count()
    pothole_major = db.query(Detection).filter(
        Detection.class_name == DetectionClass.POTHOLE_MAJOR
    ).count()
    potholes = pothole_minor + pothole_major
    cracks = db.query(Detection).filter(
        Detection.class_name == DetectionClass.CRACK
    ).count()

    return {
        "total_jobs":       total_jobs,
        "completed":        completed,
        "processing":       processing,
        "pending":          pending,
        "failed":           failed,
        "total_detections": total_detections,
        "by_class": {
            "potholes":       potholes,
            "pothole_minor":  pothole_minor,
            "pothole_major":  pothole_major,
            "cracks":         cracks,
        },
    }


@router.get("/system-health")
def get_system_health(db: Session = Depends(get_db)):
    """Dashboard-facing health summary for backend, database, storage, and GPU worker."""
    total_jobs = db.query(Job).count()
    processing = db.query(Job).filter(Job.status == JobStatus.PROCESSING).count()
    pending = db.query(Job).filter(Job.status == JobStatus.PENDING).count()
    failed = db.query(Job).filter(Job.status == JobStatus.FAILED).count()

    gpu_worker = get_gpu_worker_status()

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "dashboard": {
            "online": True,
            "service": "RoadSense Web Dashboard",
        },
        "backend": {
            "online": True,
            "service": "RoadSense API (Azure SQL)",
            "version": "1.0.0",
            "database": settings.AZURE_DB_HOST,
            "storage": "Azure Blob Storage",
        },
        "gpu_worker": gpu_worker,
        "queue": {
            "total_jobs": total_jobs,
            "processing": processing,
            "pending": pending,
            "failed": failed,
        },
    }


@router.get("/gpu-preview/{job_id}")
def get_gpu_preview(job_id: str):
    preview = get_gpu_worker_preview(job_id)
    if not preview["success"]:
        raise HTTPException(
            status_code=preview.get("status_code", 503),
            detail=preview.get("error", "GPU preview unavailable."),
        )

    return Response(
        content=preview["content"],
        media_type=preview["content_type"],
        headers={"Cache-Control": "no-store, max-age=0"},
    )
