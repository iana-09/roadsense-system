"""
Configuration settings for Web Server with Azure SQL Server
"""
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from typing import Optional
from urllib.parse import quote_plus


class Settings(BaseSettings):
    # Server settings
    SERVER_HOST: str = "0.0.0.0"
    SERVER_PORT: int = 8000
    ENVIRONMENT: str = "development"
    AUTH_SECRET: str
    AUTH_TOKEN_EXPIRE_MINUTES: int = 480
    PSGC_API_URL: str = "https://psgc.cloud/api"
    NOMINATIM_URL: str = "https://nominatim.openstreetmap.org"
    GEOCODER_USER_AGENT: str = "RoadSense-Thesis/1.0"
    IP_LOCATION_API_URL: str = "https://ipwho.is"
    # Enable only behind a reverse proxy that overwrites X-Forwarded-For.
    TRUST_PROXY_HEADERS: bool = False
    RATE_LIMIT_PUBLIC_PER_MINUTE: int = 120
    RATE_LIMIT_AUTH_PER_MINUTE: int = 20
    RATE_LIMIT_UPLOADS_PER_10_MINUTES: int = 8

    @field_validator("AUTH_SECRET")
    @classmethod
    def validate_auth_secret(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("AUTH_SECRET must be at least 32 characters.")
        return value

    @field_validator("GPU_WORKER_API_KEY")
    @classmethod
    def validate_gpu_worker_api_key(cls, value: Optional[str]) -> Optional[str]:
        if value and len(value) < 32:
            raise ValueError("GPU_WORKER_API_KEY must be at least 32 characters.")
        return value

    # Local file storage (temporary, before Azure upload)
    TEMP_DIR: Path = Path("temp")

    # Azure SQL Server Database
    AZURE_DB_HOST: str
    AZURE_DB_PORT: int = 1433
    AZURE_DB_NAME: str
    AZURE_DB_USER: str
    AZURE_DB_PASSWORD: str
    AZURE_DB_DRIVER: str = "ODBC Driver 18 for SQL Server"

    @property
    def DATABASE_URL_SYNC(self) -> str:
        """Construct synchronous SQL Server connection URL (for pyodbc)"""
        encoded_password = quote_plus(self.AZURE_DB_PASSWORD)
        encoded_user = quote_plus(self.AZURE_DB_USER)

        return (
            f"mssql+pyodbc://{encoded_user}:{encoded_password}"
            f"@{self.AZURE_DB_HOST}:{self.AZURE_DB_PORT}/{self.AZURE_DB_NAME}"
            f"?driver={quote_plus(self.AZURE_DB_DRIVER)}"
            f"&Encrypt=yes&TrustServerCertificate=no&Connection+Timeout=30"
        )

    # Azure Blob Storage
    AZURE_STORAGE_CONNECTION_STRING: Optional[str] = None
    AZURE_STORAGE_ACCOUNT_NAME: Optional[str] = None
    AZURE_STORAGE_ACCOUNT_KEY: Optional[str] = None

    # Azure Blob Containers
    AZURE_STORAGE_CONTAINER_VIDEOS: str = "videos"
    AZURE_STORAGE_CONTAINER_GPS: str = "gps-traces"
    AZURE_STORAGE_CONTAINER_CROPS: str = "detection-crops"
    AZURE_STORAGE_CONTAINER_REPORTS: str = "reports"

    # Gmail settings for email verification
    GMAIL_ADDRESS: str
    GMAIL_APP_PASSWORD: str
    # GPU Worker settings
    GPU_WORKER_PUBLIC_URL: Optional[str] = None
    GPU_WORKER_HOST: str = "localhost"
    GPU_WORKER_PORT: int = 8001
    GPU_WORKER_API_KEY: Optional[str] = None

    @property
    def GPU_WORKER_URL(self) -> str:
        if self.GPU_WORKER_PUBLIC_URL:
            url = self.GPU_WORKER_PUBLIC_URL.strip().rstrip("/")
            if "://" not in url:
                url = f"https://{url}"
            return url
        return f"http://{self.GPU_WORKER_HOST}:{self.GPU_WORKER_PORT}"

    # File size limits (2 GB max for 30 min @ 720p video)
    MAX_VIDEO_SIZE: int = 2 * 1024 * 1024 * 1024  # 2 GB (absolute max)
    RECOMMENDED_VIDEO_SIZE: int = int(1.5 * 1024 * 1024 * 1024)  # 1.5 GB (practical)
    MAX_GPS_SIZE: int = 10 * 1024 * 1024  # 10 MB

    # API settings
    API_PREFIX: str = "/api"
    API_VERSION: str = "v1"

    #  Pydantic v2 configuration
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True
    )


settings = Settings()


# Create necessary local directories
def create_directories():
    """Create temporary local directories"""
    directories = [
        settings.TEMP_DIR,
    ]

    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)
        print(f" Created directory: {directory}")


if __name__ == "__main__":
    create_directories()
    print("\nConfiguration:")
    print(f"  Database Host: {settings.AZURE_DB_HOST}")
    print(f"  Database Name: {settings.AZURE_DB_NAME}")
    print(f"  Environment: {settings.ENVIRONMENT}")
    print(f"  GPU Worker: {settings.GPU_WORKER_URL}")
    print(f"  Max Video Size: {settings.MAX_VIDEO_SIZE // (1024*1024)}MB")
