"""
Pydantic models for API requests and responses
"""
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from enum import Enum

class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class StrictRequestModel(BaseModel):
    """Reject misspelled/unexpected JSON fields instead of silently ignoring them."""
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class UploadResponse(BaseModel):
    success: bool
    message: str
    job_id: str
    filename: str

class DashcamSessionRequest(StrictRequestModel):
    dashcam_mode: bool = True
    dashcam_has_gps: bool = False
    conn_mode: Optional[str] = Field(None, max_length=30)
    user_id: Optional[str] = Field(None, max_length=50)
    is_anonymous: bool = True

class JobInfo(BaseModel):
    job_id: str
    status: str
    video_filename: str
    created_at: str
    total_detections: Optional[int] = 0
