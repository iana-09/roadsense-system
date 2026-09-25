"""Helpers for durable, queryable administrator and LGU activity logs."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from database import AuditEvent, User
from security import request_client_ip


def record_audit_event(
    db: Session,
    request: Request,
    actor: User,
    *,
    category: str,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> AuditEvent:
    """Add an event to the caller's current transaction."""

    event = AuditEvent(
        id=str(uuid.uuid4()),
        actor_id=actor.id,
        actor_name=actor.full_name,
        actor_role=actor.role,
        category=category,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id)[:255] if resource_id is not None else None,
        details=details,
        ip_address=request_client_ip(request)[:64],
        created_at=datetime.utcnow(),
    )
    db.add(event)
    return event
