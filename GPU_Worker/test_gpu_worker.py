"""
Test script for GPU Worker API
"""
import httpx
import json

GPU_WORKER_URL = "http://localhost:8001"

def test_health_check():
    """Test if GPU Worker is online"""
    print("Testing GPU Worker health check...")
    
    try:
        response = httpx.get(f"{GPU_WORKER_URL}/")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_status():
    """Test GPU Worker status endpoint"""
    print("\nTesting GPU Worker status...")
    
    try:
        response = httpx.get(f"{GPU_WORKER_URL}/status")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

def test_processing_request():
    """Test sending a processing request"""
    print("\nTesting processing request...")
    
    # Dummy data for testing
    request_data = {
        "job_id": "test-job-123",
        "video_url": "https://example.com/video.mp4",
        "gps_url": "https://example.com/gps.json",
        "user_id": "test_user"
    }
    
    try:
        response = httpx.post(
            f"{GPU_WORKER_URL}/process",
            json=request_data,
            timeout=10.0
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    print("="*60)
    print("GPU WORKER API TEST")
    print("="*60)
    
    # Run tests
    test_health_check()
    test_status()
    # test_processing_request()  # Uncomment to test processing
    
    print("\n" + "="*60)
    print("Tests complete!")
    print("="*60)