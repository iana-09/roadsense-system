"""
GPU Worker Service for RoadSense
Handles communication with the GPU processing worker.
"""

import httpx
import logging
from config import settings

logger = logging.getLogger(__name__)


def get_gpu_worker_status():
    """Fetch the GPU worker health/status payload for dashboard monitoring."""
    try:
        response = httpx.get(
            f"{settings.GPU_WORKER_URL}/status",
            headers={"ngrok-skip-browser-warning": "true"},
            timeout=10.0,
        )
        if response.status_code == 200:
            return {
                "online": True,
                "url": settings.GPU_WORKER_URL,
                "status_code": response.status_code,
                "data": response.json(),
            }

        return {
            "online": False,
            "url": settings.GPU_WORKER_URL,
            "status_code": response.status_code,
            "error": response.text,
        }
    except Exception as e:
        logger.error(f"Failed to fetch GPU Worker status: {e}")
        return {
            "online": False,
            "url": settings.GPU_WORKER_URL,
            "error": str(e),
        }


def get_gpu_worker_preview(job_id: str):
    """Fetch the latest annotated processing preview image for a job."""
    try:
        response = httpx.get(
            f"{settings.GPU_WORKER_URL}/preview/{job_id}",
            headers={"ngrok-skip-browser-warning": "true"},
            timeout=10.0,
        )
        if response.status_code == 200:
            return {
                "success": True,
                "content": response.content,
                "content_type": response.headers.get("content-type", "image/jpeg"),
            }

        return {
            "success": False,
            "status_code": response.status_code,
            "error": response.text,
        }
    except Exception as e:
        logger.error(f"Failed to fetch GPU Worker preview: {e}")
        return {
            "success": False,
            "error": str(e),
        }


def get_gpu_worker_crop(filename: str):
    """Fetch a saved hazard crop image from the GPU worker."""
    try:
        response = httpx.get(
            f"{settings.GPU_WORKER_URL}/crop/{filename}",
            headers={"ngrok-skip-browser-warning": "true"},
            timeout=10.0,
        )
        if response.status_code == 200:
            return {
                "success": True,
                "content": response.content,
                "content_type": response.headers.get("content-type", "image/jpeg"),
            }

        return {
            "success": False,
            "status_code": response.status_code,
            "error": response.text,
        }
    except Exception as e:
        logger.error(f"Failed to fetch GPU Worker crop: {e}")
        return {
            "success": False,
            "error": str(e),
        }


def get_gpu_worker_frame(filename: str):
    """Fetch a saved full detection frame from the GPU worker."""
    try:
        response = httpx.get(
            f"{settings.GPU_WORKER_URL}/frame/{filename}",
            headers={"ngrok-skip-browser-warning": "true"},
            timeout=10.0,
        )
        if response.status_code == 200:
            return {
                "success": True,
                "content": response.content,
                "content_type": response.headers.get("content-type", "image/jpeg"),
            }

        return {
            "success": False,
            "status_code": response.status_code,
            "error": response.text,
        }
    except Exception as e:
        logger.error(f"Failed to fetch GPU Worker frame: {e}")
        return {
            "success": False,
            "error": str(e),
        }


def trigger_gpu_processing(
    job_id: str,
    video_url: str,
    gps_url: str = None,
    user_id: str = None,
    dashcam_mode: bool = False,
    dashcam_has_gps: bool = False,
    reject_no_detections: bool = True,
    media_type: str = "video",
    location: dict = None,
):
    """Send a processing request to the GPU Worker (runs in background)."""
    try:
        response = httpx.post(
            f"{settings.GPU_WORKER_URL}/process",
            json={
                "job_id":    job_id,
                "video_url": video_url,
                "gps_url":   gps_url,
                "user_id":   user_id,
                "dashcam_mode": dashcam_mode,
                "dashcam_has_gps": dashcam_has_gps,
                "reject_no_detections": reject_no_detections,
                "media_type": media_type,
                "location": location,
            },
            headers={"ngrok-skip-browser-warning": "true"},
            timeout=30.0,
        )

        if response.status_code == 200:
            logger.info(f"GPU Worker processing started for job: {job_id}")
            return True

        logger.error(f"GPU Worker error: {response.text}")
        return False

    except Exception as e:
        logger.error(f"Failed to contact GPU Worker: {e}")
        return False
