import cv2
import os
import time
from pathlib import Path
from detector.yolo_detector import YOLODetector
from detector.tracker import Tracker
from detector.utils import save_crop
from gps_matcher import GPSMatcher
from detection_reporter import DetectionReporter

# Configuration
VIDEO_FOLDER = "../videos"
GPS_FOLDER = "../gps_traces"
OUTPUT_DIR = "../output_crops"
REPORTS_DIR = "../reports"
TRAINED_MODEL_PATH = r"C:\Users\Sebastian Penaranda\runs\detect\train_run14\weights\best.pt"

# Create directories
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

def process_video_complete(video_path, gps_trace_path, user_id=None):
    """
    Complete processing pipeline:
    1. Detect objects with YOLOv8
    2. Track with DeepSORT
    3. Match to GPS coordinates
    4. Generate report
    5. Save everything
    """
    video_name = Path(video_path).stem
    print(f"\n{'='*60}")
    print(f"PROCESSING: {video_name}")
    print(f"{'='*60}\n")

    # Initialize components
    print("Initializing YOLOv8 + DeepSORT")
    detector = YOLODetector(TRAINED_MODEL_PATH)
    tracker = Tracker()

    # Open video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")
    # Get video properties
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0

    print(f"📹 Video Info:")
    print(f"   - FPS: {fps}")
    print(f"   - Total Frames: {total_frames}")
    print(f"   - Duration: {duration:.2f}s\n")

    # Processing
    print("🔍 Processing frames...")
    frame_count = 0
    unique_tracks = {}
    saved_ids = set()
    start_time = time.time()
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1

        # Detect with YOLO
        detections = detector.detect(frame)

        # Track with DeepSORT
        tracks = tracker.update(detections, frame)

        # Process each tracked object
        for track in tracks:
            track_id = track["track_id"]
            bbox = track["bbox"]
            class_name = track.get("class_name", "unknown")
            confidence = track.get("confidence", 0.0)

            # Store unique track information
            if track_id not in unique_tracks:
                unique_tracks[track_id] = {
                    'track_id': track_id,
                    'class': class_name,
                    'confidence': confidence,
                    'first_seen_frame': frame_count,
                    'last_seen_frame': frame_count,
                    'bbox': bbox,
                    'crop_path': None
                }
            else:
                unique_tracks[track_id]['last_seen_frame'] = frame_count
                unique_tracks[track_id]['bbox'] = bbox

            # Save crop only once per track
            if track_id not in saved_ids:
                crop_path = save_crop(frame, bbox, OUTPUT_DIR, track_id)
                unique_tracks[track_id]['crop_path'] = crop_path
                saved_ids.add(track_id)

        # Progress indicator
        if frame_count % 100 == 0:
            progress = (frame_count / total_frames) * 100
            elapsed = time.time() - start_time
            fps_actual = frame_count / elapsed if elapsed > 0 else 0
            print(f"   Progress: {progress:.1f}% | FPS: {fps_actual:.1f} | "
                  f"Unique Objects: {len(unique_tracks)}")

    cap.release()
    processing_time = time.time() - start_time

    print(f"\n Video processing complete!")
    print(f"   - Frames: {frame_count}")
    print(f"   - Unique Objects: {len(unique_tracks)}")
    print(f"   - Time: {processing_time:.2f}s\n")

    # Match to GPS coordinates
    print(" Matching detections to GPS...")
    gps_matcher = GPSMatcher(gps_trace_path, video_fps=fps)

    detections_list = list(unique_tracks.values())
    matched_detections = gps_matcher.match_detections(detections_list)

    # Generate report
    print("\n Generating detection report...")
    reporter = DetectionReporter(
        video_filename=Path(video_path).name,
        user_id=user_id
    )

    processing_stats = {
        'video_duration': duration,
        'processing_time': processing_time,
        'total_frames': frame_count,
        'processing_fps': frame_count / processing_time
    }

    report = reporter.generate_report(matched_detections, processing_stats)
    reporter.print_summary(report)

    # Save report
    report_filename = f"{video_name}_report.json"
    report_path = os.path.join(REPORTS_DIR, report_filename)
    reporter.save_report(report, report_path)

    print(f"\nPROCESSING COMPLETE")
    print(f"   - Detections: {len(matched_detections)}")
    print(f"   - Cropped Images: {OUTPUT_DIR}")
    print(f"   - Report: {report_path}\n")

    return report


def main():
    """Process all videos in the VIDEO_FOLDER"""

    # Find all videos
    video_files = list(Path(VIDEO_FOLDER).glob("*.mp4"))
    video_files.extend(list(Path(VIDEO_FOLDER).glob("*.mov")))
    video_files.extend(list(Path(VIDEO_FOLDER).glob("*.MOV")))

    if not video_files:
        print(f"No videos found in {VIDEO_FOLDER}")
        return

    print(f"Found {len(video_files)} video(s) to process\n")

    for video_path in video_files:
        video_name = video_path.stem
        # Find corresponding GPS trace
        gps_trace_path = Path(GPS_FOLDER) / f"{video_name}_gps.json"

        if not gps_trace_path.exists():
            print(f"⚠️ Skipping {video_name}: No GPS trace found")
            print(f"   Looking for: {gps_trace_path}\n")
            continue

        try:
            # Process video
            report = process_video_complete(
                video_path=str(video_path),
                gps_trace_path=str(gps_trace_path),
                user_id="test_user"
            )

        except Exception as e:
            print(f"❌ Error processing {video_name}: {e}\n")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    main()