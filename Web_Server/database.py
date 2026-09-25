"""
Database models and connection for Azure SQL Server (Synchronous)
Updated: video_url and gps_url are now REQUIRED (not nullable)
"""
from sqlalchemy import create_engine, String, Float, Integer, Boolean, DateTime, Enum as SQLEnum, JSON, Text, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker, Session
from datetime import datetime
from typing import Optional
import enum
from contextlib import contextmanager

from config import settings

# Create synchronous engine for Azure SQL Server
engine = create_engine(
    settings.DATABASE_URL_SYNC,
    echo=True if settings.ENVIRONMENT == "development" else False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

# Create session maker (synchronous)
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for models
class Base(DeclarativeBase):
    pass

# Enums
class JobStatus(enum.Enum):
    PENDING    = "pending"      # ← back to lowercase
    PROCESSING = "processing"
    COMPLETED  = "completed"
    FAILED     = "failed"
# class JobStatus(enum.Enum):
#     PENDING    = "PENDING"
#     PROCESSING = "PROCESSING"
#     COMPLETED  = "COMPLETED"
#     FAILED     = "FAILED"
    # PENDING    = "pending"
    # PROCESSING = "processing"
    # COMPLETED  = "completed"
    # FAILED     = "failed"

class DetectionClass(enum.Enum):
    POTHOLE_MINOR = "pothole_minor"      # YOLOv8 class "minor"
    POTHOLE_MAJOR = "pothole_major"      # YOLOv8 class "major"
    CRACK = "crack"                      # YOLOv8 class "crack"
    ROAD_PATCHING = "road_patching"      # YOLOv8 class "road_patching"

class Severity(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class DetectionStatus(enum.Enum):
    UNVERIFIED = "unverified"
    VERIFIED = "verified"
    FALSE_POSITIVE = "false_positive"
    FIXED = "fixed"

# ✅ Fix - proper indentation
class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    status: Mapped[JobStatus] = mapped_column(
        SQLEnum(
            JobStatus,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x]
        ),
        default=JobStatus.PENDING
    )

    #  UPDATED: File information - video_url and gps_url now REQUIRED!
    video_filename: Mapped[str] = mapped_column(String(255))
    video_url: Mapped[str] = mapped_column(String(500))
    gps_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gps_url: Mapped[str] = mapped_column(String(500))

    # User information
    user_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # Attribution is chosen for each contribution, not for the whole account.
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Separates explicit consent from legacy uploads created before this feature.
    attribution_opt_in: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Processing information
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processing_stats: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    region_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    city: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)

class Detection(Base):
    __tablename__ = "detections"  

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # detection_id
    job_id: Mapped[str] = mapped_column(String(36), index=True)
    track_id: Mapped[int] = mapped_column(Integer)

    # Detection information
    class_name: Mapped[DetectionClass] = mapped_column(SQLEnum(DetectionClass, native_enum=False))
    confidence: Mapped[float] = mapped_column(Float)
    severity: Mapped[Severity] = mapped_column(SQLEnum(Severity, native_enum=False))
    status: Mapped[DetectionStatus] = mapped_column(
        SQLEnum(DetectionStatus, native_enum=False),
        default=DetectionStatus.UNVERIFIED
    )

    # Location - Using separate latitude/longitude columns
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    gps_accuracy: Mapped[float] = mapped_column(Float)
    interpolated: Mapped[bool] = mapped_column(default=False)

    # Video information
    frame_number: Mapped[int] = mapped_column(Integer)
    timestamp: Mapped[float] = mapped_column(Float)  # seconds
    bbox: Mapped[dict] = mapped_column(JSON)  # [x1, y1, x2, y2]

    # File references
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    frame_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    verified_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

