"""
Field Constants - Ensures consistency across all layers
(Mobile App, Web Server, Database)
"""

class FieldLimits:
    """Field length limits - must match database schema"""

    # String lengths (match VARCHAR lengths in database)
    MAX_UUID_LENGTH = 36
    MAX_FILENAME_LENGTH = 255
    MAX_URL_LENGTH = 500
    MAX_USER_ID_LENGTH = 100
    MAX_CLASS_NAME_LENGTH = 20
    MAX_SEVERITY_LENGTH = 10
    MAX_STATUS_LENGTH = 20
    MAX_TEXT_LENGTH = 5000  # For error messages, notes, etc.

    # Numeric ranges (match CHECK constraints in database)
    MIN_LATITUDE = -90.0
    MAX_LATITUDE = 90.0
    MIN_LONGITUDE = -180.0
    MAX_LONGITUDE = 180.0
    MIN_CONFIDENCE = 0.0
    MAX_CONFIDENCE = 1.0
    MIN_GPS_ACCURACY = 0.1  # meters
    MAX_GPS_ACCURACY = 1000.0  # meters
    MIN_TRACK_ID = 1
    MIN_FRAME_NUMBER = 0
    MIN_TIMESTAMP = 0.0

    # File size limits
    MAX_VIDEO_SIZE_MB = 2048  # 2 GB (absolute max for 30 min @ 720p)
    MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024
    RECOMMENDED_VIDEO_SIZE_MB = 1536  # 1.5 GB (practical limit - 25 min @ 720p)
    RECOMMENDED_VIDEO_SIZE_BYTES = RECOMMENDED_VIDEO_SIZE_MB * 1024 * 1024

    MAX_GPS_FILE_SIZE_MB = 10
    MAX_GPS_FILE_SIZE_BYTES = MAX_GPS_FILE_SIZE_MB * 1024 * 1024
    MAX_IMAGE_SIZE_MB = 5
    MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024


class AllowedValues:
    """Allowed enum values - must match database CHECK constraints"""

    JOB_STATUS = ['pending', 'processing', 'completed', 'failed']
    DETECTION_STATUS = ['unverified', 'verified', 'false_positive', 'fixed']
    CLASS_NAMES = ['pothole', 'crack', 'speed_bump', 'flooding']
    SEVERITY_LEVELS = ['low', 'medium', 'high']
    VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.MP4', '.MOV', '.AVI']
    IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']
    GPS_EXTENSION = '.json'