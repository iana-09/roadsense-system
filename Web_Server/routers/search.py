"""
Search Router
GET /api/search
"""

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session

from database import get_db, Detection, DetectionStatus, Job, LGURequest, LGURequestStatus, User
from auth_security import get_optional_user
from services.philippine_locations import point_is_in_city

router = APIRouter(prefix="/api/search", tags=["Search"])


def _like(value: str) -> str:
    return f"%{value.strip().lower()}%"


def _matches(column, pattern: str):
    return func.lower(cast(column, String)).like(pattern)


def _value(value):
    return value.value if hasattr(value, "value") else value


@router.get("")
def search(
    q: str,
    scope: Optional[str] = None,
    limit: int = 10,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    term = q.strip()
    if not term:
        return {"query": q, "total": 0, "results": {}}

    limit = max(1, min(limit, 50))
    pattern = _like(term)
    requested_scope = scope.strip().lower() if scope else None
    results = {}

    if requested_scope in (None, "jobs"):
        jobs = (
            db.query(
                Job.id.label("id"),
                cast(Job.status, String).label("status"),
                Job.video_filename.label("video_filename"),
                Job.user_id.label("user_id"),
                Job.created_at.label("created_at"),
            )
            .filter(or_(_matches(Job.id, pattern), _matches(Job.video_filename, pattern), _matches(Job.user_id, pattern)))
            .limit(limit)
            .all()
        )
        results["jobs"] = [
            {
                "job_id": job.id,
                "status": job.status,
                "video_filename": job.video_filename,
                "user_id": job.user_id,
                "created_at": job.created_at.isoformat() if job.created_at else None,
            }
            for job in jobs
        ]

    if requested_scope in (None, "detections"):
        detection_query = db.query(Detection).filter(
                or_(
                    _matches(Detection.id, pattern),
                    _matches(Detection.job_id, pattern),
                    _matches(Detection.class_name, pattern),
                    _matches(Detection.severity, pattern),
                    _matches(Detection.status, pattern),
                )
            )
        if not current_user or current_user.role not in ("admin", "lgu"):
            detection_query = detection_query.filter(Detection.status == DetectionStatus.VERIFIED)

        detections = detection_query.limit(200 if current_user and current_user.role == "lgu" else limit).all()
        if current_user and current_user.role == "lgu":
            request = db.query(LGURequest).filter(
                LGURequest.email == current_user.email,
                LGURequest.status == LGURequestStatus.APPROVED,
            ).first()
            detections = [
                detection
                for detection in detections
                if request and point_is_in_city(
                    detection.latitude,
                    detection.longitude,
                    request.city,
                    request.region,
                )
            ][:limit]
        results["detections"] = [
            {
                "detection_id": detection.id,
                "job_id": detection.job_id,
                "class_name": _value(detection.class_name),
                "severity": _value(detection.severity),
                "status": _value(detection.status),
                "latitude": detection.latitude,
                "longitude": detection.longitude,
                "created_at": detection.created_at.isoformat() if detection.created_at else None,
            }
            for detection in detections
        ]

    if requested_scope in (None, "lgu_requests") and current_user and current_user.role == "admin":
        lgu_requests = (
            db.query(LGURequest)
            .filter(
                or_(
                    _matches(LGURequest.email, pattern),
                    _matches(LGURequest.region, pattern),
                    _matches(LGURequest.city, pattern),
                    _matches(LGURequest.barangay, pattern),
                    _matches(LGURequest.status, pattern),
                    _matches(LGURequest.reviewed_by, pattern),
                )
            )
            .limit(limit)
            .all()
        )
        results["lgu_requests"] = [
            {
                "id": request.id,
                "email": request.email,
                "region": request.region,
                "city": request.city,
                "barangay": request.barangay,
                "status": _value(request.status),
                "created_at": request.created_at.isoformat() if request.created_at else None,
                "reviewed_by": request.reviewed_by,
            }
            for request in lgu_requests
        ]

    if requested_scope in (None, "users") and current_user and current_user.role == "admin":
        users = (
            db.query(User)
            .filter(or_(_matches(User.full_name, pattern), _matches(User.email, pattern), _matches(User.role, pattern)))
            .limit(limit)
            .all()
        )
        results["users"] = [
            {
                "user_id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "role": user.role,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            }
            for user in users
        ]

    total = sum(len(items) for items in results.values())
    return {"query": term, "total": total, "results": results}
