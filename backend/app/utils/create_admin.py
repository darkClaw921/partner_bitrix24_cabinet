import logging
import sqlite3
import uuid
from datetime import datetime

from app.config import get_settings
from app.utils.security import hash_password

logger = logging.getLogger(__name__)


def _get_sync_db_path() -> str:
    settings = get_settings()
    url = settings.DATABASE_URL
    if ":///" in url:
        return url.split(":///")[-1]
    return "./data/app.db"


def ensure_admin_exists() -> None:
    settings = get_settings()
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        logger.info("ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping admin creation")
        return

    db_path = _get_sync_db_path()
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute("SELECT id, role FROM partners WHERE email = ?", (settings.ADMIN_EMAIL,))
        row = cursor.fetchone()

        if row is None:
            password_hash = hash_password(settings.ADMIN_PASSWORD)
            partner_code = uuid.uuid4().hex[:8]
            cursor.execute(
                "INSERT INTO partners (email, password_hash, name, company, partner_code, role, is_active, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (settings.ADMIN_EMAIL, password_hash, "Admin", "System", partner_code, "admin", 1, datetime.utcnow().isoformat()),
            )
            logger.info("Admin account created: %s", settings.ADMIN_EMAIL)
        elif row[1] != "admin":
            cursor.execute("UPDATE partners SET role = 'admin' WHERE id = ?", (row[0],))
            logger.info("Updated existing account to admin: %s", settings.ADMIN_EMAIL)
        else:
            logger.info("Admin account already exists: %s", settings.ADMIN_EMAIL)

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Admin creation failed: %s", e)
