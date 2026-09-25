"""
Jobs Router
GET  /api/jobs
GET  /api/jobs/{job_id}
POST /api/jobs/{job_id}/status
POST /api/process/result/{job_id}
"""

import logging
import json
import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import (
    get_db, Job, Detection, Report, JobStatus, DetectionClass,
    DetectionStatus, Severity, LGURequest, LGURequestStatus, User,
)
from auth_security import get_optional_user, require_admin
from azure_storage import azure_storage
from config import settings
from error_messages import ErrorMessages
from validators import FieldValidator
from services.gpu_service import trigger_gpu_processing
from services.philippine_locations import point_is_in_city, resolve_gps_trace_locality
from models import StrictRequestModel
from audit_log import record_audit_event

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Jobs"])
DASHCAM_PENDING_VIDEO_URL = "dashcam://pending"


class JobStatusUpdate(StrictRequestModel):
    status: Optional[str] = None
    error_message: Optional[str] = None


def _status_value(status) -> str:
    raw = getattr(status, "value", status)
    if raw is None:
        return "unknown"
    raw = str(raw).split(".")[-1]
    return raw.lower()


def _processing_stats(value) -> dict:
    if isinstance(value, dict):
        return dict(value)

    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            logger.warning("Invalid processing_stats JSON on job row")

    return {}


def _clear_stop_request(stats: dict) -> dict:
    next_stats = dict(stats or {})
    next_stats.pop("stop_requested", None)
    next_stats.pop("stopped_at", None)
    next_stats.pop("stopped_by", None)
    return next_stats


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


def _video_read_url(video_url: Optional[str]) -> Optional[str]:
    if not video_url or video_url == DASHCAM_PENDING_VIDEO_URL:
        return None

    try:
        return azure_storage.get_read_url_from_blob_url(video_url) if azure_storage else video_url
    except Exception as e:
        logger.warning(f"Could not generate read URL for video blob: {e}")
        return video_url


def _utc_iso(value: Optional[datetime]) -> Optional[str]:
    if not value:
        return None
    return value.isoformat() + ("Z" if value.tzinfo is None else "")


def _image_filename(image_url: Optional[str]) -> Optional[str]:
    if not image_url:
        return None
    return str(image_url).replace("\\", "/").rstrip("/").split("/")[-1]


def _clean_bbox(bbox):
    if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
        return None

    try:
        x1, y1, x2, y2 = [float(value) for value in bbox]
    except (TypeError, ValueError):
        return None

    left = min(x1, x2)
    right = max(x1, x2)
    top = min(y1, y2)
    bottom = max(y1, y2)

    if right - left < 1 or bottom - top < 1:
        return None

    return [left, top, right, bottom]


def _job_summary_from_row(row) -> dict:
    data = row._mapping if hasattr(row, "_mapping") else row
    video_url = _video_read_url(data["video_url"])
    processing_stats = _processing_stats(data["processing_stats"])
    is_dashcam = bool(processing_stats.get("dashcam_mode")) or data["video_url"] == DASHCAM_PENDING_VIDEO_URL
    is_photo = processing_stats.get("media_type") == "photo"
    source = "photo" if is_photo else ("dashcam" if is_dashcam else "mobile")
    created_at = data["created_at"]
    return {
        "job_id":          str(data["id"]),
        "status":          _status_value(data["status"]),
        "video_filename":  data["video_filename"],
        "video_url":       video_url,
        "has_blob_video":  bool(video_url),
        "awaiting_video":  data["video_url"] == DASHCAM_PENDING_VIDEO_URL,
        "media_type":      "photo" if is_photo else "video",
        "source":          source,
        "source_label":    "Mobile photo" if is_photo else ("Dashcam session" if is_dashcam else "Mobile upload"),
        "region":          data.get("region"),
        "region_code":     data.get("region_code"),
        "city":            data.get("city"),
        "city_code":       data.get("city_code"),
        "created_at":      _utc_iso(created_at),
    }


def _job_summary(j: Job) -> dict:
    video_url = _video_read_url(j.video_url)
    processing_stats = _processing_stats(j.processing_stats)
    is_dashcam = bool(processing_stats.get("dashcam_mode")) or j.video_url == DASHCAM_PENDING_VIDEO_URL
    is_photo = processing_stats.get("media_type") == "photo"
    source = "photo" if is_photo else ("dashcam" if is_dashcam else "mobile")
    return {
        "job_id":          str(j.id),
        "status":          _status_value(j.status),
        "video_filename":  j.video_filename,
        "video_url":       video_url,
        "has_blob_video":  bool(video_url),
        "awaiting_video":  j.video_url == DASHCAM_PENDING_VIDEO_URL,
        "media_type":      "photo" if is_photo else "video",
        "source":          source,
        "source_label":    "Mobile photo" if is_photo else ("Dashcam session" if is_dashcam else "Mobile upload"),
        "region":          j.region,
        "region_code":     j.region_code,
        "city":            j.city,
        "city_code":       j.city_code,
        "is_anonymous":    bool(j.is_anonymous),
        "created_at":      _utc_iso(j.created_at),
    }


