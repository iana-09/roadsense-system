"""
Uploads Router
POST /api/upload/video
POST /api/upload/gps/{job_id}
"""

import uuid
import logging
import json
from datetime import datetime
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from config import settings
from database import get_db, Job, JobStatus
from models import DashcamSessionRequest, UploadResponse
from azure_storage import azure_storage
from error_messages import ErrorMessages
from validators import FieldValidator
from field_constants import FieldLimits
from services.gpu_service import trigger_gpu_processing
from services.philippine_locations import resolve_gps_trace_locality

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/upload", tags=["Uploads"])
DASHCAM_PENDING_VIDEO_URL = "dashcam://pending"


@router.post("/video", response_model=UploadResponse)
def upload_video(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    is_anonymous: bool = Form(True),
    db: Session = Depends(get_db),
):
    valid, error = FieldValidator.validate_filename(file.filename, "video")
    if not valid:
        raise HTTPException(400, error)

    if user_id:
        valid, error = FieldValidator.validate_user_id(user_id)
        if not valid:
            raise HTTPException(400, error)

    file_data = file.file.read()
    valid, error = FieldValidator.validate_file_size(len(file_data), FieldLimits.MAX_VIDEO_SIZE_MB)
    if not valid:
        raise HTTPException(400, error)

    job_id = str(uuid.uuid4())

    try:
        video_url = azure_storage.upload_video(BytesIO(file_data), file.filename, job_id)
        if not video_url:
            raise HTTPException(500, "Failed to upload video to Azure Blob Storage")

        job = Job(
            id=job_id,
            status=JobStatus.PENDING,
            video_filename=file.filename,
            video_url=video_url,
            gps_url="pending",
            user_id=user_id,
            is_anonymous=is_anonymous,
            attribution_opt_in=not is_anonymous,
            created_at=datetime.utcnow(),
        )
        db.add(job)
        db.commit()
        logger.info(f"Video uploaded: {job_id}")

        # TEMP: allow video-only processing so we can verify GPU worker routing.
        # Revert this once GPS should be required again.
        processing_started = trigger_gpu_processing(
            job_id=job_id,
            video_url=azure_storage.get_read_url_from_blob_url(video_url),
            gps_url=None,
            user_id=user_id,
            dashcam_mode=False,
            dashcam_has_gps=False,
        )
        if processing_started:
            job.status = JobStatus.PROCESSING
            job.started_at = datetime.utcnow()
            db.commit()
        else:
            logger.warning(f"GPU worker did not accept video-only job: {job_id}")

        return UploadResponse(
            success=True,
            message="Video uploaded successfully to Azure; processing started" if processing_started else "Video uploaded successfully to Azure",
            job_id=job_id,
            filename=file.filename,
        )

    except Exception as e:
        db.rollback()
        logger.error(f"Upload failed: {e}")
        raise HTTPException(500, ErrorMessages.UPLOAD_FAILED)


