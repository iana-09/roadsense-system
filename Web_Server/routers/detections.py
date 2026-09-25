"""
Detections Router
GET   /api/detections
GET   /api/detections/{detection_id}
PATCH /api/detections/{detection_id}/status   ← was missing, now added
PATCH /api/detections/{detection_id}/location
"""

import math
import logging
import secrets
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from database import get_db, Detection, DetectionStatus, Job, LGURequest, LGURequestStatus, User
from auth_security import get_optional_user, require_admin_or_lgu
from azure_storage import azure_storage
from error_messages import ErrorMessages
from validators import FieldValidator
from services.gpu_service import get_gpu_worker_crop, get_gpu_worker_frame
from services.philippine_locations import point_is_in_city
from config import settings
from audit_log import record_audit_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/detections", tags=["Detections"])

# Valid status transitions the LGU can make
VALID_STATUSES = {s.value for s in DetectionStatus}
PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _approved_lgu_request(current_user: User, db: Session) -> LGURequest:
    request = db.query(LGURequest).filter(LGURequest.email == current_user.email).first()
    if not request or request.status != LGURequestStatus.APPROVED:
        raise HTTPException(403, "Your LGU jurisdiction is not approved.")
    return request


def _can_access_detection(current_user: User | None, detection: Detection, db: Session) -> bool:
    if current_user and current_user.role == "admin":
        return True
    if current_user and current_user.role == "lgu":
        request = _approved_lgu_request(current_user, db)
        return point_is_in_city(
            detection.latitude,
            detection.longitude,
            request.city,
            request.region,
        )
    return detection.status == DetectionStatus.VERIFIED


def _require_detection_jurisdiction(current_user: User, detection: Detection, db: Session) -> None:
    if current_user.role == "admin":
        return
    request = _approved_lgu_request(current_user, db)
    if not point_is_in_city(
        detection.latitude,
        detection.longitude,
        request.city,
        request.region,
    ):
        raise HTTPException(403, f"This detection is outside your approved jurisdiction: {request.city}.")


def _utc_iso(value: Optional[datetime]) -> Optional[str]:
    if not value:
        return None
    return value.isoformat() + ("Z" if value.tzinfo is None else "")


def _image_filename(image_url: Optional[str]) -> Optional[str]:
    if not image_url:
        return None
    return image_url.replace("\\", "/").rstrip("/").split("/")[-1]


def _resolve_local_image_path(image_url: Optional[str], directory: str = "output_crops") -> Optional[Path]:
    if not image_url or image_url.startswith(("http://", "https://")):
        return None

    raw_path = Path(image_url)
    image_roots = [
        (PROJECT_ROOT / "GPU_Worker" / directory).resolve(),
        (PROJECT_ROOT / directory).resolve(),
    ]
    filename = _image_filename(image_url) or ""
    candidates = [
        raw_path,
        PROJECT_ROOT / raw_path,
        PROJECT_ROOT / "GPU_Worker" / raw_path,
        PROJECT_ROOT / "GPU_Worker" / directory / filename,
        PROJECT_ROOT / directory / filename,
    ]

    for candidate in candidates:
        try:
            resolved = candidate.resolve()
        except OSError:
            continue
        if not resolved.is_file():
            continue
        if any(resolved == root or root in resolved.parents for root in image_roots):
            return resolved

    return None


def _asset_read_url(request: Request, detection: Detection, asset: str) -> Optional[str]:
    image_url = detection.frame_url if asset == "frame" else detection.image_url
    if not image_url:
        return None

    if image_url.startswith(("http://", "https://")):
        try:
            return azure_storage.get_read_url_from_blob_url(image_url) if azure_storage else image_url
        except Exception as e:
            logger.warning(f"Could not generate read URL for detection image: {e}")
            return image_url

    if image_url:
        base_url = str(request.base_url).rstrip("/")
        return f"{base_url}/api/detections/{detection.id}/{asset}"

    return None


