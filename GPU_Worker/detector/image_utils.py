"""
Image utilities for saving detection images with bounding boxes
Saves FULL FRAME with bounding box drawn (not cropped)
"""
import cv2
import numpy as np
from pathlib import Path


def save_detection_image(frame, detection, output_path, display_name=None):

    # Copy frame so we don't modify original
    img = frame.copy()
    
    # Extract detection info
    bbox = detection.get('bbox', [])
    if len(bbox) != 4:
        print(f"Invalid bbox: {bbox}")
        return None
    
    class_name = detection.get('class_name', 'unknown')
    confidence = detection.get('confidence', 0.0)
    track_id = detection.get('track_id', 'N/A')
    frame_number = detection.get('frame_number', 'N/A')
    
    # Draw bounding box
    x1, y1, x2, y2 = map(int, bbox)
    
    # Ensure coordinates are within frame bounds
    height, width = img.shape[:2]
    x1 = max(0, min(x1, width - 1))
    y1 = max(0, min(y1, height - 1))
    x2 = max(0, min(x2, width - 1))
    y2 = max(0, min(y2, height - 1))
    
    # Color based on class (BGR format for OpenCV)
    colors = {
        'pothole_major': (0, 0, 255),      # Red
        'pothole_minor': (0, 165, 255),    # Orange
        'crack': (0, 255, 255),            # Yellow
        'road_patching': (255, 0, 0)       # Blue
    }
    color = colors.get(class_name, (0, 255, 0))  # Default: Green
    
    # Draw rectangle (thickness=4 for better visibility)
    cv2.rectangle(img, (x1, y1), (x2, y2), color, 4)
    
    # Create label text
    if display_name:
        label = f"{display_name}: {confidence:.2%}"
    else:
        label = f"{class_name.replace('_', ' ').title()}: {confidence:.2%}"
    
    # Draw label background
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.9
    thickness = 2
    (text_width, text_height), baseline = cv2.getTextSize(label, font, font_scale, thickness)
    
    # Background rectangle for text (with padding)
    padding = 5
    cv2.rectangle(img, 
                  (x1, y1 - text_height - padding * 2 - baseline), 
                  (x1 + text_width + padding * 2, y1), 
                  color, 
                  -1)  # Filled rectangle
    
    # Draw text on background
    cv2.putText(img, 
                label, 
                (x1 + padding, y1 - padding - baseline), 
                font, 
                font_scale, 
                (255, 255, 255),  # White text
                thickness)
    
    # Optional: Add metadata at top of image
    metadata = f"ID: {track_id} | Frame: {frame_number} | Class: {class_name}"
    
    # Background for metadata
    (meta_width, meta_height), meta_baseline = cv2.getTextSize(metadata, font, 0.6, 2)
    cv2.rectangle(img, (5, 5), (meta_width + 15, meta_height + 15), (0, 0, 0), -1)
    
    # Metadata text
    cv2.putText(img, 
                metadata, 
                (10, meta_height + 10), 
                font, 
                0.6, 
                (255, 255, 255), 
                2)
    
    # Create output directory if it doesn't exist
    output_dir = Path(output_path).parent
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save image with high quality (85% JPEG quality)
    cv2.imwrite(str(output_path), img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    
    return str(output_path)


def draw_multiple_detections(frame, detections):

    img = frame.copy()
    
    for detection in detections:
        bbox = detection.get('bbox', [])
        if len(bbox) != 4:
            continue
        
        class_name = detection.get('class_name', 'unknown')
        confidence = detection.get('confidence', 0.0)
        
        x1, y1, x2, y2 = map(int, bbox)
        
        # Color based on class
        colors = {
            'pothole_major': (0, 0, 255),
            'pothole_minor': (0, 165, 255),
            'crack': (0, 255, 255),
            'road_patching': (255, 0, 0)
        }
        color = colors.get(class_name, (0, 255, 0))
        
        # Draw box
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 3)
        
        # Draw label
        label = f"{class_name}: {confidence:.2%}"
        cv2.putText(img, label, (x1, y1 - 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
    
    return img


def create_detection_thumbnail(frame, bbox, size=(200, 200)):


    x1, y1, x2, y2 = map(int, bbox)
    
    # Add padding around bbox (20% on each side)
    padding = 0.2
    w = x2 - x1
    h = y2 - y1
    pad_w = int(w * padding)
    pad_h = int(h * padding)
    
    # Expand bbox with padding
    x1 = max(0, x1 - pad_w)
    y1 = max(0, y1 - pad_h)
    x2 = min(frame.shape[1], x2 + pad_w)
    y2 = min(frame.shape[0], y2 + pad_h)
    
    # Crop region
    crop = frame[y1:y2, x1:x2]
    
    # Resize to thumbnail size
    thumbnail = cv2.resize(crop, size)
    
    return thumbnail