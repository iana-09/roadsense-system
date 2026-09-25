"""
Local OpenCV detection preview.

Run this on the GPU machine to play a video with YOLO + DeepSORT boxes drawn
in a desktop window. This does not upload results or talk to the web server.
"""
import argparse
from pathlib import Path
import time

import cv2

from detector.yolo_detector import YOLODetector
from detector.tracker import Tracker
from detector.image_utils import draw_multiple_detections


BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent


def resolve_model_path(configured=None):
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


def fit_to_screen(frame, max_width):
    if not max_width or frame.shape[1] <= max_width:
        return frame

    scale = max_width / frame.shape[1]
    height = int(frame.shape[0] * scale)
    return cv2.resize(frame, (max_width, height), interpolation=cv2.INTER_AREA)


def draw_overlay(frame, frame_number, total_frames, fps, track_count, paused):
    progress = (frame_number / total_frames * 100) if total_frames else 0
    text = (
        f"Frame {frame_number}/{total_frames or '?'} | {progress:.1f}% | "
        f"FPS {fps:.1f} | Objects {track_count}"
    )
    if paused:
        text += " | PAUSED"

    cv2.rectangle(frame, (8, 8), (min(frame.shape[1] - 8, 820), 48), (0, 0, 0), -1)
    cv2.putText(
        frame,
        text,
        (18, 36),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (255, 255, 255),
        2,
    )
    return frame


def preview_video(video_path, model_path=None, max_width=1280, stride=1):
    video_path = Path(video_path)
    if not video_path.exists():
        raise FileNotFoundError(f"Video not found: {video_path}")

    model_path = resolve_model_path(model_path)
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")

    print(f"Video: {video_path}")
    print(f"Model: {model_path}")
    print("Controls: q/esc quit | space pause | s save screenshot | left/right seek")

    detector = YOLODetector(str(model_path))
    tracker = Tracker()

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    source_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    wait_ms = max(1, int(1000 / source_fps))
    window_name = "RoadSense Local Detection Preview"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    frame_number = 0
    paused = False
    last_display = None
    last_time = time.perf_counter()
    display_fps = 0.0

    while True:
        if paused and last_display is not None:
            frame = last_display.copy()
        else:
            ret, frame = cap.read()
            if not ret:
                print("End of video.")
                break

            frame_number = int(cap.get(cv2.CAP_PROP_POS_FRAMES))

            if stride > 1 and frame_number % stride != 0:
                continue

            detections = detector.detect(frame)
            tracks = tracker.update(detections, frame)
            frame = draw_multiple_detections(frame, tracks)

            now = time.perf_counter()
            elapsed = max(now - last_time, 0.0001)
            display_fps = 1 / elapsed
            last_time = now

            frame = draw_overlay(frame, frame_number, total_frames, display_fps, len(tracks), paused)
            frame = fit_to_screen(frame, max_width)
            last_display = frame.copy()

        cv2.imshow(window_name, frame)
        key = cv2.waitKey(0 if paused else wait_ms) & 0xFF

        if key in (27, ord("q")):
            break
        if key == ord(" "):
            paused = not paused
        elif key == ord("s") and last_display is not None:
            output = BASE_DIR / "previews" / f"local_preview_{int(time.time())}.jpg"
            output.parent.mkdir(exist_ok=True)
            cv2.imwrite(str(output), last_display, [cv2.IMWRITE_JPEG_QUALITY, 90])
            print(f"Saved screenshot: {output}")
        elif key in (81, 2424832):
            target = max(0, frame_number - int(source_fps * 5))
            cap.set(cv2.CAP_PROP_POS_FRAMES, target)
            paused = False
        elif key in (83, 2555904):
            target = min(total_frames - 1, frame_number + int(source_fps * 5))
            cap.set(cv2.CAP_PROP_POS_FRAMES, target)
            paused = False

    cap.release()
    cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser(description="Play a local video with RoadSense detections drawn.")
    parser.add_argument("video", help="Path to the video file.")
    parser.add_argument("--model", help="Optional path to a YOLO .pt model.")
    parser.add_argument("--max-width", type=int, default=1280, help="Resize preview window image to this width.")
    parser.add_argument("--stride", type=int, default=1, help="Process every Nth frame for faster preview.")
    args = parser.parse_args()

    preview_video(args.video, model_path=args.model, max_width=args.max_width, stride=max(1, args.stride))


if __name__ == "__main__":
    main()
