"""
Detection Report Generator with Severity Calculation
Generates comprehensive JSON reports from detection results
"""
import json
import uuid
from datetime import datetime
from pathlib import Path
from class_mapper import calculate_road_severity, get_display_name


class DetectionReporter:
    """Generates structured reports from detection results"""
    
    def __init__(self, video_filename, user_id=None):
        """
        Initialize detection reporter
        
        Args:
            video_filename: Name of the processed video file
            user_id: Optional user identifier
        """
        self.video_filename = video_filename
        self.user_id = user_id
        self.report_id = str(uuid.uuid4())
        self.generated_at = datetime.now()
    
    def generate_report(self, unique_detections, processing_stats):
        """
        Generate comprehensive detection report with severity calculation
        
        Args:
            unique_detections: List of unique detection dictionaries from tracker
            processing_stats: Dictionary containing processing statistics
        
        Returns:
            Complete report dictionary ready for JSON serialization
        """
        
        # NEW: Calculate overall road severity
        severity_level, class_counts, severity_score = calculate_road_severity(unique_detections)
        
        # Generate report metadata
        report_metadata = {
            'report_id': self.report_id,
            'generated_at': self.generated_at.isoformat(),
            'video_filename': self.video_filename,
            'user_id': self.user_id,
            'report_version': '2.0'
        }
        
        # ENHANCED: Summary section with severity analysis
        summary = {
            'total_detections': len(unique_detections),
            'total_frames_processed': processing_stats.get('total_frames', 0),
            'processing_time_seconds': processing_stats.get('processing_time', 0),
            'fps': processing_stats.get('fps', 0),
            
            #NEW: Road severity metrics
            'road_severity': severity_level,
            'severity_score': severity_score,
            'detections_by_class': class_counts,
            
            # Class breakdown with percentages
            'class_distribution': self._calculate_class_distribution(unique_detections),
            
            # GPS coverage
            'gps_coverage': {
                'total_gps_points': processing_stats.get('total_gps_points', 0),
                'detections_with_gps': sum(1 for d in unique_detections if (d.get('location') or d.get('gps') or {}).get('latitude') is not None),
                'interpolated_count': sum(1 for d in unique_detections if (d.get('location') or d.get('gps') or {}).get('interpolated', False)),
                'unmatched_detections': sum(1 for d in unique_detections if d.get('gps_match_status') == 'missing')
            }
        }
        
        # Format detections with enhanced information
        formatted_detections = self._format_detections(unique_detections)
        
        # Complete report structure
        report = {
            'report_metadata': report_metadata,
            'summary': summary,
            'detections': formatted_detections,
            'processing_stats': processing_stats
        }
        
        return report
    
    def _format_detections(self, detections):
        """
        Format detections with all necessary information
        
        Args:
            detections: List of detection dictionaries
        
        Returns:
            List of formatted detection dictionaries
        """
        formatted = []
        
        for det in detections:
            location = det.get('location') or det.get('gps') or {}
            # Extract class name
            class_name = det.get('class_name', 'unknown')
            track_id = det.get('track_id')
            first_seen_frame = det.get('first_seen_frame') or det.get('frame_number')
            detection_id = det.get('detection_id') or str(
                uuid.uuid5(uuid.NAMESPACE_URL, f"{self.video_filename}:{track_id}:{first_seen_frame}")
            )
            
            # NEW: Get display name for UI
            display_name = get_display_name(class_name)
            
            #NEW: Calculate individual detection severity
            individual_severity = self._calculate_detection_severity(class_name, det.get('confidence', 0))
            
            formatted_det = {
                # Identification
                'detection_id': detection_id,
                'track_id': track_id,
                
                # Classification
                'class_name': class_name,
                'display_name': display_name,  # ← User-friendly name
                'confidence': round(det.get('confidence', 0), 4),
                'severity': individual_severity,  # ← Individual severity
                
                # Location information
                'location': {
                    'latitude': location.get('latitude'),
                    'longitude': location.get('longitude'),
                    'accuracy': location.get('accuracy'),
                    'interpolated': location.get('interpolated', False)
                },
                
                # Video information
                'video_data': {
                    'frame_number': det.get('frame_number') or det.get('first_seen_frame'),
                    'timestamp': det.get('timestamp') or location.get('timestamp'),
                    'bbox': det.get('bbox', [])  # [x1, y1, x2, y2]
                },
                
                # Image path (cropped detection)
                'image_path': det.get('image_path') or det.get('crop_path'),
                # Full source frame with the primary detection highlighted
                'frame_path': det.get('frame_path'),
                
                # Detection metadata
                'first_seen_frame': det.get('first_seen_frame'),
                'last_seen_frame': det.get('last_seen_frame'),
                'frames_tracked': det.get('frames_tracked', 1),
                'gps_match_status': det.get('gps_match_status', 'matched' if location else 'missing')
            }
            
            formatted.append(formatted_det)
        
        return formatted
    
    def _calculate_detection_severity(self, class_name, confidence):
        """
        Calculate severity for individual detection
        
        Based on class type and confidence:
        - pothole_major -> HIGH (always)
        - crack with high confidence -> MEDIUM to HIGH
        - pothole_minor -> LOW to MEDIUM
        - road_patching -> LOW
        
        Args:
            class_name: Detection class name
            confidence: Detection confidence score (0-1)
        
        Returns:
            Severity level: 'low', 'medium', or 'high'
        """
        # Major potholes are always high severity
        if class_name == 'pothole_major':
            return 'high'
        
        # Cracks severity depends on confidence
        elif class_name == 'crack':
            if confidence >= 0.85:
                return 'high'
            elif confidence >= 0.70:
                return 'medium'
            else:
                return 'low'
        
        # Minor potholes
        elif class_name == 'pothole_minor':
            if confidence >= 0.80:
                return 'medium'
            else:
                return 'low'
        
        # Road patching (indicates previous repairs)
        elif class_name == 'road_patching':
            return 'low'
        
        # Unknown class
        else:
            return 'low'
    
    def _calculate_class_distribution(self, detections):
        """
        Calculate percentage distribution of detection classes
        
        Args:
            detections: List of detection dictionaries
        
        Returns:
            Dictionary with class percentages
        """
        if not detections:
            return {}
        
        total = len(detections)
        counts = {
            'pothole_minor': 0,
            'pothole_major': 0,
            'crack': 0,
            'road_patching': 0
        }
        
        for det in detections:
            class_name = det.get('class_name', '')
            if class_name in counts:
                counts[class_name] += 1
        
        # Calculate percentages
        distribution = {}
        for class_name, count in counts.items():
            percentage = (count / total) * 100 if total > 0 else 0
            distribution[class_name] = {
                'count': count,
                'percentage': round(percentage, 2)
            }
        
        return distribution
    
    def save_report(self, report, output_dir='reports'):

        # Create output directory if it doesn't exist
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Generate filename with timestamp
        timestamp = self.generated_at.strftime('%Y%m%d_%H%M%S')
        report_filename = f"{self.report_id}_{timestamp}_report.json"
        report_file = output_path / report_filename
        
        # Save report as formatted JSON
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f" Report saved: {report_file}")
        print(f"   Total detections: {report['summary']['total_detections']}")
        print(f"   Road severity: {report['summary']['road_severity'].upper()}")
        
        return str(report_file)
    
    def generate_summary_text(self, report):
        """
        Generate human-readable text summary from report
        
        Args:
            report: Report dictionary
        
        Returns:
            Formatted text summary
        """
        summary = report['summary']
        
        text = f"""
═══════════════════════════════════════════════════════════
ROAD DISTRESS DETECTION REPORT
═══════════════════════════════════════════════════════════

Report ID: {report['report_metadata']['report_id']}
Video: {report['report_metadata']['video_filename']}
Generated: {report['report_metadata']['generated_at']}

OVERALL ASSESSMENT
───────────────────────────────────────────────────────────
Road Severity: {summary['road_severity'].upper()}
Severity Score: {summary['severity_score']}/100
Total Detections: {summary['total_detections']}

DETECTIONS BY CLASS
───────────────────────────────────────────────────────────
Potholes (Major):  {summary['detections_by_class']['pothole_major']}
Potholes (Minor):  {summary['detections_by_class']['pothole_minor']}
Cracks:            {summary['detections_by_class']['crack']}
Road Patching:     {summary['detections_by_class']['road_patching']}

PROCESSING STATISTICS
───────────────────────────────────────────────────────────
Frames Processed: {summary['total_frames_processed']}
Processing Time: {summary['processing_time_seconds']:.2f} seconds
FPS: {summary['fps']:.2f}

GPS COVERAGE
───────────────────────────────────────────────────────────
Total GPS Points: {summary['gps_coverage']['total_gps_points']}
Detections with GPS: {summary['gps_coverage']['detections_with_gps']}
Interpolated: {summary['gps_coverage']['interpolated_count']}

═══════════════════════════════════════════════════════════
"""
        return text
    
    def save_summary_text(self, report, output_dir='reports'):
        """
        Save text summary to file
        
        Args:
            report: Report dictionary
            output_dir: Directory to save summary
        
        Returns:
            Path to saved summary file
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        timestamp = self.generated_at.strftime('%Y%m%d_%H%M%S')
        summary_filename = f"{self.report_id}_{timestamp}_summary.txt"
        summary_file = output_path / summary_filename
        
        summary_text = self.generate_summary_text(report)
        
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write(summary_text)
        
        print(f"Summary saved: {summary_file}")
        
        return str(summary_file)


# Utility function for quick report generation
def generate_quick_report(detections, processing_stats, video_filename, user_id=None, save_to_disk=True):
    """
    Quick utility function to generate and save a report
    
    Args:
        detections: List of detection dictionaries
        processing_stats: Processing statistics dictionary
        video_filename: Name of processed video
        user_id: Optional user identifier
        save_to_disk: Whether to save report to disk (default: True)
    
    Returns:
        Tuple of (report_dict, report_file_path)
    """
    reporter = DetectionReporter(video_filename, user_id)
    report = reporter.generate_report(detections, processing_stats)
    
    report_path = None
    if save_to_disk:
        report_path = reporter.save_report(report)
        reporter.save_summary_text(report)  # Also save text summary
    
    return report, report_path


# Test/Example usage
if __name__ == "__main__":
    # Example detections for testing
    test_detections = [
        {
            'detection_id': 'det_001',
            'track_id': 1,
            'class_name': 'pothole_major',
            'confidence': 0.92,
            'location': {'latitude': 14.6042, 'longitude': 121.0022, 'accuracy': 10.5, 'interpolated': False},
            'frame_number': 150,
            'timestamp': 5.0,
            'bbox': [100, 200, 150, 250],
            'image_path': 'output_crops/det_001.jpg',
            'first_seen_frame': 145,
            'last_seen_frame': 155,
            'frames_tracked': 11
        },
        {
            'detection_id': 'det_002',
            'track_id': 2,
            'class_name': 'pothole_minor',
            'confidence': 0.85,
            'location': {'latitude': 14.6045, 'longitude': 121.0025, 'accuracy': 12.0, 'interpolated': False},
            'frame_number': 300,
            'timestamp': 10.0,
            'bbox': [200, 300, 250, 350],
            'image_path': 'output_crops/det_002.jpg',
            'first_seen_frame': 295,
            'last_seen_frame': 305,
            'frames_tracked': 11
        },
        {
            'detection_id': 'det_003',
            'track_id': 3,
            'class_name': 'crack',
            'confidence': 0.88,
            'location': {'latitude': 14.6048, 'longitude': 121.0028, 'accuracy': 8.5, 'interpolated': True},
            'frame_number': 450,
            'timestamp': 15.0,
            'bbox': [300, 400, 350, 450],
            'image_path': 'output_crops/det_003.jpg',
            'first_seen_frame': 445,
            'last_seen_frame': 455,
            'frames_tracked': 11
        }
    ]
    
    test_stats = {
        'total_frames': 600,
        'processing_time': 25.5,
        'fps': 23.5,
        'total_gps_points': 120
    }
    
    # Generate report
    print("\n" + "="*60)
    print("TESTING DETECTION REPORTER")
    print("="*60)
    
    report, report_path = generate_quick_report(
        test_detections,
        test_stats,
        'test_video.mp4',
        user_id='test_user_001',
        save_to_disk=True
    )
    
    print("\n" + "="*60)
    print("REPORT SUMMARY")
    print("="*60)
    print(f"Road Severity: {report['summary']['road_severity'].upper()}")
    print(f"Severity Score: {report['summary']['severity_score']}")
    print(f"Total Detections: {report['summary']['total_detections']}")
    print(f"Class Distribution:")
    for class_name, data in report['summary']['class_distribution'].items():
        print(f"  {class_name}: {data['count']} ({data['percentage']}%)")
    
    print("\n✅ Test completed!")
