"""Bootstrap the first SAE account for controlled high-access setup."""

import logging
from datetime import datetime

from passlib.context import CryptContext

from database import SessionLocal, User

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

INITIAL_SAE_ID = "101112"
INITIAL_SAE_PASSWORD = "Skyisthelimit11!"
INITIAL_SAE_EMAIL = "sae-101112@roadsense.local"


def ensure_initial_sae_account() -> None:
    db = SessionLocal()
    try:
        user = (
            db.query(User)
            .filter((User.id == INITIAL_SAE_ID) | (User.full_name == INITIAL_SAE_ID))
            .first()
        )

        password_hash = pwd_context.hash(INITIAL_SAE_PASSWORD)
        if user:
            user.id = INITIAL_SAE_ID
            user.full_name = INITIAL_SAE_ID
            user.password_hash = password_hash
            user.role = "sae"
            if not user.email:
                user.email = INITIAL_SAE_EMAIL
            logger.info("Initial SAE account refreshed: %s", INITIAL_SAE_ID)
        else:
            user = User(
                id=INITIAL_SAE_ID,
                full_name=INITIAL_SAE_ID,
                email=INITIAL_SAE_EMAIL,
                password_hash=password_hash,
                role="sae",
                created_at=datetime.utcnow(),
            )
            db.add(user)
            logger.info("Initial SAE account created: %s", INITIAL_SAE_ID)

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to bootstrap initial SAE account.")
        raise
    finally:
        db.close()
