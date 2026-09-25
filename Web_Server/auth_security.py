"""Signed bearer-session helpers and authorization dependencies."""

import base64
import binascii
import hashlib
import hmac
import json
import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from config import settings
from database import User, get_db


bearer_scheme = HTTPBearer(auto_error=False)


def _encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def create_access_token(user: User, session_id: str | None = None) -> str:
    payload = {
        "sub": user.id,
        "exp": int(time.time()) + (settings.AUTH_TOKEN_EXPIRE_MINUTES * 60),
    }
    if session_id:
        payload["sid"] = session_id
    encoded_payload = _encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signature = hmac.new(
        settings.AUTH_SECRET.encode("utf-8"),
        encoded_payload.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return f"{encoded_payload}.{_encode(signature)}"


def _read_token(token: str) -> dict:
    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        expected_signature = hmac.new(
            settings.AUTH_SECRET.encode("utf-8"),
            encoded_payload.encode("ascii"),
            hashlib.sha256,
        ).digest()
        supplied_signature = _decode(encoded_signature)
        if not hmac.compare_digest(expected_signature, supplied_signature):
            raise ValueError("invalid signature")

        payload = json.loads(_decode(encoded_payload))
        if not payload.get("sub") or int(payload.get("exp", 0)) <= int(time.time()):
            raise ValueError("expired token")
        return payload
    except (
        ValueError,
        TypeError,
        KeyError,
        json.JSONDecodeError,
        binascii.Error,
        UnicodeDecodeError,
    ):
        raise HTTPException(401, "Invalid or expired session.")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Authentication required.")

    payload = _read_token(credentials.credentials)
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(401, "Session user no longer exists.")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(403, "Administrator access required.")
    return current_user


def require_sae(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "sae":
        raise HTTPException(403, "SAE access required.")
    return current_user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    if not credentials:
        return None
    return get_current_user(credentials, db)


def require_admin_or_lgu(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("admin", "lgu"):
        raise HTTPException(403, "LGU or administrator access required.")
    return current_user
