import cv2
import os

def save_crop(frame, bbox, output_dir, track_id, filename=None):
    height, width = frame.shape[:2]
    x1, y1, x2, y2 = map(int, bbox)
    x1 = max(0, min(x1, width - 1))
    x2 = max(0, min(x2, width))
    y1 = max(0, min(y1, height - 1))
    y2 = max(0, min(y2, height))

    if x2 <= x1 or y2 <= y1:
        return None

    crop = frame[y1:y2, x1:x2]

    os.makedirs(output_dir, exist_ok=True)
    filename = filename or f"det_{track_id}.jpg"
    path = os.path.join(output_dir, filename)
    cv2.imwrite(path, crop)

    return path