@router.post("/photo", response_model=UploadResponse)
def upload_photo(
    file: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    gps_accuracy: Optional[float] = Form(None),
    user_id: Optional[str] = Form(None),
    is_anonymous: bool = Form(True),
    db: Session = Depends(get_db),
):
    valid, error = FieldValidator.validate_filename(file.filename, "image")
    if not valid:
        raise HTTPException(400, error)

    valid_lat, error = FieldValidator.validate_latitude(latitude)
    if not valid_lat:
        raise HTTPException(400, error)
    valid_lng, error = FieldValidator.validate_longitude(longitude)
    if not valid_lng:
        raise HTTPException(400, error)
    if gps_accuracy is not None and gps_accuracy < 0:
        raise HTTPException(400, "GPS accuracy must be zero or greater")

    if user_id:
        valid, error = FieldValidator.validate_user_id(user_id)
        if not valid:
            raise HTTPException(400, error)

    file_data = file.file.read()
    valid, error = FieldValidator.validate_file_size(
        len(file_data), FieldLimits.MAX_IMAGE_SIZE_MB
    )
    if not valid:
        raise HTTPException(400, error)

    job_id = str(uuid.uuid4())
    location = {
        "latitude": latitude,
        "longitude": longitude,
        "accuracy": gps_accuracy or 0.0,
        "interpolated": False,
    }

    try:
        image_url = azure_storage.upload_photo(BytesIO(file_data), file.filename, job_id)
        if not image_url:
            raise HTTPException(500, "Failed to upload photo to Azure Blob Storage")

        job = Job(
            id=job_id,
            status=JobStatus.PENDING,
            video_filename=file.filename,
            video_url=image_url,
            gps_filename=None,
            gps_url="photo://coordinates",
            user_id=user_id,
            is_anonymous=is_anonymous,
            attribution_opt_in=not is_anonymous,
            created_at=datetime.utcnow(),
            processing_stats={
                "media_type": "photo",
                "source": "mobile_photo",
                "location": location,
            },
        )

        try:
            locality = resolve_gps_trace_locality({"gps_points": [location]})
            if locality:
                job.region = locality["region"]
                job.region_code = locality["region_code"]
                job.city = locality["city"]
                job.city_code = locality["city_code"]
        except HTTPException as exc:
            logger.warning(f"Could not assign photo jurisdiction for job {job_id}: {exc.detail}")

        db.add(job)
        db.commit()

        processing_started = trigger_gpu_processing(
            job_id=job_id,
            video_url=azure_storage.get_read_url_from_blob_url(image_url),
            user_id=user_id,
            media_type="photo",
            location=location,
        )
        if processing_started:
            job.status = JobStatus.PROCESSING
            job.started_at = datetime.utcnow()
        else:
            job.status = JobStatus.FAILED
            job.error_message = f"GPU Worker unreachable at {settings.GPU_WORKER_URL}"
            job.completed_at = datetime.utcnow()
        db.commit()

        return UploadResponse(
            success=True,
            message="Photo uploaded; processing started" if processing_started else "Photo uploaded, but GPU processing could not start",
            job_id=job_id,
            filename=file.filename,
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Photo upload failed: {e}")
        raise HTTPException(500, ErrorMessages.UPLOAD_FAILED)


@router.post("/dashcam-session", response_model=UploadResponse)
def create_dashcam_session(
    payload: DashcamSessionRequest,
    db: Session = Depends(get_db),
):
    if payload.user_id:
        valid, error = FieldValidator.validate_user_id(payload.user_id)
        if not valid:
            raise HTTPException(400, error)

    job_id = str(uuid.uuid4())
    filename = f"dashcam_session_{job_id}.mp4"

    try:
        job = Job(
            id=job_id,
            status=JobStatus.PENDING,
            video_filename=filename,
            video_url=DASHCAM_PENDING_VIDEO_URL,
            gps_url="pending",
            user_id=payload.user_id,
            is_anonymous=payload.is_anonymous,
            attribution_opt_in=not payload.is_anonymous,
            created_at=datetime.utcnow(),
            processing_stats={
                "dashcam_mode": payload.dashcam_mode,
                "dashcam_has_gps": payload.dashcam_has_gps,
                "conn_mode": payload.conn_mode,
                "awaiting_dashcam_video": True,
            },
        )
        db.add(job)
        db.commit()
        logger.info(f"Dashcam session created: {job_id}")

        return UploadResponse(
            success=True,
            message="Dashcam session created. Upload GPS now, then transfer the dashcam video separately.",
            job_id=job_id,
            filename=filename,
        )

    except Exception as e:
        db.rollback()
        logger.error(f"Dashcam session creation failed: {e}")
        raise HTTPException(500, ErrorMessages.UPLOAD_FAILED)


@router.post("/dashcam-video/{job_id}", response_model=UploadResponse)
def upload_dashcam_video(
    job_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    valid, error = FieldValidator.validate_filename(file.filename, "video")
    if not valid:
        raise HTTPException(400, error)

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, ErrorMessages.JOB_NOT_FOUND)

    if job.video_url != DASHCAM_PENDING_VIDEO_URL:
        raise HTTPException(400, "This job already has a video attached")

    try:
        file_data = file.file.read()
        valid, error = FieldValidator.validate_file_size(len(file_data), FieldLimits.MAX_VIDEO_SIZE_MB)
        if not valid:
            raise HTTPException(400, error)

        video_url = azure_storage.upload_video(BytesIO(file_data), file.filename, job_id)
        if not video_url:
            raise HTTPException(500, "Failed to upload video to Azure Blob Storage")

        processing_stats = dict(job.processing_stats or {})
        dashcam_has_gps = bool(processing_stats.get("dashcam_has_gps"))

        processing_stats.update({
            "dashcam_mode": True,
            "awaiting_dashcam_video": False,
            "dashcam_video_attached": True,
        })
        job.video_filename = file.filename
        job.video_url = video_url
        job.processing_stats = processing_stats
        db.commit()
        logger.info(f"Dashcam video uploaded for job: {job_id}")

        has_uploaded_gps = bool(job.gps_url and job.gps_url != "pending")
        # TEMP: allow dashcam video-only processing so we can verify GPU worker routing.
        # Revert this once GPS should be required again.
        processing_started = trigger_gpu_processing(
            job_id=job.id,
            video_url=azure_storage.get_read_url_from_blob_url(video_url),
            gps_url=azure_storage.get_read_url_from_blob_url(job.gps_url) if has_uploaded_gps else None,
            user_id=job.user_id,
            dashcam_mode=False,
            dashcam_has_gps=dashcam_has_gps if has_uploaded_gps else False,
        )
        if processing_started:
            job.status = JobStatus.PROCESSING
            job.started_at = datetime.utcnow()
            db.commit()
        else:
            logger.warning(f"GPU worker did not accept dashcam video job: {job_id}")

        return UploadResponse(
            success=True,
            message="Dashcam video uploaded to Azure Blob Storage",
            job_id=job_id,
            filename=file.filename,
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Dashcam video upload failed: {e}")
        raise HTTPException(500, ErrorMessages.UPLOAD_FAILED)


@router.post("/gps/{job_id}")
def upload_gps(
    job_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    valid, error = FieldValidator.validate_filename(file.filename, "gps")
    if not valid:
        raise HTTPException(400, error)

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, ErrorMessages.JOB_NOT_FOUND)

    try:
        file_data = file.file.read()

        if len(file_data) > settings.MAX_GPS_SIZE:
            raise HTTPException(
                400,
                f"GPS file too large. Max size: {settings.MAX_GPS_SIZE // (1024 * 1024)}MB",
            )

        try:
            gps_payload = json.loads(file_data.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise HTTPException(400, "GPS file must contain valid UTF-8 JSON.")

        gps_url = azure_storage.upload_gps(BytesIO(file_data), job_id)
        if not gps_url:
            raise HTTPException(500, "Failed to upload GPS to Azure Blob Storage")

        job.gps_filename = file.filename
        job.gps_url      = gps_url
        try:
            locality = resolve_gps_trace_locality(gps_payload)
            if locality:
                job.region = locality["region"]
                job.region_code = locality["region_code"]
                job.city = locality["city"]
                job.city_code = locality["city_code"]
        except HTTPException as exc:
            logger.warning(f"Could not assign GPS jurisdiction for job {job_id}: {exc.detail}")
        db.commit()
        logger.info(f"GPS uploaded for job: {job_id}")

        if job.video_url == DASHCAM_PENDING_VIDEO_URL:
            return {
                "success": True,
                "message": "GPS uploaded. Waiting for dashcam video transfer before processing.",
                "job_id":  job_id,
                "gps_url": gps_url,
            }

        processing_stats = dict(job.processing_stats or {})
        is_dashcam = bool(processing_stats.get("dashcam_mode")) or bool(processing_stats.get("dashcam_video_attached"))

        background_tasks.add_task(
            trigger_gpu_processing,
            job_id=job_id,
            video_url=azure_storage.get_read_url_from_blob_url(job.video_url),
            gps_url=azure_storage.get_read_url_from_blob_url(gps_url),
            user_id=job.user_id,
            dashcam_mode=False,
            dashcam_has_gps=bool(processing_stats.get("dashcam_has_gps")) if is_dashcam else False,
        )

        return {
            "success": True,
            "message": "GPS uploaded, processing started",
            "job_id":  job_id,
            "gps_url": gps_url,
            "jurisdiction": {
                "region": job.region,
                "region_code": job.region_code,
                "city": job.city,
                "city_code": job.city_code,
            } if job.city_code else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"GPS upload failed: {e}")
        raise HTTPException(500, ErrorMessages.UPLOAD_FAILED)
