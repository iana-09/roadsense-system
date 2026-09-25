"""
LGU Router
POST   /api/lgu/request
GET    /api/lgu/requests
PATCH  /api/lgu/requests/{request_id}
GET    /api/lgu/check/{email}
GET    /api/lgu/resume/{email}
GET    /api/lgu/users
POST   /api/lgu/users/{user_id}/request-delete
DELETE /api/lgu/users/{user_id}
"""

import uuid
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from pydantic import Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db, User, Job, LGURequest, LGURequestStatus
from auth_security import require_admin
from models import StrictRequestModel
from services.email_service import (
    send_lgu_pending_email,
    send_lgu_decision_email,
    send_account_deletion_email,
)
from services.philippine_locations import validate_locality
from audit_log import record_audit_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/lgu", tags=["LGU"])


class LGURequestInput(StrictRequestModel):
    email: str = Field(min_length=5, max_length=255)
    region_code: str = Field(min_length=1, max_length=20)
    city_code: str = Field(min_length=1, max_length=20)
    barangay_code: str = Field(min_length=1, max_length=20)


class LGUReapplyInput(StrictRequestModel):
    email: str = Field(min_length=5, max_length=255)


@router.post("/request")
def submit_lgu_request(data: LGURequestInput, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    region_code = data.region_code.strip()
    city_code = data.city_code.strip()
    barangay_code = data.barangay_code.strip()

    if not email or not region_code or not city_code or not barangay_code:
        raise HTTPException(400, "email, region_code, city_code, and barangay_code are required.")

    locality = validate_locality(region_code, city_code, barangay_code)

    existing = db.query(LGURequest).filter(LGURequest.email == email).first()
    if existing:
        if existing.status == LGURequestStatus.APPROVED:
            return {"success": True, "status": "approved", "message": "Already approved."}
        if existing.status == LGURequestStatus.PENDING:
            raise HTTPException(409, "A request for this email is already pending. Please wait for admin approval.")
        if existing.status == LGURequestStatus.REJECTED:
            raise HTTPException(403, "This request was previously rejected. Contact the administrator.")

    new_request = LGURequest(
        id=str(uuid.uuid4()),
        email=email,
        region=locality["region"],
        region_code=locality["region_code"],
        city=locality["city"],
        city_code=locality["city_code"],
        barangay=locality["barangay"],
        barangay_code=locality["barangay_code"],
        status=LGURequestStatus.PENDING,
        created_at=datetime.utcnow(),
    )
    db.add(new_request)
    db.commit()
    logger.info(
        f"New LGU request: {email} - {locality['barangay']}, "
        f"{locality['city']}, {locality['region']}"
    )

    try:
        send_lgu_pending_email(email, locality["city"], locality["barangay"])
    except Exception as e:
        logger.error(f"Failed to send pending email to {email}: {e}")

    return {"success": True, "status": "pending", "message": "Request submitted."}


@router.post("/request/reapply")
def reapply_lgu_request(data: LGUReapplyInput, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    if not email:
        raise HTTPException(400, "email is required.")

    req = db.query(LGURequest).filter(LGURequest.email == email).first()
    if not req:
        raise HTTPException(404, "No registration request found for this email.")
    if req.status == LGURequestStatus.APPROVED:
        raise HTTPException(409, "This LGU request is already approved.")
    if req.status == LGURequestStatus.PENDING:
        raise HTTPException(409, "This LGU request is already pending admin review.")

    req.status = LGURequestStatus.PENDING
    req.reviewed_at = None
    req.reviewed_by = None
    db.commit()
    logger.info(f"Rejected LGU request reopened by applicant: {email}")

    try:
        send_lgu_pending_email(req.email, req.city, req.barangay)
    except Exception as e:
        logger.warning(f"Failed to send reapply notification to {email}: {e}")

    return {"success": True, "status": "pending"}


@router.get("/requests")
def get_lgu_requests(
    status: Optional[str] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(LGURequest)
    if status:
        try:
            query = query.filter(LGURequest.status == LGURequestStatus[status.upper()])
        except KeyError:
            raise HTTPException(400, f"Invalid status: {status}")

    requests = query.order_by(LGURequest.created_at.desc()).all()

    return {
        "total": len(requests),
        "requests": [
            {
                "id":          r.id,
                "email":       r.email,
                "region":      r.region,
                "region_code": r.region_code,
                "city":        r.city,
                "city_code":   r.city_code,
                "barangay":    r.barangay,
                "barangay_code": r.barangay_code,
                "status":      r.status.value,
                "created_at":  r.created_at.isoformat(),
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                "reviewed_by": r.reviewed_by,
            }
            for r in requests
        ],
    }


@router.patch("/requests/{request_id}")
def review_lgu_request(
    request_id: str,
    data: dict,
    request: Request,
    background_tasks: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    action     = data.get("action")
    admin_name = admin.full_name

    if action not in ("approve", "reject", "revoke", "reopen"):
        raise HTTPException(400, "action must be 'approve', 'reject', 'revoke', or 'reopen'.")

    req = db.query(LGURequest).filter(LGURequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found.")

    if action == "approve" and req.status != LGURequestStatus.PENDING:
        raise HTTPException(400, "Can only approve a pending request.")
    if action == "reject"  and req.status != LGURequestStatus.PENDING:
        raise HTTPException(400, "Can only reject a pending request.")
    if action == "revoke"  and req.status != LGURequestStatus.APPROVED:
        raise HTTPException(400, "Can only revoke an approved request.")
    if action == "reopen"  and req.status != LGURequestStatus.REJECTED:
        raise HTTPException(400, "Can only re-open a rejected request.")

    if action == "approve":
        req.status = LGURequestStatus.APPROVED
    elif action == "reject":
        req.status = LGURequestStatus.REJECTED
    elif action in ("revoke", "reopen"):
        req.status = LGURequestStatus.PENDING

    req.reviewed_at = datetime.utcnow()
    req.reviewed_by = admin_name
    record_audit_event(
        db, request, admin,
        category="lgu_approval",
        action=f"{action}_lgu_request",
        resource_type="lgu_request",
        resource_id=request_id,
        details={
            "email": req.email,
            "region": req.region,
            "city": req.city,
            "barangay": req.barangay,
            "resulting_status": req.status.value,
        },
    )
    db.commit()
    logger.info(f"LGU request {request_id} action='{action}' by {admin_name}")

    try:
        background_tasks.add_task(send_lgu_decision_email, req.email, req.city, req.barangay, action)
    except Exception as e:
        logger.warning(f"Failed to send notification email: {e}")

    return {"success": True, "status": req.status.value, "action": action}


@router.get("/check/{email}")
def check_lgu_status(email: str, db: Session = Depends(get_db)):
    req = db.query(LGURequest).filter(LGURequest.email == email).first()
    if not req:
        raise HTTPException(404, "No request found for this email.")
    return {
        "status":   req.status.value,
        "email":    req.email,
        "region":   req.region,
        "region_code": req.region_code,
        "city":     req.city,
        "city_code": req.city_code,
        "barangay": req.barangay,
        "barangay_code": req.barangay_code,
    }


@router.get("/resume/{email}")
def resume_lgu_registration(email: str, db: Session = Depends(get_db)):
    """
    Check if an LGU email:
      1. Has an APPROVED whitelist request
      2. Does NOT yet have a user account
    Returns status so the frontend knows what to show.
    """
    req = db.query(LGURequest).filter(LGURequest.email == email).first()
    if not req:
        raise HTTPException(404, "No registration request found for this email.")
    if req.status == LGURequestStatus.PENDING:
        raise HTTPException(403, "Your LGU request is still pending admin approval.")
    if req.status == LGURequestStatus.REJECTED:
        raise HTTPException(403, "Your LGU request was rejected. Contact the administrator.")

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(409, "An account already exists for this email. Please sign in.")

    return {
        "can_resume": True,
        "email":      req.email,
        "region":     req.region,
        "region_code": req.region_code,
        "city":       req.city,
        "city_code":  req.city_code,
        "barangay":   req.barangay,
        "barangay_code": req.barangay_code,
        "status":     req.status.value,
    }


# ── LGU Users endpoints ───────────────────────────────────────────────────────


@router.get("/mobile-users")
def get_mobile_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get all mobile app users with role='user'."""
    mobile_users = db.query(User).filter(User.role == "user").order_by(User.created_at.desc()).all()
    user_ids = [u.id for u in mobile_users]

    job_counts = {}
    if user_ids:
        rows = (
            db.query(Job.user_id, func.count(Job.id))
            .filter(Job.user_id.in_(user_ids))
            .group_by(Job.user_id)
            .all()
        )
        job_counts = {user_id: count for user_id, count in rows}

    return {
        "total": len(mobile_users),
        "users": [
            {
                "anonymous_id": f"USER-{u.id[-8:].upper()}",
                "role":        u.role,
                "created_at":  u.created_at.isoformat(),
                "last_login":  u.last_login.isoformat() if u.last_login else None,
                "upload_count": job_counts.get(u.id, 0),
            }
            for u in mobile_users
        ],
    }

@router.get("/users")
def get_lgu_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get all users with role='lgu' joined with their LGU request info."""
    lgu_users = db.query(User).filter(User.role == "lgu").all()

    result = []
    for u in lgu_users:
        req = db.query(LGURequest).filter(LGURequest.email == u.email).first()
        result.append({
            "user_id":    u.id,
            "full_name":  u.full_name,
            "email":      u.email,
            "role":       u.role,
            "created_at": u.created_at.isoformat(),
            "region":     req.region      if req else "—",
            "city":       req.city        if req else "—",
            "barangay":   req.barangay    if req else "—",
            "status":     req.status.value if req else "—",
        })

    return {"total": len(result), "users": result}


@router.post("/users/{user_id}/request-delete")
def request_delete_lgu_user(
    user_id: str,
    data: dict,
    request: Request,
    background_tasks: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin requests deletion — sends email to LGU to confirm."""
    admin_name = admin.full_name

    user = db.query(User).filter(User.id == user_id, User.role == "lgu").first()
    if not user:
        raise HTTPException(404, "LGU user not found.")

    req      = db.query(LGURequest).filter(LGURequest.email == user.email).first()
    city     = req.city     if req else "—"
    barangay = req.barangay if req else "—"

    try:
        background_tasks.add_task(
            send_account_deletion_email,
            user.email, user.full_name, city, barangay, admin_name,
        )
    except Exception as e:
        logger.warning(f"Failed to send deletion email: {e}")

    record_audit_event(
        db, request, admin,
        category="deletion",
        action="request_lgu_account_deletion",
        resource_type="lgu_user",
        resource_id=user_id,
        details={"email": user.email, "city": city, "barangay": barangay},
    )
    db.commit()
    logger.info(f"Deletion request sent for user {user_id} ({user.email}) by {admin_name}")
    return {"success": True, "message": f"Deletion request email sent to {user.email}"}


@router.delete("/users/{user_id}")
def delete_lgu_user(
    user_id: str,
    data: dict,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Permanently delete an LGU user account."""
    admin_name = admin.full_name

    user = db.query(User).filter(User.id == user_id, User.role == "lgu").first()
    if not user:
        raise HTTPException(404, "LGU user not found.")

    email = user.email
    db.delete(user)
    record_audit_event(
        db, request, admin,
        category="deletion",
        action="delete_lgu_account",
        resource_type="lgu_user",
        resource_id=user_id,
        details={"email": email},
    )
    db.commit()

    logger.info(f"LGU user {user_id} ({email}) deleted by {admin_name}")
    return {"success": True, "message": f"User {email} has been deleted."}
