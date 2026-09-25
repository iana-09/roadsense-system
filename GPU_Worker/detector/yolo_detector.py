"""
YOLOv8 Detector with class name mapping
"""
from ultralytics import YOLO
import sys
from pathlib import Path

# Add parent directory to path to import class_mapper
sys.path.append(str(Path(__file__).parent.parent))
from class_mapper import map_yolo_class_to_db

class YOLODetector:
    def __init__(self, model_path):

        self.model = YOLO(model_path)
        print(f" YOLOv8 model loaded from {model_path}")

        # Print model classes
        print(f"   Model classes: {self.model.names}")

    def detect(self, frame):

        # Run YOLOv8 inference
        results = self.model(frame, verbose=False)

        detections = []

        for result in results:
            boxes = result.boxes

            for i in range(len(boxes)):
                # Get YOLOv8 class information
                class_id = int(boxes.cls[i])
                yolo_class_name = result.names[class_id]  # e.g., "minor"

                #  NEW: Map to database class name
                db_class_name = map_yolo_class_to_db(yolo_class_name)  # e.g., "pothole_minor"

                # Get bounding box and confidence
                bbox = boxes.xyxy[i].tolist()  # [x1, y1, x2, y2]
                confidence = float(boxes.conf[i])

                detection = {
                    'class_name': db_class_name,
                    'confidence': confidence,
                    'bbox': bbox,
                    'yolo_class': yolo_class_name  
                }

                detections.append(detection)

        return detections