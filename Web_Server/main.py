"""
RoadSense Web Server — Entry Point
All routes live in routers/. All shared logic lives in services/.
"""

import logging
import secrets
from datetime import datetime

import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings, create_directories
from azure_storage import azure_storage
from database import init_db, test_database_connection
from security import Limit, rate_limiter, rate_limit_response, request_client_ip
from services.sae_bootstrap import ensure_initial_sae_account

from routers import auth, lgu, uploads, jobs, detections, dashboard, reports, search, locations


# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="RoadSense API (Azure SQL)",
    description="Backend API for Road Distress Detection System with Azure SQL Server",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    # allow_origins=["http://localhost:5173"],
    allow_origins=[
    "http://localhost:5173",
    "http://localhost:5174",
    "http://192.168.18.227:5174",
    "https://icy-island-08c649f0f.7.azurestaticapps.net",
], # Allow local IP for testing on other devices
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def enforce_rate_limits(request: Request, call_next):
    """Throttle public API traffic by IP and authenticated user when available."""
    path = request.url.path
    if not path.startswith("/api/"):
        return await call_next(request)

    # Trusted GPU callbacks already authenticate with a high-entropy key and
    # may upload many detection assets for one job. Do not throttle them as if
    # they were public browser traffic.
    worker_key = request.headers.get("x-worker-key", "")
    if settings.GPU_WORKER_API_KEY and secrets.compare_digest(
        worker_key, settings.GPU_WORKER_API_KEY
    ):
        return await call_next(request)

    if path.startswith("/api/auth/"):
        limit = Limit(settings.RATE_LIMIT_AUTH_PER_MINUTE, 60)
    elif path.startswith("/api/upload/"):
        limit = Limit(settings.RATE_LIMIT_UPLOADS_PER_10_MINUTES, 600)
    else:
        limit = Limit(settings.RATE_LIMIT_PUBLIC_PER_MINUTE, 60)

    ip = request_client_ip(request)
    retry_after = rate_limiter.check(f"ip:{path}:{ip}", limit)
    if retry_after:
        return rate_limit_response(retry_after)

    # A signed token's subject gives a second, user-based throttle without a DB
    # lookup. Invalid tokens remain handled by the route's auth dependency.
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        try:
            from auth_security import _read_token
            subject = _read_token(authorization.split(" ", 1)[1]).get("sub")
            if subject:
                retry_after = rate_limiter.check(f"user:{path}:{subject}", limit)
                if retry_after:
                    return rate_limit_response(retry_after)
        except Exception:
            pass

    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, __: RequestValidationError):
    """Avoid reflecting request bodies or internals in validation errors."""
    return JSONResponse(status_code=422, content={"detail": "Invalid request data."})


@app.middleware("http")
async def add_security_headers(_: Request, call_next):
    """Baseline OWASP browser protections for JSON and file API responses."""
    response = await call_next(_)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if settings.ENVIRONMENT.lower() == "production":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(lgu.router)
app.include_router(uploads.router)
app.include_router(jobs.router)
app.include_router(detections.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(search.router)
app.include_router(locations.router)

# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup_event():
    print("\n Starting RoadSense Web Server (Azure SQL)...")
    create_directories()

    print("\n Testing Azure Blob Storage...")
    try:
        if azure_storage:
            azure_storage._ensure_containers_exist()
            print(" Azure Blob Storage ready!")
        else:
            print("  Azure Blob Storage not configured")
    except Exception as e:
        print(f" Azure Blob Storage error: {e}")

    print("\n Testing Azure SQL Server...")
    if test_database_connection():
        print("\n Initializing database tables...")
        init_db()
        print("\n Ensuring initial SAE account...")
        ensure_initial_sae_account()
    else:
        print(" Database connection failed!")

    print("\n Server ready!")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status":           "online",
        "service":          "RoadSense API (Azure SQL)",
        "version":          "1.0.0",
        "timestamp":        datetime.now().isoformat(),
        "database":         settings.AZURE_DB_HOST,
        "storage":          "Azure Blob Storage",
        "max_video_size_mb": settings.MAX_VIDEO_SIZE // (1024 * 1024),
    }


# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"\n Starting server at http://{settings.SERVER_HOST}:{settings.SERVER_PORT}")
    print(f" API Docs: http://{settings.SERVER_HOST}:{settings.SERVER_PORT}/docs")

    uvicorn.run(
        "main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=True,
    )
