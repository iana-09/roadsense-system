"""
Video processing with YOLOv8 + DeepSORT
Updated to save FULL FRAME images with bounding boxes (not crops)
"""
import cv2
import time
from pathlib import Path
from detector.yolo_detector import YOLODetector
from detector.tracker import Tracker
from detector.image_utils import save_detection_image  #  NEW IMPORT
from class_mapper import map_yolo_class_to_db, get_display_name

def process_video(video_path, model_path, output_dir='output_images', gps_data=None):
    print(f"\n{'='*60}")
    print(f"PROCESSING VIDEO: {video_path}")
    print(f"{'='*60}")
    
    # Initialize detector and tracker
    detector = YOLODetector(model_path)
    tracker = Tracker()
    
    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Open video
    cap = cv2.VideoCapture(str(video_path))
    
    if not cap.isOpened():
        print(f" Error: Could not open video {video_path}")
        return None
    
    # Get video properties
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    print(f" Video Info:")
    print(f"   Frames: {total_frames}")
    print(f"   FPS: {fps:.2f}")
    print(f"   Resolution: {width}x{height}")
    
    # Processing variables
    frame_number = 0
    start_time = time.time()
    unique_detections = {}  # track_id -> detection info
    
    print(f"\n Processing frames...")
    
    try:
        while cap.isOpened():
            ret, frame = cap.read()
            
            if not ret:
                break
            
            # Detect objects in frame
            detections = detector.detect(frame)
            
            # Update tracker
            tracked_detections = tracker.update(detections, frame)
            
            # Process tracked detections
            for det in tracked_detections:
                track_id = det['track_id']
                
                #  UPDATED: Save FULL FRAME with bounding box
                if track_id not in unique_detections:
                    # Map class name to database format
                    db_class_name = det['class_name']  # Already mapped in detector
                    display_name = get_display_name(db_class_name)
                    
                    # Generate output filename
                    image_filename = f"det_{track_id:04d}_frame_{frame_number:06d}.jpg"
                    image_path = output_path / image_filename
                    
                    # Save FULL FRAME with bounding box drawn
                    saved_path = save_detection_image(
                        frame=frame,  #  Full frame, not cropped!
                        detection=det,
                        output_path=str(image_path),
                        display_name=display_name
                    )
                    
                    if saved_path:
                        # Store detection info
                        unique_detections[track_id] = {
                            'detection_id': f"det_{track_id:04d}",
                            'track_id': track_id,
                            'class_name': db_class_name,
                            'confidence': det['confidence'],
                            'bbox': det['bbox'],
                            'frame_number': frame_number,
                            'timestamp': frame_number / fps,
                            'image_path': saved_path,
                            'first_seen_frame': frame_number,
                            'last_seen_frame': frame_number,
                            'frames_tracked': 1
                        }
                        
                        print(f" New detection: Track ID {track_id} ({display_name}) at frame {frame_number}")
                    
                else:
                    # Update existing detection
                    unique_detections[track_id]['last_seen_frame'] = frame_number
                    unique_detections[track_id]['frames_tracked'] += 1
            
            # Progress indicator
            frame_number += 1
            if frame_number % 100 == 0:
                progress = (frame_number / total_frames) * 100
                elapsed = time.time() - start_time
                current_fps = frame_number / elapsed if elapsed > 0 else 0
                print(f"   Progress: {frame_number}/{total_frames} ({progress:.1f}%) | "
                      f"FPS: {current_fps:.1f} | "
                      f"Unique detections: {len(unique_detections)}")
        
    finally:
        cap.release()
    
    # Calculate processing stats
    processing_time = time.time() - start_time
    processing_fps = total_frames / processing_time if processing_time > 0 else 0
    
    print(f"\n{'='*60}")
    print(f"PROCESSING COMPLETE")
    print(f"{'='*60}")
    print(f" Processing time: {processing_time:.2f} seconds")
    print(f" Processing FPS: {processing_fps:.2f}")
    print(f" Unique detections: {len(unique_detections)}")
    print(f" Images saved to: {output_path}")

    # Processing stats
    stats = {
        'total_frames': total_frames,
        'processing_time': processing_time,
        'fps': processing_fps,
        'unique_detections': len(unique_detections),
        'video_fps': fps,
        'resolution': f"{width}x{height}"
    }

    return {
        'detections': list(unique_detections.values()),
        'stats': stats
    }


if __name__ == "__main__":
    # Test processing
    video_path = "test_video.mp4"
    model_path = r"C:\Users\Sebastian Penaranda\runs\detect\train_run14\weights\best.pt"
    
    result = process_video(video_path, model_path, output_dir='output_images')
    
    if result:
        print(f"\n Processing successful!")
        print(f"   Total detections: {len(result['detections'])}")
        print(f"   Processing FPS: {result['stats']['fps']:.2f}")