# ── List detections ───────────────────────────────────────────────────────────

@router.get("")
def get_detections(
    request: Request,
    latitude:  Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: float = 5.0,
    limit:     int   = 100,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 500))
    query = db.query(Detection)
    if not current_user or current_user.role not in ("admin", "lgu"):
        query = query.filter(Detection.status == DetectionStatus.VERIFIED)

    if latitude and longitude:
        valid_lat, error = FieldValidator.validate_latitude(latitude)
        if not valid_lat:
            raise HTTPException(400, error)

        valid_lng, error = FieldValidator.validate_longitude(longitude)
        if not valid_lng:
            raise HTTPException(400, error)

        radius_deg = radius_km / 111.0
        query = query.filter(
            Detection.latitude.between(latitude  - radius_deg, latitude  + radius_deg),
            Detection.longitude.between(longitude - radius_deg, longitude + radius_deg),
        )

    detections = query.all() if current_user and current_user.role == "lgu" else query.limit(limit).all()

    if latitude and longitude:
        def haversine(lat1, lon1, lat2, lon2) -> float:
            R = 6371
            lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
            dlat, dlon = lat2 - lat1, lon2 - lon1
            a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
            return R * 2 * math.asin(math.sqrt(a))

        detections = [
            d for d in detections
            if haversine(latitude, longitude, d.latitude, d.longitude) <= radius_km
        ]

    detections = [
        detection
        for detection in detections
        if _can_access_detection(current_user, detection, db)
    ][:limit]
    cities = dict(
        db.query(Job.id, Job.city)
        .filter(Job.id.in_({d.job_id for d in detections}))
        .all()
    ) if detections else {}
    verifiers = {
        user.id: user
        for user in db.query(User)
        .filter(User.id.in_({d.verified_by for d in detections if d.verified_by}))
        .all()
    } if detections else {}

    return {
        "total": len(detections),
        "detections": [
            {
                "detection_id": d.id,
                "class_name":   d.class_name.value,
                "confidence":   d.confidence,
                "latitude":     d.latitude,
                "longitude":    d.longitude,
                "severity":     d.severity.value,
                "status":       d.status.value,
                "image_url":    _asset_read_url(request, d, "image"),
                "frame_url":    _asset_read_url(request, d, "frame"),
                "city":         cities.get(d.job_id),
                "verified_at":  _utc_iso(d.verified_at),
                "verified_by":  d.verified_by,
                "verified_by_name": verifiers[d.verified_by].full_name if d.verified_by in verifiers else None,
                "verified_by_role": verifiers[d.verified_by].role if d.verified_by in verifiers else None,
                "created_at":   _utc_iso(d.created_at),
            }
            for d in detections
        ],
    }


# ── Single detection ──────────────────────────────────────────────────────────

