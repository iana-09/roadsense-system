"""Regression tests for SAE session and action auditing."""

import unittest

from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.requests import Request

from audit_log import record_audit_event
from auth_security import _read_token
from database import AuditEvent, Base, LoginAudit, User
from routers import auth


class AuditFeatureTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.admin = User(
            id="admin-1",
            full_name="Road Admin",
            email="admin@example.test",
            password_hash=auth.pwd_context.hash("Secure1!"),
            role="admin",
        )
        self.sae = User(
            id="sae-1",
            full_name="900001",
            email="sae@example.test",
            password_hash=auth.pwd_context.hash("Secure1!"),
            role="sae",
        )
        self.db.add_all([self.admin, self.sae])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    @staticmethod
    def request():
        return Request({
            "type": "http",
            "method": "POST",
            "path": "/test",
            "headers": [(b"user-agent", b"RoadSense test")],
            "client": ("127.0.0.1", 12345),
        })

    def test_login_token_closes_the_matching_session(self):
        response = auth.login(
            auth.LoginRequest(username="Road Admin", password="Secure1!", role="admin"),
            self.request(),
            self.db,
        )
        session_id = _read_token(response["access_token"])["sid"]
        audit = self.db.query(LoginAudit).filter(LoginAudit.id == session_id).one()
        self.assertIsNone(audit.logout_at)

        auth.logout(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials=response["access_token"]),
            self.db,
        )
        self.db.refresh(audit)
        self.assertIsNotNone(audit.logout_at)

    def test_security_events_are_separated_by_role_and_category(self):
        record_audit_event(
            self.db,
            self.request(),
            self.admin,
            category="deletion",
            action="delete_detection",
            resource_type="detection",
            resource_id="det-1",
        )
        self.db.commit()

        original_resolver = auth.resolve_ip_location
        auth.resolve_ip_location = lambda value: value
        try:
            response = auth.get_security_events("admin", "deletion", 20, self.sae, self.db)
        finally:
            auth.resolve_ip_location = original_resolver

        self.assertEqual(len(response["events"]), 1)
        self.assertEqual(response["events"][0]["actor_name"], "Road Admin")
        self.assertEqual(response["events"][0]["resource_id"], "det-1")
        self.assertEqual(self.db.query(AuditEvent).count(), 1)


if __name__ == "__main__":
    unittest.main()
