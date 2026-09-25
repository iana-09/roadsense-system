"""
GPU Worker API Server - Receives processing requests from Web Server
Runs on your PC with RTX 4050
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn
import os
import cv2
import json
import httpx
import asyncio
import re
from pathlib import Path
from datetime import datetime
import traceback

from detector.yolo_detector import YOLODetector
from detector.tracker import Tracker
from detector.utils import save_crop
from detector.image_utils import draw_multiple_detections, save_detection_image

try:
    from gps_matcher import GPSMatcher
    from detection_reporter import DetectionReporter
    HAS_GPS_MODULES = True
except ImportError:
    HAS_GPS_MODULES = False
    print("GPS modules not found - will process without GPS matching")

try:
    from dashcam_gps import extract_gps_from_70mai, convert_to_gps_trace
    HAS_DASHCAM_GPS = True
except ImportError:
    HAS_DASHCAM_GPS = False
    print("dashcam_gps module not found - 70mai GPS extraction disabled")

# ============================================================================
# CONFIGURATION
# ============================================================================

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent


def load_env_defaults(*env_paths: Path) -> None:
    """Load simple KEY=VALUE lines without overriding existing environment."""
    for env_path in env_paths:
        if not env_path.exists():
            continue

        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


load_env_defaults(BASE_DIR / ".env", PROJECT_ROOT / "Web_Server" / ".env")


def resolve_model_path() -> Path:
    configured = os.getenv("ROADSENSE_MODEL_PATH")
    candidates = [
        Path(configured) if configured else None,
        BASE_DIR / "models" / "best.pt",
        PROJECT_ROOT / "runs" / "detect" / "train-2" / "weights" / "best.pt",
        PROJECT_ROOT / "runs" / "train_final2" / "weights" / "best.pt",
        PROJECT_ROOT / "runs" / "train_batch2" / "weights" / "best.pt",
        BASE_DIR / "yolov8n.pt",
    ]

    for candidate in candidates:
        if candidate and candidate.exists():
            return candidate

    return candidates[1]


TRAINED_MODEL_PATH = resolve_model_path()
TEMP_DIR    = BASE_DIR / "temp"
OUTPUT_DIR  = BASE_DIR / "output_crops"
REPORTS_DIR = BASE_DIR / "reports"
PREVIEW_DIR = BASE_DIR / "previews"
FRAMES_DIR  = BASE_DIR / "frames"

TEMP_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
REPORTS_DIR.mkdir(exist_ok=True)
PREVIEW_DIR.mkdir(exist_ok=True)
FRAMES_DIR.mkdir(exist_ok=True)

WEB_SERVER_URL = os.getenv(
    "WEB_SERVER_URL",
    "https://roadsense-backend-fggpeue5bjdshvek.eastus-01.azurewebsites.net",
).rstrip("/")
GPU_WORKER_API_KEY = os.getenv("GPU_WORKER_API_KEY", "")

# ============================================================================
# APP + MODELS
# ============================================================================

app = FastAPI(
    title="RoadSense GPU Worker",
    description="GPU-accelerated video processing with YOLOv8 + DeepSORT",
    version="1.0.0"
)

detector = None
tracker  = None


@app.on_event("startup")
async def startup_event():
    global detector, tracker
    print("=" * 60)
    print("GPU WORKER STARTING...")
    print(f"Model: {TRAINED_MODEL_PATH}")
    print(f"Web server: {WEB_SERVER_URL}")
    print("=" * 60)

    if not TRAINED_MODEL_PATH.exists():
        print("WARNING: Model file not found - detector will be None until fixed.")
        return

    try:
        detector = YOLODetector(str(TRAINED_MODEL_PATH))
        tracker  = Tracker()
        print("Models loaded successfully!")
    except Exception as e:
        print(f"Failed to load models: {e}")
        traceback.print_exc()

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class ProcessingRequest(BaseModel):
    job_id:          str
    video_url:       str
    gps_url:         Optional[str]  = None
    user_id:         Optional[str]  = None
    dashcam_mode:    bool           = False
    dashcam_has_gps: bool           = False
    reject_no_detections: bool      = True
    media_type:      str            = "video"
    location:        Optional[dict] = None

class ProcessingResponse(BaseModel):
    success: bool
    message: str
    job_id:  str

# ============================================================================
# HEALTH ENDPOINTS
# ============================================================================

@app.get("/")
def root():
    return {
        "status":  "online",
        "service": "RoadSense GPU Worker",
        "version": "1.0.0",
        "gpu":     "RTX 4050",
        "models": {
            "yolov8":   "loaded" if detector else "not loaded",
            "deepsort": "loaded" if tracker  else "not loaded",
        },
        "dashcam_gps": HAS_DASHCAM_GPS,
    }

@app.get("/status")
def get_status():
    import torch
    return {
        "status":         "ready",
        "cuda_available": torch.cuda.is_available(),
        "gpu_name":       torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "model_loaded":   detector is not None,
        "tracker_loaded": tracker  is not None,
        "dashcam_gps":    HAS_DASHCAM_GPS,
    }


@app.get("/preview/{job_id}")
def get_processing_preview(job_id: str):
    preview_path = PREVIEW_DIR / f"{job_id}.jpg"
    if not preview_path.exists():
        raise HTTPException(status_code=404, detail="No processing preview available for this job yet.")
    return FileResponse(
        preview_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@app.get("/frame/{filename}")
def get_detection_frame(filename: str):
    safe_name = Path(filename).name
    frame_path = FRAMES_DIR / safe_name
    if not frame_path.exists():
        raise HTTPException(status_code=404, detail="Detection frame not found.")
    return FileResponse(frame_path, media_type="image/jpeg")


@app.get("/crop/{filename}")
def get_detection_crop(filename: str):
    if "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid crop filename.")

    crop_path = OUTPUT_DIR / filename
    if not crop_path.exists():
        match = re.search(r"_crop_(\d+)\.jpe?g$", filename, re.IGNORECASE)
        if match:
            crop_path = OUTPUT_DIR / f"det_{match.group(1)}.jpg"

    if not crop_path.exists():
        raise HTTPException(status_code=404, detail="Detection crop not found.")

    return FileResponse(
        crop_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store, max-age=0"},
    )

# ============================================================================
# PROCESSING ENDPOINT
# ============================================================================

@app.post("/process", response_model=ProcessingResponse)
async def process_video(request: ProcessingRequest, background_tasks: BackgroundTasks):
    # Dashcam jobs with no video yet are fine — they skip YOLO
    if not request.dashcam_mode and (detector is None or tracker is None):
        raise HTTPException(status_code=503, detail="Models not loaded yet - check server logs.")

    print(f"\n{'='*60}")
    print(f"Job: {request.job_id} | dashcam_mode={request.dashcam_mode} | dashcam_has_gps={request.dashcam_has_gps}")
    print(f"{'='*60}")

    background_tasks.add_task(
        process_video_task,
        job_id=request.job_id,
        video_url=request.video_url,
        gps_url=request.gps_url,
        user_id=request.user_id,
        dashcam_mode=request.dashcam_mode,
        dashcam_has_gps=request.dashcam_has_gps,
        reject_no_detections=request.reject_no_detections,
        media_type=request.media_type,
        location=request.location,
    )

    return ProcessingResponse(success=True, message="Processing started", job_id=request.job_id)

# ============================================================================
# BACKGROUND TASK
# ============================================================================

async def process_video_task(
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
    try:
        await update_job_status(job_id, "processing")

        # ── DASHCAM MODE ──────────────────────────────────────────────────────
        # Video is on the SD card — store GPS trace, mark pending_video.
        # When user uploads the video via web dashboard, web server calls
        # /process again with dashcam_mode=False to complete YOLO processing.
        if dashcam_mode:
            await handle_dashcam_job(job_id, gps_url, user_id, dashcam_has_gps)
            return

        # ── NORMAL MODE ───────────────────────────────────────────────────────
        is_photo = media_type == "photo"
        media_path = TEMP_DIR / f"{job_id}{'.jpg' if is_photo else '.mp4'}"
        print(f"Downloading {'photo' if is_photo else 'video'}...")
        await download_file(video_url, media_path)

        gps_path = None
        if gps_url and HAS_GPS_MODULES and not is_photo:
            gps_path = TEMP_DIR / f"{job_id}_gps.json"
            print("Downloading GPS trace...")
            await download_file(gps_url, gps_path)

        if dashcam_has_gps and HAS_DASHCAM_GPS:
            print("Checking video for embedded GPS metadata...")
            points = extract_gps_from_70mai(str(media_path))
            if points:
                gps_path = TEMP_DIR / f"{job_id}_atom_gps.json"
                with open(gps_path, 'w') as f:
                    json.dump(convert_to_gps_trace(points), f)
                print(f"Embedded GPS metadata accepted ({len(points)} points)")
            elif not gps_path:
                raise ValueError("No readable GPS metadata found in the dashcam video, and no phone GPS trace was uploaded.")

        if is_photo:
            print("Running YOLO inference on photo...")
            detections = process_photo_with_yolo(str(media_path), job_id, location)
        else:
            print("Running YOLOv8 + DeepSORT...")
            detections = process_video_with_yolo(str(media_path), job_id)
        print_detection_summary(detections)

        if reject_no_detections and not detections:
            raise ValueError("No road distress detected in this upload. Use a clear road-facing photo or video with visible potholes, cracks, or road patching.")

        if not is_photo and (gps_path or dashcam_has_gps) and HAS_GPS_MODULES:
            print("Matching GPS coordinates...")
            detections = match_gps_coordinates(
                detections, str(gps_path) if gps_path else None, str(media_path),
                dashcam_has_gps=dashcam_has_gps
            )

            if reject_no_detections and not detections:
                raise ValueError("Road distress was detected, but none could be matched to GPS coordinates.")

        report = generate_report(detections, job_id, user_id)
        report_path = REPORTS_DIR / f"{job_id}_report.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)

        results_saved = await send_results_to_server(job_id, report)
        if not results_saved:
            raise ValueError("GPU finished locally, but the web server rejected or failed to store the results.")

        await upload_detection_crops_to_server(report)

        media_path.unlink(missing_ok=True)
        if gps_path:
            Path(gps_path).unlink(missing_ok=True)

        print(f"Job {job_id} completed!")

    except Exception as e:
        print(f"Error on job {job_id}: {e}")
        traceback.print_exc()
        await update_job_status(job_id, "failed", error_message=str(e))


async def handle_dashcam_job(job_id, gps_url, user_id, dashcam_has_gps):
    """
    Store the phone GPS trace and set job to pending_video.
    Full YOLO processing runs when the user uploads the dashcam video
    via the web dashboard (web server calls /process again, dashcam_mode=False).
    At that point match_gps_coordinates will extract from the 70mai MP4 atom
    if dashcam_has_gps=True, otherwise uses the phone trace stored here.
    """
    print(f"Dashcam job {job_id} — storing GPS, awaiting video")

    gps_path = None
    if gps_url and HAS_GPS_MODULES:
        gps_path = TEMP_DIR / f"{job_id}_gps.json"
        await download_file(gps_url, gps_path)
        print(f"Phone GPS saved: {gps_path}")

    meta = {
        'job_id':          job_id,
        'dashcam_mode':    True,
        'dashcam_has_gps': dashcam_has_gps,
        'status':          'pending_video',
        'gps_path':        str(gps_path) if gps_path else None,
        'created_at':      datetime.now().isoformat(),
        'user_id':         user_id,
    }
    with open(REPORTS_DIR / f"{job_id}_dashcam_meta.json", 'w') as f:
        json.dump(meta, f, indent=2)

    await update_job_status(job_id, "pending_video")
    print(f"Job {job_id} waiting for dashcam video upload via web dashboard")

# ============================================================================
# PROCESSING FUNCTIONS
# ============================================================================

def process_video_with_yolo(video_path: str, job_id: str):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    fps          = int(cap.get(cv2.CAP_PROP_FPS))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"  FPS: {fps} | Frames: {total_frames}")

    frame_count   = 0
    unique_tracks = {}
    saved_ids     = set()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        detections = detector.detect(frame)
        tracks     = tracker.update(detections, frame)
        tracks     = sanitize_tracks(tracks, frame.shape)
        save_processing_preview(frame, tracks, job_id, frame_count, total_frames)

        for track in tracks:
            track_id   = track["track_id"]
            bbox       = track["bbox"]
            class_name = track.get("class_name", "unknown")
            confidence = track.get("confidence", 0.0)

            if track_id not in unique_tracks:
                unique_tracks[track_id] = {
                    'track_id':         track_id,
                    'class_name':       class_name,
                    'confidence':       confidence,
                    'first_seen_frame': frame_count,
                    'last_seen_frame':  frame_count,
                    'bbox':             bbox,
                    'crop_path':        None,
                    'frame_path':       None,
                }
            else:
                unique_tracks[track_id]['last_seen_frame'] = frame_count

            if track_id not in saved_ids:
                crop_path = save_crop(frame, bbox, str(OUTPUT_DIR), track_id, f"{job_id}_crop_{track_id}.jpg")
                frame_detection = {
                    **track,
                    "frame_number": frame_count,
                }
                frame_path = save_detection_image(
                    frame,
                    frame_detection,
                    str(FRAMES_DIR / f"{job_id}_frame_{track_id}.jpg"),
                )
                unique_tracks[track_id]['crop_path'] = crop_path
                unique_tracks[track_id]['frame_path'] = frame_path
                saved_ids.add(track_id)

        if frame_count % 100 == 0:
            print(f"  {frame_count/total_frames*100:.1f}% | Objects: {len(unique_tracks)}")

    cap.release()
    return list(unique_tracks.values())


def process_photo_with_yolo(photo_path: str, job_id: str, location: dict = None):
    frame = cv2.imread(photo_path)
    if frame is None:
        raise ValueError(f"Cannot open photo: {photo_path}")

    detections = detector.detect(frame)
    formatted = []
    preview_tracks = []

    for index, detection in enumerate(detections, start=1):
        bbox = sanitize_bbox(detection.get("bbox"), frame.shape)
        if not bbox:
            continue

        crop_path = save_crop(
            frame,
            bbox,
            str(OUTPUT_DIR),
            index,
            f"{job_id}_crop_{index}.jpg",
        )
        frame_path = save_detection_image(
            frame,
            {
                **detection,
                "track_id": index,
                "frame_number": 1,
                "bbox": bbox,
            },
            str(FRAMES_DIR / f"{job_id}_frame_{index}.jpg"),
        )
        formatted.append({
            "track_id": index,
            "class_name": detection.get("class_name", "unknown"),
            "confidence": detection.get("confidence", 0.0),
            "first_seen_frame": 1,
            "last_seen_frame": 1,
            "frame_number": 1,
            "timestamp": 0.001,
            "bbox": bbox,
            "crop_path": crop_path,
            "frame_path": frame_path,
            "location": {
                **(location or {}),
                "interpolated": False,
            },
            "gps_match_status": "matched" if location else "missing",
        })
        preview_tracks.append({
            "track_id": index,
            "class_name": detection.get("class_name", "unknown"),
            "confidence": detection.get("confidence", 0.0),
            "bbox": bbox,
        })

    preview = draw_multiple_detections(frame, preview_tracks)
    cv2.imwrite(str(PREVIEW_DIR / f"{job_id}.jpg"), preview, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return formatted


def sanitize_bbox(bbox, frame_shape, min_size=2):
    if not bbox or len(bbox) != 4:
        return None

    height, width = frame_shape[:2]
    try:
        x1, y1, x2, y2 = [float(value) for value in bbox]
    except (TypeError, ValueError):
        return None

    left = max(0, min(x1, x2))
    right = min(width - 1, max(x1, x2))
    top = max(0, min(y1, y2))
    bottom = min(height - 1, max(y1, y2))

    if right - left < min_size or bottom - top < min_size:
        return None

    return [left, top, right, bottom]


def sanitize_tracks(tracks, frame_shape):
    clean_tracks = []
    for track in tracks:
        bbox = sanitize_bbox(track.get("bbox"), frame_shape)
        if not bbox:
            continue
        clean_track = dict(track)
        clean_track["bbox"] = bbox
        clean_tracks.append(clean_track)
    return clean_tracks


def print_detection_summary(detections):
    labels = [
        ("pothole_major", "Major potholes"),
        ("pothole_minor", "Minor potholes"),
        ("crack", "Cracks"),
        ("road_patching", "Road patches"),
        ("unknown", "Unknown"),
    ]
    counts = {key: 0 for key, _ in labels}

    for detection in detections:
        class_name = detection.get("class_name") or "unknown"
        counts[class_name if class_name in counts else "unknown"] += 1

    print("Detection summary:")
    for key, label in labels:
        print(f"  {label}: {counts[key]}")
    print(f"Found {len(detections)} unique objects")


def save_processing_preview(frame, tracks, job_id: str, frame_count: int, total_frames: int):
    try:
        preview = draw_multiple_detections(frame, tracks)
        progress = (frame_count / total_frames * 100) if total_frames else 0
        label = f"Job {job_id[:8]} | Frame {frame_count}/{total_frames} | {progress:.1f}%"
        cv2.rectangle(preview, (8, 8), (min(760, preview.shape[1] - 8), 48), (0, 0, 0), -1)
        cv2.putText(
            preview,
            label,
            (18, 36),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 255),
            2,
        )
        cv2.imwrite(str(PREVIEW_DIR / f"{job_id}.jpg"), preview, [cv2.IMWRITE_JPEG_QUALITY, 82])
    except Exception as e:
        print(f"Preview update failed: {e}")


def match_gps_coordinates(detections, gps_path: str = None, video_path: str = None, dashcam_has_gps: bool = False):
    if not HAS_GPS_MODULES:
        return detections

    try:
        active_gps_path = gps_path

        # Try 70mai atom extraction first when dashcam has GPS
        if dashcam_has_gps and HAS_DASHCAM_GPS:
            print("Extracting GPS from 70mai MP4 atom...")
            points = extract_gps_from_70mai(video_path)
            if points:
                trace = convert_to_gps_trace(points)
                atom_path = (
                    gps_path.replace('_gps.json', '_atom_gps.json')
                    if gps_path else str(TEMP_DIR / f"{Path(video_path).stem}_atom_gps.json")
                )
                with open(atom_path, 'w') as f:
                    json.dump(trace, f)
                active_gps_path = atom_path
                print(f"Using 70mai atom GPS ({len(points)} points)")
            else:
                print("No GPS atom found — using phone GPS trace")

        if not active_gps_path:
            print("No GPS trace available - keeping detections without coordinates")
            return detections

        cap = cv2.VideoCapture(video_path)
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        cap.release()

        matcher = GPSMatcher(active_gps_path, video_fps=fps)
        return matcher.match_detections(detections)

    except Exception as e:
        print(f"GPS matching failed: {e}")
        return detections


def generate_report(detections, job_id: str, user_id: str = None):
    if not HAS_GPS_MODULES:
        return {
            'report_metadata': {
                'report_id': job_id, 'generated_at': datetime.now().isoformat(),
                'job_id': job_id, 'user_id': user_id,
            },
            'summary':    {'total_detections': len(detections), 'detections_by_class': {}},
            'detections': detections,
        }
    try:
        reporter = DetectionReporter(video_filename=f"{job_id}.mp4", user_id=user_id)
        return reporter.generate_report(detections, {'total_detections': len(detections)})
    except Exception as e:
        print(f"Report generation failed: {e}")
        return {
            'report_metadata': {'report_id': job_id, 'generated_at': datetime.now().isoformat()},
            'summary':         {'total_detections': len(detections)},
            'detections':      detections,
        }

# ============================================================================
# WEB SERVER COMMUNICATION
# ============================================================================

async def download_file(url: str, save_path: Path):
    async with httpx.AsyncClient() as client:
        r = await client.get(url, timeout=300.0)
        r.raise_for_status()
        with open(save_path, 'wb') as f:
            f.write(r.content)


async def update_job_status(job_id: str, status: str, error_message: str = None):
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{WEB_SERVER_URL}/api/jobs/{job_id}/status",
                json={"status": status, "error_message": error_message},
                headers={"X-Worker-Key": GPU_WORKER_API_KEY},
                timeout=30.0,
            )
            print(f"Status -> {status}: {'OK' if r.status_code == 200 else r.text}")
    except Exception as e:
        print(f"Error updating status: {e}")


async def send_results_to_server(job_id: str, report: dict):
    retry_delays = (0, 5, 15)
    async with httpx.AsyncClient() as client:
        for attempt, delay in enumerate(retry_delays, start=1):
            if delay:
                print(f"Retrying result delivery in {delay} seconds...")
                await asyncio.sleep(delay)
            try:
                r = await client.post(
                    f"{WEB_SERVER_URL}/api/process/result/{job_id}",
                    json=report,
                    headers={"X-Worker-Key": GPU_WORKER_API_KEY},
                    timeout=120.0,
                )
                if r.status_code == 200:
                    print("Results sent: OK")
                    return True

                print(f"Results attempt {attempt}/{len(retry_delays)} failed: {r.status_code} {r.text}")
                if 400 <= r.status_code < 500 and r.status_code not in (408, 409, 429):
                    return False
            except Exception as e:
                print(f"Results attempt {attempt}/{len(retry_delays)} failed: {e}")

    return False


async def upload_detection_crops_to_server(report: dict):
    detections = report.get("detections") or []
    if not detections:
        return

    if not GPU_WORKER_API_KEY:
        print(
            "WARNING: GPU_WORKER_API_KEY is not set. "
            "Detection image/frame uploads will be rejected by the web server."
        )

    crop_success = 0
    crop_failed = 0
    frame_success = 0
    frame_failed = 0
    async with httpx.AsyncClient() as client:
        for det in detections:
            detection_id = det.get("detection_id")
            if not detection_id:
                continue

            image_path = det.get("image_path")
            if image_path:
                crop_path = Path(image_path)
                if not crop_path.exists():
                    print(f"Crop missing for detection {detection_id}: {crop_path}")
                    crop_failed += 1
                else:
                    uploaded = False
                    for attempt, delay in enumerate((0, 3, 8), start=1):
                        if delay:
                            await asyncio.sleep(delay)
                        try:
                            with open(crop_path, "rb") as f:
                                files = {"file": (crop_path.name, f, "image/jpeg")}
                                r = await client.post(
                                    f"{WEB_SERVER_URL}/api/detections/{detection_id}/image",
                                    files=files,
                                    headers={"X-Worker-Key": GPU_WORKER_API_KEY},
                                    timeout=120.0,
                                )
                            if r.status_code == 200:
                                print(f"Crop upload {detection_id}: OK")
                                crop_success += 1
                                uploaded = True
                                break
                            print(f"Crop upload {detection_id} attempt {attempt}/3 failed: {r.status_code} {r.text}")
                            if 400 <= r.status_code < 500 and r.status_code not in (408, 429):
                                break
                        except Exception as e:
                            print(f"Error uploading crop for detection {detection_id} attempt {attempt}/3: {e}")
                    if not uploaded:
                        crop_failed += 1

            frame_path_value = det.get("frame_path")
            if not frame_path_value:
                continue
            frame_path = Path(frame_path_value)
            if not frame_path.exists():
                print(f"Frame missing for detection {detection_id}: {frame_path}")
                frame_failed += 1
                continue

            uploaded = False
            for attempt, delay in enumerate((0, 3, 8), start=1):
                if delay:
                    await asyncio.sleep(delay)
                try:
                    with open(frame_path, "rb") as f:
                        files = {"file": (frame_path.name, f, "image/jpeg")}
                        r = await client.post(
                            f"{WEB_SERVER_URL}/api/detections/{detection_id}/frame",
                            files=files,
                            headers={"X-Worker-Key": GPU_WORKER_API_KEY},
                            timeout=120.0,
                        )
                    if r.status_code == 200:
                        print(f"Frame upload {detection_id}: OK")
                        frame_success += 1
                        uploaded = True
                        break
                    print(f"Frame upload {detection_id} attempt {attempt}/3 failed: {r.status_code} {r.text}")
                    if 400 <= r.status_code < 500 and r.status_code not in (408, 429):
                        break
                except Exception as e:
                    print(f"Error uploading frame for detection {detection_id} attempt {attempt}/3: {e}")
            if not uploaded:
                frame_failed += 1

    print(
        "Detection asset upload summary: "
        f"crops {crop_success} OK/{crop_failed} failed, "
        f"frames {frame_success} OK/{frame_failed} failed"
    )

# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("STARTING GPU WORKER API SERVER")
    print(f"Model:      {TRAINED_MODEL_PATH}")
    print(f"Output:     {OUTPUT_DIR}")
    print(f"Reports:    {REPORTS_DIR}")
    print(f"Web Server: {WEB_SERVER_URL}")
    print("="*60 + "\n")

    uvicorn.run("gpu_server:app", host="0.0.0.0", port=8001, reload=False)