@router.get("/{detection_id}")
def get_detection(
    detection_id: str,
    request: Request,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    detection = db.query(Detection).filter(Detection.id == detection_id).first()
    if not detection:
        raise HTTPException(404, ErrorMessages.DETECTION_NOT_FOUND)
    if not _can_access_detection(current_user, detection, db):
        raise HTTPException(403, "This detection is not available in your jurisdiction.")

    verifier = db.query(User).filter(User.id == detection.verified_by).first() if detection.verified_by else None

    return {
        "detection_id": detection.id,
        "job_id":       detection.job_id,
        "track_id":     detection.track_id,
        "class_name":   detection.class_name.value,
        "confidence":   detection.confidence,
        "severity":     detection.severity.value,
        "status":       detection.status.value,
        "latitude":     detection.latitude,
        "longitude":    detection.longitude,
        "gps_accuracy": detection.gps_accuracy,
        "frame_number": detection.frame_number,
        "timestamp":    detection.timestamp,
        "bbox":         detection.bbox,
        "image_url":    _asset_read_url(request, detection, "image"),
        "frame_url":    _asset_read_url(request, detection, "frame"),
        "city":         db.query(Job.city).filter(Job.id == detection.job_id).scalar(),
        "verified_at":  _utc_iso(detection.verified_at),
        "verified_by":  detection.verified_by,
        "verified_by_name": verifier.full_name if verifier else None,
        "verified_by_role": verifier.role if verifier else None,
        "created_at":   _utc_iso(detection.created_at),
    }


@router.get("/{detection_id}/image")
def get_detection_image(
    detection_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    detection = db.query(Detection).filter(Detection.id == detection_id).first()
    if not detection:
        raise HTTPException(404, ErrorMessages.DETECTION_NOT_FOUND)
    if not _can_access_detection(current_user, detection, db):
        raise HTTPException(403, "This detection is not available in your jurisdiction.")

    image_path = _resolve_local_image_path(detection.image_url)
    if image_path:
        return FileResponse(image_path)

    if detection.image_url:
        crop_filename = _image_filename(detection.image_url)
        if not crop_filename:
            raise HTTPException(404, "Detection image not found")
        crop = get_gpu_worker_crop(crop_filename)
        if crop["success"]:
            return Response(
                content=crop["content"],
                media_type=crop["content_type"],
                headers={"Cache-Control": "no-store, max-age=0"},
            )

    raise HTTPException(404, "Detection image not found")


@router.get("/{detection_id}/frame")
def get_detection_frame(
    detection_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    detection = db.query(Detection).filter(Detection.id == detection_id).first()
    if not detection:
        raise HTTPException(404, ErrorMessages.DETECTION_NOT_FOUND)
    if not _can_access_detection(current_user, detection, db):
        raise HTTPException(403, "This detection is not available in your jurisdiction.")

    image_path = _resolve_local_image_path(detection.frame_url, "frames")
    if image_path:
        return FileResponse(image_path)

    frame_filename = _image_filename(detection.frame_url)
    if frame_filename:
        frame = get_gpu_worker_frame(frame_filename)
        if frame["success"]:
            return Response(
                content=frame["content"],
                media_type=frame["content_type"],
                headers={"Cache-Control": "no-store, max-age=0"},
            )

    raise HTTPException(404, "Original detection frame not found")


@router.post("/{detection_id}/image")
def upload_detection_image(
    detection_id: str,
    request: Request,
    file: UploadFile = File(...),
    worker_key: str | None = Header(None, alias="X-Worker-Key"),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    detection = db.query(Detection).filter(Detection.id == detection_id).first()
    if not detection:
        raise HTTPException(404, ErrorMessages.DETECTION_NOT_FOUND)

    is_worker = bool(
        settings.GPU_WORKER_API_KEY
        and secrets.compare_digest(worker_key or "", settings.GPU_WORKER_API_KEY)
    )
    if not is_worker:
        if not current_user:
            raise HTTPException(401, "Authentication required.")
        if current_user.role not in ("admin", "lgu"):
            raise HTTPException(403, "Admin or LGU access required.")
        _require_detection_jurisdiction(current_user, detection, db)

    valid, error = FieldValidator.validate_filename(file.filename, "image")
    if not valid:
        raise HTTPException(400, error)

    if not azure_storage:
        raise HTTPException(500, "Azure Blob Storage is not configured")

    try:
        file_data = file.file.read()
        valid, error = FieldValidator.validate_file_size(len(file_data), max_mb=25)
        if not valid:
            raise HTTPException(400, error)

        image_url = azure_storage.upload_crop(BytesIO(file_data), file.filename, detection.job_id)
        if not image_url:
            raise HTTPException(500, "Failed to upload detection image")

        detection.image_url = image_url
        db.commit()
        db.refresh(detection)

        return {
            "success": True,
            "detection_id": detection.id,
            "image_url": _asset_read_url(request, detection, "image"),
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Detection image upload failed for {detection_id}: {e}")
        raise HTTPException(500, "Failed to upload detection image")


@router.post("/{detection_id}/frame")
def upload_detection_frame(
    detection_id: str,
    request: Request,
    file: UploadFile = File(...),
    worker_key: str | None = Header(None, alias="X-Worker-Key"),
    db: Session = Depends(get_db),
):
    detection = db.query(Detection).filter(Detection.id == detection_id).first()
    if not detection:
        raise HTTPException(404, ErrorMessages.DETECTION_NOT_FOUND)
    if not settings.GPU_WORKER_API_KEY or not secrets.compare_digest(
        worker_key or "", settings.GPU_WORKER_API_KEY
    ):
        raise HTTPException(403, "GPU worker access required.")

    valid, error = FieldValidator.validate_filename(file.filename, "image")
    if not valid:
        raise HTTPException(400, error)
    if not azure_storage:
        raise HTTPException(500, "Azure Blob Storage is not configured")

    try:
        file_data = file.file.read()
        valid, error = FieldValidator.validate_file_size(len(file_data), max_mb=25)
        if not valid:
            raise HTTPException(400, error)

        frame_url = azure_storage.upload_crop(BytesIO(file_data), file.filename, detection.job_id)
        if not frame_url:
            raise HTTPException(500, "Failed to upload detection frame")

        detection.frame_url = frame_url
        db.commit()
        db.refresh(detection)
        return {
            "success": True,
            "detection_id": detection.id,
            "frame_url": _asset_read_url(request, detection, "frame"),
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Detection frame upload failed for {detection_id}: {e}")
        raise HTTPException(500, "Failed to upload detection frame")


@router.patch("/{detection_id}/location")
def update_detection_location(
    detection_id: str,
    data: dict,
    request: Request,
    current_user: User = Depends(require_admin_or_lgu),
    db: Session = Depends(get_db),
):
    detection = db.query(Detection).filter(Detection.id == detection_id).first()
    if not detection:
        raise HTTPException(404, ErrorMessages.DETECTION_NOT_FOUND)
    _require_detection_jurisdiction(current_user, detection, db)

    lat = data.get("latitude")
    lng = data.get("longitude")

    valid_lat, error = FieldValidator.validate_latitude(lat)
    if not valid_lat:
        raise HTTPException(400, error)

    valid_lng, error = FieldValidator.validate_longitude(lng)
    if not valid_lng:
        raise HTTPException(400, error)
    if current_user.role == "lgu":
        jurisdiction = _approved_lgu_request(current_user, db)
        if not point_is_in_city(float(lat), float(lng), jurisdiction.city, jurisdiction.region):
            raise HTTPException(403, f"The new location is outside your approved jurisdiction: {jurisdiction.city}.")

    try:
        old_location = {"latitude": detection.latitude, "longitude": detection.longitude}
        detection.latitude = float(lat)
        detection.longitude = float(lng)
        record_audit_event(
            db, request, current_user,
            category="validation",
            action="update_detection_location",
            resource_type="detection",
            resource_id=detection_id,
            details={
                "old_location": old_location,
                "new_location": {"latitude": float(lat), "longitude": float(lng)},
            },
        )
        db.commit()
        db.refresh(detection)

        logger.info(f"Detection {detection_id} moved to {detection.latitude}, {detection.longitude}")
        return {
            "success": True,
            "detection_id": detection.id,
            "latitude": detection.latitude,
            "longitude": detection.longitude,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update detection {detection_id} location: {e}")
        raise HTTPException(500, "Failed to update detection location.")


# ── Update detection status (LGU verify / false positive / fixed) ─────────────

@router.patch("/{detection_id}/status")
def update_detection_status(
    detection_id: str,
    data: dict,
    request: Request,
    current_user: User = Depends(require_admin_or_lgu),
    db: Session = Depends(get_db),
):
    """
    Update the verification status of a detection.
    Called by the LGU Verify page buttons.

    Valid statuses: unverified | verified | false_positive | fixed
    """
    new_status = data.get("status", "").strip().lower()

    if new_status not in VALID_STATUSES:
        raise HTTPException(
            400,
            f"Invalid status '{new_status}'. Must be one of: {', '.join(sorted(VALID_STATUSES))}"
        )

    detection = db.query(Detection).filter(Detection.id == detection_id).first()
    if not detection:
        raise HTTPException(404, ErrorMessages.DETECTION_NOT_FOUND)
    _require_detection_jurisdiction(current_user, detection, db)

    old_status = detection.status.value

    try:
        detection.status = DetectionStatus(new_status)

        if new_status in ("verified", "fixed"):
            detection.verified_at = datetime.utcnow()
            detection.verified_by = current_user.id
        elif new_status == "unverified":
            detection.verified_at = None
            detection.verified_by = None

        record_audit_event(
            db, request, current_user,
            category="validation",
            action="update_detection_status",
            resource_type="detection",
            resource_id=detection_id,
            details={"old_status": old_status, "new_status": new_status},
        )

        db.commit()
        db.refresh(detection)

        logger.info(f"Detection {detection_id} status: {old_status} → {new_status}")

        return {
            "success":      True,
            "detection_id": detection.id,
            "old_status":   old_status,
            "new_status":   detection.status.value,
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update detection {detection_id} status: {e}")
        raise HTTPException(500, "Failed to update detection status.")


@router.post("/bulk/action")
def bulk_detection_action(
    data: dict,
    request: Request,
    current_user: User = Depends(require_admin_or_lgu),
    db: Session = Depends(get_db),
):
    detection_ids = list(dict.fromkeys(data.get("detection_ids") or []))
    action = str(data.get("action") or "").strip().lower()

    if not detection_ids or len(detection_ids) > 500:
        raise HTTPException(400, "Provide between 1 and 500 detection IDs.")
    if action not in ("fixed", "delete"):
        raise HTTPException(400, "Action must be 'fixed' or 'delete'.")

    detections = db.query(Detection).filter(Detection.id.in_(detection_ids)).all()
    if len(detections) != len(detection_ids):
        raise HTTPException(404, "One or more detections were not found.")

    for detection in detections:
        _require_detection_jurisdiction(current_user, detection, db)

    try:
        if action == "delete":
            for detection in detections:
                db.delete(detection)
        else:
            for detection in detections:
                detection.status = DetectionStatus.FIXED
                detection.verified_at = datetime.utcnow()
                detection.verified_by = current_user.id

        record_audit_event(
            db, request, current_user,
            category="deletion" if action == "delete" else "validation",
            action="bulk_delete_detections" if action == "delete" else "bulk_mark_fixed",
            resource_type="detection",
            details={"count": len(detections), "detection_ids": detection_ids},
        )

        db.commit()
        return {
            "success": True,
            "action": action,
            "affected": len(detections),
            "detection_ids": detection_ids,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Bulk detection action failed: action={action}, error={e}")
        raise HTTPException(500, "Bulk detection action failed.")


@router.delete("/{detection_id}")
def delete_detection(
    detection_id: str,
    request: Request,
    current_user: User = Depends(require_admin_or_lgu),
    db: Session = Depends(get_db),
):
    detection = db.query(Detection).filter(Detection.id == detection_id).first()
    if not detection:
        raise HTTPException(404, ErrorMessages.DETECTION_NOT_FOUND)
    _require_detection_jurisdiction(current_user, detection, db)

    try:
        db.delete(detection)
        record_audit_event(
            db, request, current_user,
            category="deletion",
            action="delete_detection",
            resource_type="detection",
            resource_id=detection_id,
            details={"job_id": detection.job_id},
        )
        db.commit()
        logger.info(f"Detection deleted: {detection_id}")
        return {
            "success": True,
            "message": "Detection deleted successfully",
            "detection_id": detection_id,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete detection {detection_id}: {e}")
        raise HTTPException(500, "Failed to delete detection.")
