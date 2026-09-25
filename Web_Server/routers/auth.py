"""
Authentication Router
POST /api/auth/login
POST /api/auth/signup
POST /api/auth/send-code
POST /api/auth/verify-code
POST /api/auth/forgot-password
POST /api/auth/reset-password
PATCH /api/auth/update-profile
"""

import re
import uuid
import secrets
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import Field
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from database import get_db, User, LGURequest, LGURequestStatus, LoginAudit, AuditEvent
from services.email_service import send_verification_code_email, send_password_reset_email
from services.ip_location import resolve_ip_location
from services.philippine_locations import resolve_saved_locality
from config import settings
from auth_security import (
    _read_token, bearer_scheme, create_access_token, get_current_user,
    require_admin, require_sae,
)
from models import StrictRequestModel
from security import request_client_ip

import random

logger     = logging.getLogger(__name__)
router     = APIRouter(prefix="/api/auth", tags=["Auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory stores (replace with Redis / DB columns in production)
verification_codes: dict[str, dict] = {}
reset_tokens:       dict[str, dict] = {}
login_attempts:     dict[str, dict] = {}

MAX_LOGIN_ATTEMPTS = 5
LOGIN_LOCKOUT_MINUTES = 15
VERIFICATION_CODE_TTL_MINUTES = 10
VERIFICATION_RESEND_WINDOW_MINUTES = 15
VERIFICATION_RESEND_LIMIT = 3
VERIFICATION_RESEND_COOLDOWN_SECONDS = 60


class LoginRequest(StrictRequestModel):
    username: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: str = Field("", max_length=20)


class SignupRequest(StrictRequestModel):
    full_name: str | None = Field(None, max_length=255)
    username: str | None = Field(None, max_length=255)
    email: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: str = Field("user", max_length=20)


class EmailRequest(StrictRequestModel):
    email: str = Field(max_length=255)


class VerifyCodeRequest(StrictRequestModel):
    email: str = Field(max_length=255)
    code: str = Field(min_length=4, max_length=12)


class ResetPasswordRequest(StrictRequestModel):
    token: str = Field(min_length=16, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class UpdateProfileRequest(StrictRequestModel):
    full_name: str = Field("", max_length=255)
    email: str = Field("", max_length=255)


class SAESignupRequest(StrictRequestModel):
    authorizer_username: str = Field(min_length=3, max_length=255)
    authorizer_password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=3, max_length=255)
    email: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)


# ── Helpers ───────────────────────────────────────────────────────────────────

def validate_password_strength(password: str) -> list[str]:
    errors = []
    if len(password) < 8:
        errors.append("at least 8 characters")
    if not re.search(r"[A-Z]", password):
        errors.append("one uppercase letter (A–Z)")
    if not re.search(r"[0-9]", password):
        errors.append("one number (0–9)")
    if not re.search(r"[^A-Za-z0-9]", password):
        errors.append("one special character (!@#$…)")
    return errors


def _login_key(username: str) -> str:
    return username.strip().lower()


def _get_lock_remaining_seconds(key: str, now: datetime) -> int:
    attempt = login_attempts.get(key)
    if not attempt:
        return 0

    locked_until = attempt.get("locked_until")
    if locked_until and now < locked_until:
        return int((locked_until - now).total_seconds()) + 1

    if locked_until and now >= locked_until:
        login_attempts.pop(key, None)

    return 0


def _check_login_lock(key: str, now: datetime) -> None:
    remaining = _get_lock_remaining_seconds(key, now)
    if remaining > 0:
        minutes = max(1, (remaining + 59) // 60)
        raise HTTPException(
            429,
            f"Too many failed login attempts. Account is locked for {minutes} minute(s)."
        )


def _record_failed_login(key: str, now: datetime) -> None:
    attempt = login_attempts.get(key, {"count": 0})
    count = attempt.get("count", 0) + 1

    if count >= MAX_LOGIN_ATTEMPTS:
        login_attempts[key] = {
            "count": count,
            "locked_until": now + timedelta(minutes=LOGIN_LOCKOUT_MINUTES),
        }
        raise HTTPException(
            429,
            f"Too many failed login attempts. Account is locked for {LOGIN_LOCKOUT_MINUTES} minutes."
        )

    login_attempts[key] = {"count": count, "locked_until": None}
    remaining = MAX_LOGIN_ATTEMPTS - count
    raise HTTPException(401, f"Incorrect password. {remaining} attempt(s) remaining.")


def _clear_login_attempts(key: str) -> None:
    login_attempts.pop(key, None)


# ── Routes ────────────────────────────────────────────────────────────────────

def _audit_login(
    db: Session,
    request: Request,
    username: str,
    requested_role: str = "",
    actual_role: str | None = None,
    success: bool = False,
    reason: str | None = None,
    commit_now: bool = False,
) -> str | None:
    try:
        audit_id = str(uuid.uuid4())
        user = db.query(User).filter(User.full_name == username).first()
        db.add(LoginAudit(
            id=audit_id,
            user_id=user.id if user else None,
            username=(username or "").strip()[:255],
            requested_role=(requested_role or "").strip().lower()[:50] or None,
            actual_role=(actual_role or "").strip().lower()[:50] if actual_role else None,
            success=success,
            reason=(reason or "")[:255] or None,
            ip_address=request_client_ip(request)[:64],
            user_agent=(request.headers.get("user-agent") or "")[:500] or None,
            created_at=datetime.utcnow(),
        ))
        if commit_now:
            db.commit()
        return audit_id
    except Exception as exc:
        db.rollback()
        logger.warning(f"Could not write login audit for {username}: {exc}")
        return None


@router.post("/login")
def login(credentials: LoginRequest, request: Request, db: Session = Depends(get_db)):
    username = credentials.username.strip()
    password = credentials.password
    requested_role = credentials.role.lower()
    key = _login_key(username)
    now = datetime.utcnow()

    if not username or not password:
        raise HTTPException(400, "Username and password required.")

    try:
        _check_login_lock(key, now)
    except HTTPException:
        _audit_login(db, request, username, requested_role, success=False, reason="locked", commit_now=True)
        raise

    user = db.query(User).filter(User.full_name == username).first()
    if not user:
        _audit_login(db, request, username, requested_role, success=False, reason="account_not_found", commit_now=True)
        _record_failed_login(key, now)

    if not pwd_context.verify(password, user.password_hash):
        _audit_login(db, request, username, requested_role, actual_role=user.role, success=False, reason="incorrect_password", commit_now=True)
        _record_failed_login(key, now)

    if user.role not in ("admin", "lgu", "user", "sae"):
        _audit_login(db, request, username, requested_role, actual_role=user.role, success=False, reason="insufficient_permissions", commit_now=True)
        raise HTTPException(403, "Insufficient permissions.")

    # Role mismatch check
    if requested_role and requested_role != user.role:
        _audit_login(db, request, username, requested_role, actual_role=user.role, success=False, reason="role_mismatch", commit_now=True)
        if requested_role == "admin":
            raise HTTPException(403, "This account is not an admin account.")
        elif requested_role == "lgu":
            raise HTTPException(403, "This account is not an LGU account.")
        elif requested_role == "sae":
            raise HTTPException(403, "This account is not an SAE account.")

    region   = None
    region_code = None
    city_code = None
    city     = None
    barangay = None

    # LGU whitelist check
    if user.role == "lgu":
        lgu_req = db.query(LGURequest).filter(LGURequest.email == user.email).first()

        if not lgu_req:
            _audit_login(db, request, username, requested_role, actual_role=user.role, success=False, reason="lgu_request_missing", commit_now=True)
            raise HTTPException(403, "Your LGU has not submitted a registration request.")
        if lgu_req.status == LGURequestStatus.PENDING:
            _audit_login(db, request, username, requested_role, actual_role=user.role, success=False, reason="lgu_pending_or_revoked", commit_now=True)
            raise HTTPException(403, "Your LGU account access has been revoked or is pending approval. Check your email or contact your administrator.")
        if lgu_req.status == LGURequestStatus.REJECTED:
            _audit_login(db, request, username, requested_role, actual_role=user.role, success=False, reason="lgu_rejected", commit_now=True)
            raise HTTPException(403, "Your LGU registration was rejected.")
        if lgu_req.status != LGURequestStatus.APPROVED:
            _audit_login(db, request, username, requested_role, actual_role=user.role, success=False, reason="lgu_not_approved", commit_now=True)
            raise HTTPException(403, "Your LGU account is not approved.")

        if not lgu_req.region_code or not lgu_req.city_code:
            try:
                locality = resolve_saved_locality(lgu_req.city, lgu_req.barangay)
            except HTTPException as exc:
                logger.warning(
                    f"Could not backfill LGU jurisdiction for {user.email}: {exc.detail}"
                )
                locality = None
            if locality:
                lgu_req.region = locality["region"]
                lgu_req.region_code = locality["region_code"]
                lgu_req.city = locality["city"]
                lgu_req.city_code = locality["city_code"]
                lgu_req.barangay = locality["barangay"]
                lgu_req.barangay_code = locality["barangay_code"]

        region   = lgu_req.region
        region_code = lgu_req.region_code
        city_code = lgu_req.city_code
        city     = lgu_req.city
        barangay = lgu_req.barangay

    user.last_login = now
    session_id = _audit_login(
        db, request, username, requested_role,
        actual_role=user.role, success=True, reason="login_success",
    )
    db.commit()
    _clear_login_attempts(key)
    logger.info(f"User logged in: {user.full_name} ({user.role})")

    return {
        "access_token": create_access_token(user, session_id),
        "token_type": "bearer",
        "user_id":   user.id,
        "full_name": user.full_name,
        "role":      user.role,
        "email":     user.email,
        "region":    region,
        "region_code": region_code,
        "city":      city,
        "city_code": city_code,
        "barangay":  barangay,
    }


@router.post("/signup")
def signup(credentials: SignupRequest, db: Session = Depends(get_db)):
    full_name = credentials.full_name or credentials.username
    email     = credentials.email.strip().lower()
    password  = credentials.password
    role      = (credentials.role or "user").strip().lower()

    if not full_name or not email or not password:
        raise HTTPException(400, "full_name, email, and password are required.")
    if role == "admin":
        raise HTTPException(403, "Admin accounts can only be created from the admin dashboard.")
    if role not in ("user", "lgu"):
        raise HTTPException(400, "Public signup only supports user and LGU accounts.")
    if role == "lgu":
        lgu_req = db.query(LGURequest).filter(LGURequest.email == email).first()
        if not lgu_req or lgu_req.status != LGURequestStatus.APPROVED:
            raise HTTPException(403, "LGU registration requires prior administrator approval.")

    pw_errors = validate_password_strength(password)
    if pw_errors:
        raise HTTPException(422, f"Password must contain: {', '.join(pw_errors)}.")

    if db.query(User).filter(User.full_name == full_name).first():
        raise HTTPException(409, "Username already taken.")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "Email already registered.")

    try:
        new_user = User(
            id=str(uuid.uuid4()),
            full_name=full_name.strip(),
            email=email,
            password_hash=pwd_context.hash(password),
            role=role,
            created_at=datetime.utcnow(),
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        if role == "lgu":
            lgu_req = db.query(LGURequest).filter(LGURequest.email == email).first()
            if lgu_req:
                logger.info(f"LGU request for {email} fulfilled by user {new_user.id} ({full_name})")

        logger.info(f"New {role} user created: {full_name} ({email})")

        return {
            "success":   True,
            "user_id":   new_user.id,
            "full_name": new_user.full_name,
            "email":     new_user.email,
            "role":      new_user.role,
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Signup failed for {email}: {e}", exc_info=True)
        raise HTTPException(500, "Internal server error during signup.")


@router.post("/admin/signup")
def admin_signup(
    credentials: SignupRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    full_name = credentials.full_name or credentials.username
    email     = credentials.email.strip().lower()
    password  = credentials.password
    role      = (credentials.role or "user").strip().lower()

    if role != "admin":
        raise HTTPException(400, "This endpoint only creates admin accounts.")
    if not full_name or not email or not password:
        raise HTTPException(400, "full_name, email, and password are required.")

    pw_errors = validate_password_strength(password)
    if pw_errors:
        raise HTTPException(422, f"Password must contain: {', '.join(pw_errors)}.")

    if db.query(User).filter(User.full_name == full_name).first():
        raise HTTPException(409, "Username already taken.")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "Email already registered.")

    try:
        new_user = User(
            id=str(uuid.uuid4()),
            full_name=full_name.strip(),
            email=email,
            password_hash=pwd_context.hash(password),
            role="admin",
            created_at=datetime.utcnow(),
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        logger.info(f"New admin user created by {admin.full_name}: {full_name} ({email})")

        return {
            "success":   True,
            "user_id":   new_user.id,
            "full_name": new_user.full_name,
            "email":     new_user.email,
            "role":      new_user.role,
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Admin signup failed for {email}: {e}", exc_info=True)
        raise HTTPException(500, "Internal server error during admin signup.")


@router.post("/sae/signup")
def sae_signup(
    credentials: SAESignupRequest,
    sae: User = Depends(require_sae),
    db: Session = Depends(get_db),
):
    authorizer_username = credentials.authorizer_username.strip()
    authorizer_password = credentials.authorizer_password
    full_name = credentials.full_name.strip()
    email = credentials.email.strip().lower()
    password = credentials.password

    if sae.full_name != authorizer_username or not pwd_context.verify(authorizer_password, sae.password_hash):
        raise HTTPException(403, "SAE credential confirmation failed.")

    pw_errors = validate_password_strength(password)
    if pw_errors:
        raise HTTPException(422, f"Password must contain: {', '.join(pw_errors)}.")

    if db.query(User).filter(User.full_name == full_name).first():
        raise HTTPException(409, "Username already taken.")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "Email already registered.")

    try:
        new_user = User(
            id=str(uuid.uuid4()),
            full_name=full_name,
            email=email,
            password_hash=pwd_context.hash(password),
            role="sae",
            created_at=datetime.utcnow(),
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        logger.info(f"New SAE user created by {sae.full_name}: {full_name} ({email})")

        return {
            "success": True,
            "user_id": new_user.id,
            "full_name": new_user.full_name,
            "email": new_user.email,
            "role": new_user.role,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"SAE signup failed for {email}: {e}", exc_info=True)
        raise HTTPException(500, "Internal server error during SAE signup.")


@router.post("/send-code")
def send_verification_code(data: EmailRequest):
    email = data.email.strip().lower()
    if not email:
        raise HTTPException(400, "Email is required.")
    if not settings.GMAIL_ADDRESS or not settings.GMAIL_APP_PASSWORD:
        raise HTTPException(500, "Email service not configured.")

    now = datetime.utcnow()
    existing = verification_codes.get(email)
    if existing:
        window_started_at = existing.get("window_started_at", now)
        if now - window_started_at > timedelta(minutes=VERIFICATION_RESEND_WINDOW_MINUTES):
            existing = None
        else:
            last_sent_at = existing.get("last_sent_at")
            if last_sent_at and now - last_sent_at < timedelta(seconds=VERIFICATION_RESEND_COOLDOWN_SECONDS):
                remaining = VERIFICATION_RESEND_COOLDOWN_SECONDS - int((now - last_sent_at).total_seconds())
                raise HTTPException(429, f"Please wait {remaining} seconds before requesting another code.")

            resend_count = existing.get("resend_count", 1)
            if resend_count >= VERIFICATION_RESEND_LIMIT:
                raise HTTPException(
                    429,
                    f"Too many verification codes requested. Please try again after {VERIFICATION_RESEND_WINDOW_MINUTES} minutes."
                )

    code = str(random.randint(100000, 999999))
    verification_codes[email] = {
        "code": code,
        "expires_at": now + timedelta(minutes=VERIFICATION_CODE_TTL_MINUTES),
        "window_started_at": existing.get("window_started_at", now) if existing else now,
        "last_sent_at": now,
        "resend_count": existing.get("resend_count", 0) + 1 if existing else 1,
    }

    try:
        send_verification_code_email(email, code)
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        raise HTTPException(500, f"Failed to send email: {e}")

    return {"success": True, "message": "Verification code sent."}


@router.post("/verify-code")
def verify_code(data: VerifyCodeRequest):
    email = data.email.strip().lower()
    code  = data.code

    stored = verification_codes.get(email)
    if not stored:
        raise HTTPException(400, "Invalid or expired verification code.")
    if datetime.utcnow() > stored["expires_at"]:
        del verification_codes[email]
        raise HTTPException(400, "Invalid or expired verification code.")
    if stored["code"] != code:
        raise HTTPException(400, "Invalid or expired verification code.")

    del verification_codes[email]
    return {"success": True, "message": "Email verified."}


@router.post("/forgot-password")
def forgot_password(data: EmailRequest, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    if not email:
        raise HTTPException(400, "Email is required.")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Prevent email enumeration
        return {"success": True, "message": "If that email exists, a reset link has been sent."}

    token = secrets.token_urlsafe(32)
    reset_tokens[token] = {
        "email":      email,
        "expires_at": datetime.utcnow() + timedelta(minutes=30),
    }

    reset_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/reset-password?token={token}"

    try:
        send_password_reset_email(email, reset_url)
    except Exception as e:
        logger.error(f"Failed to send reset email: {e}")

    return {"success": True, "message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    token    = data.token.strip()
    password = data.password

    if not token or not password:
        raise HTTPException(400, "Token and password are required.")

    token_data = reset_tokens.get(token)
    if not token_data:
        raise HTTPException(400, "Invalid or expired reset link.")
    if datetime.utcnow() > token_data["expires_at"]:
        del reset_tokens[token]
        raise HTTPException(400, "Reset link has expired. Please request a new one.")

    pw_errors = validate_password_strength(password)
    if pw_errors:
        raise HTTPException(422, f"Password must contain: {', '.join(pw_errors)}.")

    user = db.query(User).filter(User.email == token_data["email"]).first()
    if not user:
        raise HTTPException(404, "Account not found.")

    user.password_hash = pwd_context.hash(password)
    db.flush()
    db.commit()
    db.refresh(user)

    if not pwd_context.verify(password, user.password_hash):
        logger.error(f"Hash verification failed after reset for {token_data['email']}")
        raise HTTPException(500, "Password update failed. Please try again.")

    del reset_tokens[token]
    logger.info(f"Password reset successful for {token_data['email']}")
    return {"success": True, "message": "Password reset successfully."}


@router.patch("/update-profile")
def update_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id  = current_user.id
    username = data.full_name.strip()
    email    = data.email.strip().lower()

    if not user_id:
        raise HTTPException(400, "user_id is required.")

    user = current_user

    if username and username != user.full_name:
        if db.query(User).filter(User.full_name == username, User.id != user_id).first():
            raise HTTPException(409, "Username already taken.")
        user.full_name = username

    if email and email != user.email:
        if db.query(User).filter(User.email == email, User.id != user_id).first():
            raise HTTPException(409, "Email already in use.")
        user.email = email

    db.commit()
    db.refresh(user)
    logger.info(f"Profile updated for user {user_id}")

    return {
        "success":   True,
        "user_id":   user.id,
        "full_name": user.full_name,
        "email":     user.email,
        "role":      user.role,
    }


@router.get("/login-logs")
def get_login_logs(
    kind: str = Query("all", pattern="^(all|admin|sae|lgu|failed)$"),
    limit: int = Query(100, ge=1, le=500),
    _: User = Depends(require_sae),
    db: Session = Depends(get_db),
):
    query = db.query(LoginAudit)
    if kind == "admin":
        query = query.filter(LoginAudit.actual_role == "admin")
    elif kind == "sae":
        query = query.filter(LoginAudit.actual_role == "sae")
    elif kind == "lgu":
        query = query.filter(LoginAudit.actual_role == "lgu")
    elif kind == "failed":
        query = query.filter(LoginAudit.success == False)  # noqa: E712

    logs = query.order_by(LoginAudit.created_at.desc()).limit(limit).all()
    return {
        "logs": [
            {
                "id": log.id,
                "username": log.username,
                "requested_role": log.requested_role,
                "actual_role": log.actual_role,
                "success": log.success,
                "reason": log.reason,
                "ip_location": resolve_ip_location(log.ip_address),
                "user_agent": log.user_agent,
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "logout_at": log.logout_at.isoformat() if log.logout_at else None,
            }
            for log in logs
        ]
    }


@router.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """Close the login session represented by the current bearer token."""
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Authentication required.")
    payload = _read_token(credentials.credentials)
    session_id = payload.get("sid")
    if session_id:
        audit = db.query(LoginAudit).filter(LoginAudit.id == session_id).first()
        if audit and not audit.logout_at:
            audit.logout_at = datetime.utcnow()
            db.commit()
    return {"success": True}


@router.get("/security-events")
def get_security_events(
    role: str = Query(..., pattern="^(admin|lgu)$"),
    category: str = Query("all", pattern="^(all|validation|deletion|lgu_approval)$"),
    limit: int = Query(200, ge=1, le=500),
    _: User = Depends(require_sae),
    db: Session = Depends(get_db),
):
    query = db.query(AuditEvent).filter(AuditEvent.actor_role == role)
    if category != "all":
        query = query.filter(AuditEvent.category == category)
    events = query.order_by(AuditEvent.created_at.desc()).limit(limit).all()
    return {
        "events": [
            {
                "id": event.id,
                "actor_id": event.actor_id,
                "actor_name": event.actor_name,
                "actor_role": event.actor_role,
                "category": event.category,
                "action": event.action,
                "resource_type": event.resource_type,
                "resource_id": event.resource_id,
                "details": event.details or {},
                "ip_location": resolve_ip_location(event.ip_address),
                "created_at": event.created_at.isoformat() if event.created_at else None,
            }
            for event in events
        ]
    }


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "user_id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
    }
