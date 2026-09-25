"""
Centralized Error Messages for RoadSense System
All user-facing error messages are defined here for easy maintenance
"""

class ErrorMessages:
    """User-facing error messages"""

    # Upload Errors
    UPLOAD_FILE_TOO_LARGE = "File size exceeds {max_size}MB limit. Please record a shorter video."
    UPLOAD_INVALID_FORMAT = "Invalid file format. Accepted formats: {formats}"
    UPLOAD_FAILED = "Upload failed. Please check your internet connection and try again."
    UPLOAD_TIMEOUT = "Upload timed out. Please try again with a stable connection."

    # GPS Errors
    GPS_INVALID_FORMAT = "Invalid GPS data format. Please ensure location services are enabled during recording."
    GPS_MISSING = "GPS data not found. Please enable location services and try again."
    GPS_LOW_ACCURACY = "GPS accuracy is low. For best results, record in areas with clear sky visibility."

    # Processing Errors
    PROCESSING_FAILED = "Video processing failed. Please try uploading again."
    PROCESSING_TIMEOUT = "Processing is taking longer than expected. Please check back later."
    PROCESSING_NO_DETECTIONS = "No road distress detected in this video."

    # Job/Status Errors
    JOB_NOT_FOUND = "Processing job not found. Please upload your video again."
    JOB_ALREADY_EXISTS = "This video has already been uploaded."

    # Detection Errors
    DETECTION_NOT_FOUND = "Detection not found or has been removed."
    DETECTIONS_UNAVAILABLE = "Unable to load detections. Please try again."

    # Network Errors
    NETWORK_ERROR = "Network error. Please check your internet connection."
    SERVER_UNAVAILABLE = "Server temporarily unavailable. Please try again in a few minutes."

    # Authentication Errors (future)
    AUTH_INVALID_CREDENTIALS = "Invalid login credentials. Please try again."
    AUTH_SESSION_EXPIRED = "Your session has expired. Please log in again."
    AUTH_UNAUTHORIZED = "You don't have permission to access this resource."

    # Database Errors
    DATABASE_ERROR = "Database temporarily unavailable. Please try again later."
    DATABASE_RECORD_NOT_FOUND = "Record not found."

    # Storage Errors
    STORAGE_ERROR = "Storage service temporarily unavailable. Please try again later."
    STORAGE_FULL = "Storage limit reached. Please contact support."

    # Validation Errors
    VALIDATION_REQUIRED_FIELD = "Field '{field}' is required."
    VALIDATION_INVALID_FORMAT = "Invalid format for field '{field}'. Expected: {format}"
    VALIDATION_OUT_OF_RANGE = "Value for '{field}' must be between {min} and {max}."

    # Generic Errors
    GENERIC_ERROR = "An unexpected error occurred. Please try again."
    GENERIC_CONTACT_SUPPORT = "An error occurred. If this persists, please contact support."


class SystemErrors:
    """Internal error messages (for logging only, never shown to users)"""

    # These are for server logs only
    MODEL_LOAD_FAILED = "Failed to load YOLOv8 model from {path}"
    GPU_OUT_OF_MEMORY = "CUDA out of memory. GPU: {gpu_name}, Required: {required}GB"
    AZURE_CONNECTION_FAILED = "Azure Blob Storage connection failed: {error}"
    DATABASE_CONNECTION_FAILED = "Database connection failed: {connection_string}"
    GPU_WORKER_UNREACHABLE = "GPU Worker unreachable at {url}"


def format_error(message: str, **kwargs) -> str:
    """
    Format error message with variables

    Example:
        format_error(ErrorMessages.UPLOAD_FILE_TOO_LARGE, max_size=1536)
    """
    return message.format(**kwargs)