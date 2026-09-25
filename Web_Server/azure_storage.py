"""
Azure Blob Storage handler for file uploads
"""

from azure.storage.blob import BlobServiceClient, BlobSasPermissions, ContentSettings, generate_blob_sas
from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
from config import settings
from typing import Optional, BinaryIO
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse

class AzureStorageManager:
    def __init__(self):
        """Initialize Azure Blob Storage client"""
        self.account_name = settings.AZURE_STORAGE_ACCOUNT_NAME
        self.account_key = settings.AZURE_STORAGE_ACCOUNT_KEY

        # Use connection string if available, otherwise use account name + key
        if settings.AZURE_STORAGE_CONNECTION_STRING:
            self._load_account_from_connection_string(settings.AZURE_STORAGE_CONNECTION_STRING)
            self.blob_service_client = BlobServiceClient.from_connection_string(
                settings.AZURE_STORAGE_CONNECTION_STRING
            )
        else:
            account_url = f"https://{settings.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net"
            self.blob_service_client = BlobServiceClient(
                account_url=account_url,
                credential=settings.AZURE_STORAGE_ACCOUNT_KEY
            )

        # Create containers if they don't exist
        self._ensure_containers_exist()

    def _load_account_from_connection_string(self, connection_string: str):
        parts = {}
        for part in connection_string.split(";"):
            if "=" in part:
                key, value = part.split("=", 1)
                parts[key] = value

        self.account_name = self.account_name or parts.get("AccountName")
        self.account_key = self.account_key or parts.get("AccountKey")

    def _ensure_containers_exist(self):
        """Create blob containers if they don't exist"""
        containers = [
            settings.AZURE_STORAGE_CONTAINER_VIDEOS,
            settings.AZURE_STORAGE_CONTAINER_GPS,
            settings.AZURE_STORAGE_CONTAINER_CROPS,
            settings.AZURE_STORAGE_CONTAINER_REPORTS
        ]

        for container_name in containers:
            try:
                container_client = self.blob_service_client.get_container_client(container_name)
                container_client.create_container()
                print(f"Created container: {container_name}")
            except ResourceExistsError:
                print(f"Container already exists: {container_name}")
            except Exception as e:
                print(f"Error creating container {container_name}: {e}")

    def upload_video(self, file_data: BinaryIO, filename: str, job_id: str) -> str:
        """
        Upload video file to Azure Blob Storage
        Returns: blob URL
        """
        container_client = self.blob_service_client.get_container_client(
            settings.AZURE_STORAGE_CONTAINER_VIDEOS
        )

        # Generate blob name
        file_extension = Path(filename).suffix
        blob_name = f"{job_id}/{job_id}{file_extension}"

        # Upload file
        blob_client = container_client.get_blob_client(blob_name)

        # Set content type based on extension
        content_settings = ContentSettings(content_type=self._get_content_type(file_extension))

        blob_client.upload_blob(
            file_data,
            overwrite=True,
            content_settings=content_settings
        )

        return blob_client.url

    def upload_photo(self, file_data: BinaryIO, filename: str, job_id: str) -> str:
        """Upload a source photo using the existing media container."""
        return self.upload_video(file_data, filename, job_id)

    def upload_gps(self, file_data: BinaryIO, job_id: str) -> str:
        """
        Upload GPS trace to Azure Blob Storage

        Returns: blob URL
        """
        container_client = self.blob_service_client.get_container_client(
            settings.AZURE_STORAGE_CONTAINER_GPS
        )

        blob_name = f"{job_id}/{job_id}_gps.json"
        blob_client = container_client.get_blob_client(blob_name)

        content_settings = ContentSettings(content_type="application/json")

        blob_client.upload_blob(
            file_data,
            overwrite=True,
            content_settings=content_settings
        )

        return blob_client.url

    def upload_crop(self, file_data: BinaryIO, filename: str, job_id: str) -> str:
        """
        Upload cropped detection image to Azure Blob Storage

        Returns: blob URL
        """
        container_client = self.blob_service_client.get_container_client(
            settings.AZURE_STORAGE_CONTAINER_CROPS
        )

        blob_name = f"{job_id}/{filename}"
        blob_client = container_client.get_blob_client(blob_name)

        content_settings = ContentSettings(content_type="image/jpeg")

        blob_client.upload_blob(
            file_data,
            overwrite=True,
            content_settings=content_settings
        )

        return blob_client.url

    def upload_report(self, file_data: BinaryIO, job_id: str) -> str:
        """
        Upload detection report (JSON) to Azure Blob Storage

        Returns: blob URL
        """
        container_client = self.blob_service_client.get_container_client(
            settings.AZURE_STORAGE_CONTAINER_REPORTS
        )

        blob_name = f"{job_id}/{job_id}_report.json"
        blob_client = container_client.get_blob_client(blob_name)

        content_settings = ContentSettings(content_type="application/json")

        blob_client.upload_blob(
            file_data,
            overwrite=True,
            content_settings=content_settings
        )

        return blob_client.url

    def download_blob(self, container_name: str, blob_name: str) -> bytes:
        """Download blob data"""
        container_client = self.blob_service_client.get_container_client(container_name)
        blob_client = container_client.get_blob_client(blob_name)

        return blob_client.download_blob().readall()

    def get_blob_url(self, container_name: str, blob_name: str) -> str:
        """Get public URL for a blob"""
        container_client = self.blob_service_client.get_container_client(container_name)
        blob_client = container_client.get_blob_client(blob_name)
        return blob_client.url

    def get_read_url(self, container_name: str, blob_name: str, expires_minutes: int = 60) -> str:
        """Get a temporary read URL for a private blob container."""
        blob_client = self.blob_service_client.get_blob_client(container_name, blob_name)
        if not self.account_name or not self.account_key:
            return blob_client.url

        sas = generate_blob_sas(
            account_name=self.account_name,
            container_name=container_name,
            blob_name=blob_name,
            account_key=self.account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.utcnow() + timedelta(minutes=expires_minutes),
        )
        return f"{blob_client.url}?{sas}"

    def get_read_url_from_blob_url(self, blob_url: str, expires_minutes: int = 60) -> str:
        """Convert an existing Azure blob URL into a temporary read URL."""
        parsed = urlparse(blob_url)
        path_parts = parsed.path.lstrip("/").split("/", 1)
        if len(path_parts) != 2:
            return blob_url

        container_name, blob_name = path_parts
        return self.get_read_url(container_name, blob_name, expires_minutes)

    def delete_blob(self, container_name: str, blob_name: str):
        """Delete a blob"""
        container_client = self.blob_service_client.get_container_client(container_name)
        blob_client = container_client.get_blob_client(blob_name)

        try:
            blob_client.delete_blob()
            print(f"Deleted blob: {blob_name}")
        except ResourceNotFoundError:
            print(f"Blob not found: {blob_name}")

    def list_blobs(self, container_name: str, prefix: Optional[str] = None):
        """List all blobs in container"""
        container_client = self.blob_service_client.get_container_client(container_name)
        return container_client.list_blobs(name_starts_with=prefix)

    def _get_content_type(self, extension: str) -> str:
        """Get MIME type from file extension"""
        content_types = {
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.json': 'application/json',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png'
        }
        return content_types.get(extension.lower(), 'application/octet-stream')

# Global instance
try:
    azure_storage = AzureStorageManager()
except:
    azure_storage = None
    print("Warning: Azure Storage not configured")
    
# Test function
def test_azure_connection():
    """Test Azure Blob Storage connection"""
    try:
        containers = [
            settings.AZURE_STORAGE_CONTAINER_VIDEOS,
            settings.AZURE_STORAGE_CONTAINER_GPS,
            settings.AZURE_STORAGE_CONTAINER_CROPS,
            settings.AZURE_STORAGE_CONTAINER_REPORTS
        ]

        print("Testing Azure Blob Storage connection...")
        for container in containers:
            container_client = azure_storage.blob_service_client.get_container_client(container)
            properties = container_client.get_container_properties()
            print(f"Container '{container}' is accessible")

        print("\nAzure Blob Storage is working!")
        return True
    except Exception as e:
        print(f"Azure connection failed: {e}")
        return False

if __name__ == "__main__":
    test_azure_connection()
