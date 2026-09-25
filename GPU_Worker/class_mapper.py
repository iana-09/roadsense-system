"""
Class Name Mapper
Maps YOLOv8 class names to database-friendly names
"""

# YOLOv8 model class names
YOLO_CLASSES = {
    0: "cracks",
    1: "major_pothole",
    2: "minor_pothole",
    3: "patches"
}

# Mapping YOLOv8 class names to database enum values
YOLO_TO_DB_CLASS = {
    # Current Roboflow / YOLO data.yaml names
    "cracks": "crack",
    "major_pothole": "pothole_major",
    "minor_pothole": "pothole_minor",
    "patches": "road_patching",

    # Older model aliases kept for compatibility
    "minor": "pothole_minor",
    "major": "pothole_major",
    "crack": "crack",
    "road_patching": "road_patching",
    "pothole_minor": "pothole_minor",
    "pothole_major": "pothole_major"
}

# Reverse mapping (database to YOLOv8)
DB_TO_YOLO_CLASS = {
    "pothole_minor": "minor_pothole",
    "pothole_major": "major_pothole",
    "crack": "cracks",
    "road_patching": "patches"
}

# Display names for user interface
DISPLAY_NAMES = {
    "pothole_minor": "Pothole (Minor)",
    "pothole_major": "Pothole (Major)",
    "crack": "Road Crack",
    "road_patching": "Road Patching"
}

# Severity weights for calculation
SEVERITY_WEIGHTS = {
    "pothole_minor": 3,
    "pothole_major": 10,
    "crack": 5,
    "road_patching": 2
}


def map_yolo_class_to_db(yolo_class_name: str) -> str:
    """
    Convert YOLOv8 class name to database enum value

    Args:
        yolo_class_name: Class name from YOLOv8 (e.g., "minor")

    Returns:
        Database class name (e.g., "pothole_minor")

    Example:
        >>> map_yolo_class_to_db("minor")
        'pothole_minor'
    """
    mapped = YOLO_TO_DB_CLASS.get(yolo_class_name, yolo_class_name)
    return mapped


def map_db_class_to_yolo(db_class_name: str) -> str:
    """
    Convert database class name back to YOLOv8 class

    Args:
        db_class_name: Database class name (e.g., "pothole_minor")

    Returns:
        YOLOv8 class name (e.g., "minor")

    Example:
        >>> map_db_class_to_yolo("pothole_minor")
        'minor'
    """
    mapped = DB_TO_YOLO_CLASS.get(db_class_name, db_class_name)
    return mapped


def get_display_name(db_class_name: str) -> str:
    """
    Get user-friendly display name for a class

    Args:
        db_class_name: Database class name (e.g., "pothole_minor")

    Returns:
        Display name (e.g., "Pothole (Minor)")

    Example:
        >>> get_display_name("pothole_minor")
        'Pothole (Minor)'
    """
    return DISPLAY_NAMES.get(db_class_name, db_class_name)


def calculate_road_severity(detections: list) -> tuple:
    """
    Calculate overall road severity based on detection counts

    Args:
        detections: List of detection dictionaries with 'class_name' key

    Returns:
        Tuple of (severity_level, class_counts, severity_score)
        - severity_level: 'low', 'medium', or 'high'
        - class_counts: Dictionary with counts per class
        - severity_score: Numerical score

    Example:
        >>> dets = [
        ...     {'class_name': 'pothole_minor'},
        ...     {'class_name': 'pothole_major'},
        ...     {'class_name': 'crack'}
        ... ]
        >>> calculate_road_severity(dets)
        ('medium', {'pothole_minor': 1, 'pothole_major': 1, 'crack': 1, 'road_patching': 0}, 18)
    """
    # Initialize counts
    class_counts = {
        'pothole_minor': 0,
        'pothole_major': 0,
        'crack': 0,
        'road_patching': 0
    }

    # Count each detection type
    for det in detections:
        class_name = det.get('class_name', '')
        if class_name in class_counts:
            class_counts[class_name] += 1

    # Calculate weighted severity score
    severity_score = 0
    for class_name, count in class_counts.items():
        weight = SEVERITY_WEIGHTS.get(class_name, 1)
        severity_score += count * weight

    # Determine severity level
    if severity_score < 20:
        severity_level = 'low'
    elif severity_score < 50:
        severity_level = 'medium'
    else:
        severity_level = 'high'

    return severity_level, class_counts, severity_score


# Test function
if __name__ == "__main__":
    print("Testing Class Mapper...")
    print(f"minor -> {map_yolo_class_to_db('minor')}")
    print(f"major -> {map_yolo_class_to_db('major')}")
    print(f"pothole_minor -> {map_db_class_to_yolo('pothole_minor')}")
    print(f"Display: {get_display_name('pothole_minor')}")

    # Test severity calculation
    test_detections = [
        {'class_name': 'pothole_minor'},
        {'class_name': 'pothole_minor'},
        {'class_name': 'pothole_major'},
        {'class_name': 'crack'},
    ]
    severity, counts, score = calculate_road_severity(test_detections)
    print(f"\nSeverity: {severity}")
    print(f"Counts: {counts}")
    print(f"Score: {score}")