class Report(Base):
    __tablename__ = "reports" 

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # report_id
    job_id: Mapped[str] = mapped_column(String(36), index=True)

    # Report information
    video_filename: Mapped[str] = mapped_column(String(255))
    user_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Statistics
    total_detections: Mapped[int] = mapped_column(Integer)
    processing_stats: Mapped[dict] = mapped_column(JSON)

    # File reference
    report_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Metadata
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users" 

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # UUID
    full_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))  # Store hashed passwords!
    role: Mapped[str] = mapped_column(String(50), default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

class LoginAudit(Base):
    __tablename__ = "login_audits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    username: Mapped[str] = mapped_column(String(255), index=True)
    requested_role: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    actual_role: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    success: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    logout_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class AuditEvent(Base):
    """Account activity shown in the SAE security console."""

    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    actor_id: Mapped[str] = mapped_column(String(36), index=True)
    actor_name: Mapped[str] = mapped_column(String(255), index=True)
    actor_role: Mapped[str] = mapped_column(String(50), index=True)
    category: Mapped[str] = mapped_column(String(50), index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    resource_type: Mapped[str] = mapped_column(String(100))
    resource_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

class LGURequestStatus(enum.Enum):
    PENDING  = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class LGURequest(Base):
    __tablename__ = "lgu_requests"

    id         : Mapped[str]              = mapped_column(String(36), primary_key=True)
    email      : Mapped[str]              = mapped_column(String(255), unique=True, index=True)
    city       : Mapped[str]              = mapped_column(String(255))
    barangay   : Mapped[str]              = mapped_column(String(255))
    region     : Mapped[Optional[str]]     = mapped_column(String(255), nullable=True)
    region_code: Mapped[Optional[str]]     = mapped_column(String(20), nullable=True)
    city_code  : Mapped[Optional[str]]     = mapped_column(String(20), nullable=True)
    barangay_code: Mapped[Optional[str]]   = mapped_column(String(20), nullable=True)
    status     : Mapped[LGURequestStatus] = mapped_column(SQLEnum(LGURequestStatus, native_enum=False), default=LGURequestStatus.PENDING)
    created_at : Mapped[datetime]         = mapped_column(DateTime, default=datetime.utcnow)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reviewed_by: Mapped[Optional[str]]    = mapped_column(String(255), nullable=True)

# Database functions
def init_db():
    """Initialize database - create tables"""
    Base.metadata.create_all(bind=engine)
    compatibility_columns = {
        "jobs": {
            "is_anonymous": "BIT NOT NULL CONSTRAINT DF_jobs_is_anonymous DEFAULT 0",
            "attribution_opt_in": "BIT NOT NULL CONSTRAINT DF_jobs_attribution_opt_in DEFAULT 0",
            "region": "NVARCHAR(255) NULL",
            "region_code": "NVARCHAR(20) NULL",
            "city": "NVARCHAR(255) NULL",
            "city_code": "NVARCHAR(20) NULL",
        },
        "lgu_requests": {
            "region": "NVARCHAR(255) NULL",
            "region_code": "NVARCHAR(20) NULL",
            "city_code": "NVARCHAR(20) NULL",
            "barangay_code": "NVARCHAR(20) NULL",
        },
        "detections": {
            "frame_url": "NVARCHAR(500) NULL",
        },
        "login_audits": {
            "user_id": "NVARCHAR(36) NULL",
            "logout_at": "DATETIME2 NULL",
        },
    }
    with engine.begin() as connection:
        for table_name, columns in compatibility_columns.items():
            for column_name, column_type in columns.items():
                connection.execute(text(
                    f"""
                    IF COL_LENGTH('{table_name}', '{column_name}') IS NULL
                        ALTER TABLE {table_name} ADD {column_name} {column_type}
                    """
                ))
        connection.execute(text(
            """
            UPDATE jobs
            SET status = LOWER(status)
            WHERE LOWER(status) IN ('pending', 'processing', 'completed', 'failed')
            """
        ))
    print(" Database tables created successfully")

def get_db() -> Session:
    """Get database session (synchronous)"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@contextmanager
def get_db_context():
    """Context manager for database session"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def test_database_connection():
    """Test Azure SQL Server connection"""
    try:
        with engine.connect() as conn:
            from sqlalchemy import text
            result = conn.execute(text("SELECT @@VERSION"))
            version = result.fetchone()
            print(f"Connected to SQL Server")
            print(f"   Version: {version[0][:100]}...")
            return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False

if __name__ == "__main__":
    print("Testing Azure SQL Server connection...")
    if test_database_connection():
        print("\nInitializing database tables...")
        init_db()
    else:
        print("\nCannot initialize database - connection failed")
