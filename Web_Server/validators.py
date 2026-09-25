"""
Field Validators with Regular Expressions
"""

import re
from typing import Optional, Tuple
from datetime import datetime

class FieldValidator:
    """Centralized field validation with regex patterns"""

    # Regular expression patterns
    PATTERNS = {
        # Email validation
        'email': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',

        # UUID format (for job IDs)
        'uuid': r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',

        # File extensions
        'video_file': r'^.+\.(mp4|mov|avi|MP4|MOV|AVI)$',
        'gps_file': r'^.+\.json$',
        'image_file': r'^.+\.(jpg|jpeg|png|JPG|JPEG|PNG)$',

        # User IDs are stored as UUIDs, but keep legacy alphanumeric IDs valid.
        'user_id': r'^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[a-zA-Z0-9_]{3,50})$',

        # Class names (detection types)
        'class_name': r'^(pothole|crack|speed_bump|flooding)$',

        # Severity levels
        'severity': r'^(low|medium|high)$',

        # Status values
        'job_status': r'^(pending|processing|completed|failed)$',
        'detection_status': r'^(unverified|verified|false_positive|fixed)$',

        # ISO 8601 datetime format
        'iso_datetime': r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}',

        # Coordinates format (string representation)
        'coordinate': r'^-?\d+\.\d+$',
    }

    @staticmethod
    def validate_filename(filename: str, file_type: str = 'video') -> Tuple[bool, Optional[str]]:
        """
        Validate filename format
        file_type: 'video', 'gps', or 'image'
        Returns: (is_valid, error_message)
        """
        if not filename:
            return False, "Filename is required"

        # Length check
        if len(filename) > 255:
            return False, "Filename must be less than 255 characters"

        # Format check
        pattern_key = f'{file_type}_file'
        if pattern_key not in FieldValidator.PATTERNS:
            return False, f"Unknown file type: {file_type}"

        if not re.match(FieldValidator.PATTERNS[pattern_key], filename):
            if file_type == 'video':
                return False, "Invalid video file format. Accepted: mp4, mov, avi"
            elif file_type == 'gps':
                return False, "Invalid GPS file format. Must be .json"
            elif file_type == 'image':
                return False, "Invalid image format. Accepted: jpg, jpeg, png"

        # Path traversal check (security)
        if '..' in filename or '/' in filename or '\\' in filename:
            return False, "Filename contains invalid characters"

        return True, None

    @staticmethod
    def validate_user_id(user_id: str) -> Tuple[bool, Optional[str]]:
        """
        Validate user ID format
        Returns: (is_valid, error_message)
        """
        if not user_id:
            return True, None  # User ID is optional

        if not re.match(FieldValidator.PATTERNS['user_id'], user_id):
            return False, "User ID must be a UUID or 3-50 alphanumeric characters/underscores"

        return True, None

    @staticmethod
    def validate_latitude(lat: float) -> Tuple[bool, Optional[str]]:
        """
        Validate latitude value and format
        Returns: (is_valid, error_message)
        """
        # Type check
        if not isinstance(lat, (int, float)):
            return False, "Latitude must be a number"

        # Range check
        if lat < -90 or lat > 90:
            return False, "Latitude must be between -90 and 90"

        return True, None

    @staticmethod
    def validate_longitude(lng: float) -> Tuple[bool, Optional[str]]:
        """
        Validate longitude value and format
        Returns: (is_valid, error_message)
        """
        # Type check
        if not isinstance(lng, (int, float)):
            return False, "Longitude must be a number"

        # Range check
        if lng < -180 or lng > 180:
            return False, "Longitude must be between -180 and 180"

        return True, None

    @staticmethod
    def validate_confidence(confidence: float) -> Tuple[bool, Optional[str]]:
        """
        Validate confidence score
        Returns: (is_valid, error_message)
        """
        # Type check
        if not isinstance(confidence, (int, float)):
            return False, "Confidence must be a number"

        # Range check
        if confidence < 0.0 or confidence > 1.0:
            return False, "Confidence must be between 0.0 and 1.0"

        return True, None

    @staticmethod
    def validate_file_size(size_bytes: int, max_mb: int = 2048) -> Tuple[bool, Optional[str]]:
        """
        Validate file size
        Returns: (is_valid, error_message)
        """
        # Type check
        if not isinstance(size_bytes, int):
            return False, "File size must be an integer"

        # Range check
        if size_bytes <= 0:
            return False, "File size must be greater than 0"

        max_bytes = max_mb * 1024 * 1024
        if size_bytes > max_bytes:
            return False, f"File size must be less than {max_mb}MB"

        return True, None