# ── List / detail ─────────────────────────────────────────────────────────────

@router.get("/api/jobs")
def list_jobs(
    status:  Optional[str] = None,
    user_id: Optional[str] = None,
    limit:   int = 50,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    try:
        limit = max(1, min(limit, 100))
        query = db.query(Job)
        if status:
            normalized_status = status.lower()
            valid_statuses = {item.value for item in JobStatus}
            if normalized_status not in valid_statuses:
                raise HTTPException(400, f"Invalid status: {status}")
            query = query.filter(Job.status == JobStatus(normalized_status))

        if user_id:
            query = query.filter(Job.user_id == user_id)

        if not current_user:
            jobs = []
        elif current_user.role == "admin":
            jobs = query.order_by(Job.created_at.desc()).limit(limit).all()
        elif current_user.role == "user":
            jobs = (
                query.filter(Job.user_id == current_user.id)
                .order_by(Job.created_at.desc())
                .limit(limit)
                .all()
            )
        elif current_user.role == "lgu":
            request = db.query(LGURequest).filter(
                LGURequest.email == current_user.email,
                LGURequest.status == LGURequestStatus.APPROVED,
            ).first()
            if not request:
                raise HTTPException(403, "Your LGU jurisdiction is not approved.")

            candidates = query.order_by(Job.created_at.desc()).limit(500).all()
            jobs = []
            for job in candidates:
                if request.city_code and job.city_code == request.city_code:
                    jobs.append(job)
                    continue
                if job.city_code:
                    continue

                legacy_detection = db.query(Detection).filter(
                    Detection.job_id == job.id
                ).first()
                if legacy_detection and point_is_in_city(
                    legacy_detection.latitude,
                    legacy_detection.longitude,
                    request.city,
                    request.region,
                ):
                    jobs.append(job)
                if len(jobs) >= limit:
                    break
        else:
            jobs = []

        return {
            "total": len(jobs),
            "jobs": [_job_summary(j) for j in jobs],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"DATABASE ERROR in list_jobs: {e}")
        raise HTTPException(500, "Failed to load jobs")


@router.get("/api/admin/contributors")
def list_contributors(
    limit: int = 200,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Admin-facing contribution list with per-upload attribution applied."""
    if not current_user or current_user.role != "admin":
        raise HTTPException(403, "Administrator access is required.")

    limit = max(1, min(limit, 500))
    rows = (
        db.query(Job, User.full_name)
        .outerjoin(User, Job.user_id == User.id)
        .order_by(Job.created_at.desc())
        .limit(limit)
        .all()
    )

    contributions = []
    for job, full_name in rows:
        is_anonymous = bool(job.is_anonymous) or not bool(job.attribution_opt_in)
        stats = _processing_stats(job.processing_stats)
        is_photo = stats.get("media_type") == "photo"
        contributions.append({
            "job_id": str(job.id),
            "filename": job.video_filename,
            "media_type": "photo" if is_photo else "video",
            "contributor_name": "Anonymous" if is_anonymous else (full_name or "Unknown user"),
            "is_anonymous": is_anonymous,
            "status": _status_value(job.status),
            "created_at": _utc_iso(job.created_at),
        })

    return {"contributions": contributions}


@router.get("/api/contributors/leaderboard")
def contributor_leaderboard(limit: int = 50, db: Session = Depends(get_db)):
    """Public rankings containing only contributors who opted into attribution."""
    limit = max(1, min(limit, 100))
    rows = (
        db.query(
            User.full_name.label("contributor_name"),
            func.count(Job.id).label("contribution_count"),
        )
        .join(User, Job.user_id == User.id)
        .filter(Job.is_anonymous == False, Job.attribution_opt_in == True)  # noqa: E712
        .group_by(User.id, User.full_name)
        .order_by(func.count(Job.id).desc(), User.full_name.asc())
        .limit(limit)
        .all()
    )

    return {
        "contributors": [
            {
                "rank": index,
                "name": row.contributor_name,
                "contribution_count": row.contribution_count,
            }
            for index, row in enumerate(rows, start=1)
        ]
    }


@router.get("/api/jobs/{job_id}")
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, ErrorMessages.JOB_NOT_FOUND)

    detection_count = db.query(Detection).filter(Detection.job_id == job_id).count()

    return {
        "job_id":            job.id,
        "status":            job.status.value,
        "video_filename":    job.video_filename,
        "video_url":         _video_read_url(job.video_url),
        "gps_filename":      job.gps_filename,
        "gps_url":           job.gps_url,
        "user_id":           job.user_id,
        "created_at":        _utc_iso(job.created_at),
        "started_at":        _utc_iso(job.started_at),
        "completed_at":      _utc_iso(job.completed_at),
        "error_message":     job.error_message,
        "total_detections":  detection_count,
        "processing_stats":  job.processing_stats,
    }


# ── Status update (from GPU Worker) ──────────────────────────────────────────

@router.post("/api/jobs/{job_id}/process")
def process_existing_job(job_id: str, db: Session = Depends(get_db)):
    """TEMP: manually trigger GPU processing for an existing blob-video job, even without GPS."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, ErrorMessages.JOB_NOT_FOUND)

    if not job.video_url or job.video_url == DASHCAM_PENDING_VIDEO_URL:
        raise HTTPException(400, "This job does not have a blob video yet")

    processing_stats = _clear_stop_request(_processing_stats(job.processing_stats))
    has_gps = bool(job.gps_url and job.gps_url != "pending")

    accepted = trigger_gpu_processing(
        job_id=job.id,
        video_url=azure_storage.get_read_url_from_blob_url(job.video_url),
        gps_url=azure_storage.get_read_url_from_blob_url(job.gps_url) if has_gps else None,
        user_id=job.user_id,
        dashcam_mode=False,
        dashcam_has_gps=bool(processing_stats.get("dashcam_has_gps")) if has_gps else False,
        media_type=processing_stats.get("media_type", "video"),
        location=processing_stats.get("location"),
    )

    if not accepted:
        job.status = JobStatus.FAILED
        job.error_message = f"GPU Worker unreachable at {settings.GPU_WORKER_URL}"
        job.completed_at = datetime.utcnow()
        db.commit()
        raise HTTPException(502, job.error_message)

    job.status = JobStatus.PROCESSING
    job.started_at = datetime.utcnow()
    job.error_message = None
    job.processing_stats = processing_stats
    db.commit()

    logger.info(f"Manually triggered GPU processing for job {job_id}")
    return {"success": True, "message": "GPU processing started", "job_id": job_id}


@router.post("/api/jobs/{job_id}/stop")
def stop_processing_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, ErrorMessages.JOB_NOT_FOUND)

    if job.status != JobStatus.PROCESSING:
        return {
            "success": True,
            "message": "Job is not currently processing",
            "job_id": job_id,
            "status": job.status.value,
        }

    processing_stats = _processing_stats(job.processing_stats)
    processing_stats["stop_requested"] = True
    processing_stats["stopped_at"] = datetime.utcnow().isoformat()
    processing_stats["stopped_by"] = "admin_dashboard"

    job.status = JobStatus.FAILED
    job.error_message = "Processing stopped by admin. You can retry this upload."
    job.completed_at = datetime.utcnow()
    job.processing_stats = processing_stats
    db.commit()

    logger.info(f"Processing stopped for job {job_id}")
    return {
        "success": True,
        "message": "Processing stopped. Retry is now available.",
        "job_id": job_id,
        "status": job.status.value,
    }


@router.post("/api/jobs/stop-processing")
def stop_all_processing_jobs(db: Session = Depends(get_db)):
    processing_jobs = db.query(Job).filter(Job.status == JobStatus.PROCESSING).all()
    stopped_at = datetime.utcnow()

    for job in processing_jobs:
        processing_stats = _processing_stats(job.processing_stats)
        processing_stats["stop_requested"] = True
        processing_stats["stopped_at"] = stopped_at.isoformat()
        processing_stats["stopped_by"] = "admin_dashboard"

        job.status = JobStatus.FAILED
        job.error_message = "Processing stopped by admin. You can retry this upload."
        job.completed_at = stopped_at
        job.processing_stats = processing_stats

    db.commit()

    logger.info(f"Stopped {len(processing_jobs)} processing job(s)")
    return {
        "success": True,
        "message": f"Stopped {len(processing_jobs)} processing job(s).",
        "stopped_count": len(processing_jobs),
    }


@router.delete("/api/jobs/{job_id}")
def delete_job(
    job_id: str,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, ErrorMessages.JOB_NOT_FOUND)

    try:
        if azure_storage:
            containers = [
                settings.AZURE_STORAGE_CONTAINER_VIDEOS,
                settings.AZURE_STORAGE_CONTAINER_GPS,
                settings.AZURE_STORAGE_CONTAINER_CROPS,
                settings.AZURE_STORAGE_CONTAINER_REPORTS,
            ]

            for container_name in containers:
                try:
                    for blob in azure_storage.list_blobs(container_name, prefix=f"{job_id}/"):
                        azure_storage.delete_blob(container_name, blob.name)
                except Exception as e:
                    logger.warning(f"Could not delete blobs for job {job_id} in {container_name}: {e}")

        db.query(Detection).filter(Detection.job_id == job_id).delete()
        db.query(Report).filter(Report.job_id == job_id).delete()
        db.delete(job)
        record_audit_event(
            db, request, current_user,
            category="deletion",
            action="delete_upload_job",
            resource_type="job",
            resource_id=job_id,
            details={"filename": job.video_filename},
        )
        db.commit()

        logger.info(f"Deleted job {job_id}")
        return {"success": True, "message": "Upload deleted successfully", "job_id": job_id}

    except Exception as e:
        db.rollback()
        logger.error(f"Delete job failed for {job_id}: {e}")
        raise HTTPException(500, ErrorMessages.DATABASE_ERROR)


@router.post("/api/jobs/{job_id}/status")
def update_job_status(
    job_id:        str,
    payload:       Optional[JobStatusUpdate] = Body(None),
    status:        Optional[str] = None,
    error_message: Optional[str] = None,
    x_worker_key:  str | None = Header(None),
    db: Session = Depends(get_db),
):
    if not settings.GPU_WORKER_API_KEY or not secrets.compare_digest(
        x_worker_key or "", settings.GPU_WORKER_API_KEY
    ):
        raise HTTPException(401, "Invalid GPU worker credentials.")

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, ErrorMessages.JOB_NOT_FOUND)

    try:
        if payload:
            status = payload.status or status
            error_message = payload.error_message or error_message

        if not status:
            raise HTTPException(400, "Missing job status")

        status = status.lower()
        if status == "processing":
            current_stats = _clear_stop_request(_processing_stats(job.processing_stats))
            job.status     = JobStatus.PROCESSING
            job.started_at = datetime.utcnow()
            job.error_message = None
            job.completed_at = None
            job.processing_stats = current_stats
        elif status == "completed":
            job.status       = JobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
        elif status == "failed":
            job.status        = JobStatus.FAILED
            job.error_message = error_message
            job.completed_at  = datetime.utcnow()
        elif status == "pending_video":
            job.status = JobStatus.PENDING
        else:
            raise HTTPException(400, f"Invalid status: {status}")

        db.commit()
        logger.info(f"Job {job_id} status → {status}")
        return {"success": True, "message": f"Job status updated to {status}"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Status update failed: {e}")
        raise HTTPException(500, ErrorMessages.DATABASE_ERROR)


# ── Result ingestion (from GPU Worker) ───────────────────────────────────────

@router.post("/api/process/result/{job_id}")
def receive_processing_result(
    job_id: str,
    result: dict,
    x_worker_key: str | None = Header(None),
    db: Session = Depends(get_db),
):
    # GPU result ingestion is machine-to-machine only; never expose this key
    # to browser/mobile clients.
    if not settings.GPU_WORKER_API_KEY or not secrets.compare_digest(
        x_worker_key or "", settings.GPU_WORKER_API_KEY
    ):
        raise HTTPException(401, "Invalid GPU worker credentials.")

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, ErrorMessages.JOB_NOT_FOUND)

    try:
        current_stats = _processing_stats(job.processing_stats)
        if current_stats.get("stop_requested"):
            stopped_at = _parse_iso_datetime(current_stats.get("stopped_at"))
            if job.started_at and stopped_at and stopped_at <= job.started_at:
                logger.warning(
                    f"Clearing stale stop request for job {job_id}: "
                    f"stopped_at={current_stats.get('stopped_at')}, started_at={job.started_at.isoformat()}"
                )
                current_stats = _clear_stop_request(current_stats)
                job.processing_stats = current_stats
            else:
                logger.warning(
                    f"Ignoring late GPU result for job {job_id}: "
                    f"status={job.status.value}, stop_requested={current_stats.get('stop_requested')}"
                )
                raise HTTPException(409, {
                    "reason": "stop_requested",
                    "message": "Job is no longer accepting GPU results.",
                    "status": job.status.value,
                    "stopped_at": current_stats.get("stopped_at"),
                    "stopped_by": current_stats.get("stopped_by"),
                })

        if job.status != JobStatus.PROCESSING:
            logger.warning(
                f"Accepting recoverable GPU result for job {job_id}: "
                f"current status={job.status.value}"
            )

        job.status           = JobStatus.COMPLETED
        job.completed_at     = datetime.utcnow()
        job.error_message    = None
        job.processing_stats = {
            **current_stats,
            **(result.get("summary", {}) or {}),
        }

        detections_data = result.get("detections", [])
        if not job.city_code:
            gps_points = [
                det.get("location") or det.get("gps")
                for det in detections_data
                if det.get("location") or det.get("gps")
            ]
            try:
                locality = resolve_gps_trace_locality({"gps_points": gps_points})
                if locality:
                    job.region = locality["region"]
                    job.region_code = locality["region_code"]
                    job.city = locality["city"]
                    job.city_code = locality["city_code"]
            except HTTPException as exc:
                logger.warning(
                    f"Could not assign result jurisdiction for job {job_id}: {exc.detail}"
                )
        stored_count = 0
        skipped_count = 0

        db.query(Detection).filter(Detection.job_id == job_id).delete(synchronize_session=False)
        db.query(Report).filter(Report.job_id == job_id).delete(synchronize_session=False)

        for det in detections_data:
            location = det.get("location") or {}
            lat = location.get("latitude")
            lng = location.get("longitude")

            if lat is None or lng is None:
                skipped_count += 1
                logger.warning(
                    "Detection skipped because it has no GPS coordinates: "
                    f"job={job_id}, detection_id={det.get('detection_id')}, "
                    f"gps_match_status={det.get('gps_match_status')}"
                )
                continue

            valid_lat, _ = FieldValidator.validate_latitude(lat)
            valid_lng, _ = FieldValidator.validate_longitude(lng)
            if not valid_lat or not valid_lng:
                skipped_count += 1
                logger.warning(f"Invalid coordinates skipped: lat={lat}, lng={lng}")
                continue

            try:
                class_enum = DetectionClass[det["class_name"].upper()]
            except (KeyError, ValueError):
                skipped_count += 1
                logger.error(f"Unknown class name: {det['class_name']}")
                continue

            video_data = det.get("video_data") or {}
            bbox = _clean_bbox(video_data.get("bbox"))
            if not bbox:
                skipped_count += 1
                logger.warning(
                    "Detection skipped because it has an invalid bbox: "
                    f"job={job_id}, detection_id={det.get('detection_id')}, bbox={video_data.get('bbox')}"
                )
                continue

            image_url = _image_filename(det.get("image_path"))
            frame_url = _image_filename(det.get("frame_path"))

            detection = Detection(
                id=det["detection_id"],
                job_id=job_id,
                track_id=int(det["track_id"]),
                class_name=class_enum,
                confidence=det["confidence"],
                severity=Severity[det["severity"].upper()],
                status=DetectionStatus.UNVERIFIED,
                latitude=lat,
                longitude=lng,
                gps_accuracy=location.get("accuracy") or 0.0,
                interpolated=location.get("interpolated", False),
                frame_number=video_data["frame_number"],
                timestamp=video_data["timestamp"],
                bbox=bbox,
                image_url=image_url,
                frame_url=frame_url,
                created_at=datetime.utcnow(),
            )
            try:
                with db.begin_nested():
                    db.add(detection)
                    db.flush()
                stored_count += 1
            except SQLAlchemyError:
                skipped_count += 1
                logger.exception(
                    "Detection insert skipped after database error: "
                    f"job={job_id}, detection_id={det.get('detection_id')}, "
                    f"class={det.get('class_name')}, track_id={det.get('track_id')}, "
                    f"bbox={bbox}, image_url={image_url}"
                )
                continue

        processing_stats = dict(job.processing_stats or {})
        processing_stats["stored_detections"] = stored_count
        processing_stats["skipped_detections_without_gps"] = skipped_count
        job.processing_stats = processing_stats

        report = Report(
            id=result["report_metadata"]["report_id"],
            job_id=job_id,
            video_filename=job.video_filename,
            user_id=job.user_id,
            total_detections=stored_count,
            processing_stats=processing_stats,
            generated_at=datetime.utcnow(),
        )
        db.add(report)
        db.commit()

        logger.info(f"Results stored for job {job_id}: {stored_count} detections, {skipped_count} skipped")
        return {
            "success":          True,
            "message":          "Results stored successfully",
            "total_detections": stored_count,
            "skipped_detections_without_gps": skipped_count,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception(f"Error storing results for job {job_id}: {e}")
        raise HTTPException(500, ErrorMessages.DATABASE_ERROR)
