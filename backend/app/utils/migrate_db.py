import logging
import sqlite3

from app.config import get_settings

logger = logging.getLogger(__name__)


def _get_sync_db_path() -> str:
    settings = get_settings()
    url = settings.DATABASE_URL
    # sqlite+aiosqlite:///./data/app.db -> ./data/app.db
    if ":///" in url:
        return url.split(":///")[-1]
    return "./data/app.db"


def _column_exists(cursor: sqlite3.Cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    columns = [row[1] for row in cursor.fetchall()]
    return column in columns


def migrate_partner_role_field() -> None:
    db_path = _get_sync_db_path()
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        if not _column_exists(cursor, "partners", "role"):
            cursor.execute("ALTER TABLE partners ADD COLUMN role VARCHAR(20) DEFAULT 'partner'")
            logger.info("Added role column to partners")

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Migration (role) failed: %s", e)


def migrate_client_payment_fields() -> None:
    db_path = _get_sync_db_path()
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        if not _column_exists(cursor, "clients", "deal_amount"):
            cursor.execute("ALTER TABLE clients ADD COLUMN deal_amount REAL")
            logger.info("Added deal_amount column to clients")

        if not _column_exists(cursor, "clients", "partner_reward"):
            cursor.execute("ALTER TABLE clients ADD COLUMN partner_reward REAL")
            logger.info("Added partner_reward column to clients")

        if not _column_exists(cursor, "clients", "is_paid"):
            cursor.execute("ALTER TABLE clients ADD COLUMN is_paid BOOLEAN DEFAULT 0")
            logger.info("Added is_paid column to clients")

        if not _column_exists(cursor, "clients", "paid_at"):
            cursor.execute("ALTER TABLE clients ADD COLUMN paid_at DATETIME")
            logger.info("Added paid_at column to clients")

        if not _column_exists(cursor, "clients", "payment_comment"):
            cursor.execute("ALTER TABLE clients ADD COLUMN payment_comment TEXT")
            logger.info("Added payment_comment column to clients")

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Migration (client payment fields) failed: %s", e)


def migrate_partner_reward_percentage() -> None:
    db_path = _get_sync_db_path()
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        if not _column_exists(cursor, "partners", "reward_percentage"):
            cursor.execute("ALTER TABLE partners ADD COLUMN reward_percentage REAL")
            logger.info("Added reward_percentage column to partners")

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Migration (reward_percentage) failed: %s", e)


def migrate_link_utm_fields() -> None:
    db_path = _get_sync_db_path()
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        for col in ("utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"):
            if not _column_exists(cursor, "partner_links", col):
                cursor.execute(f"ALTER TABLE partner_links ADD COLUMN {col} VARCHAR(255)")
                logger.info("Added %s column to partner_links", col)

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Migration (link UTM fields) failed: %s", e)


def migrate_notification_target_partner() -> None:
    db_path = _get_sync_db_path()
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        if not _column_exists(cursor, "notifications", "target_partner_id"):
            cursor.execute("ALTER TABLE notifications ADD COLUMN target_partner_id INTEGER REFERENCES partners(id)")
            logger.info("Added target_partner_id column to notifications")

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Migration (notification target_partner) failed: %s", e)


def migrate_client_deal_status_fields() -> None:
    db_path = _get_sync_db_path()
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        if not _column_exists(cursor, "clients", "deal_status"):
            cursor.execute("ALTER TABLE clients ADD COLUMN deal_status VARCHAR(100)")
            logger.info("Added deal_status column to clients")

        if not _column_exists(cursor, "clients", "deal_status_name"):
            cursor.execute("ALTER TABLE clients ADD COLUMN deal_status_name VARCHAR(255)")
            logger.info("Added deal_status_name column to clients")

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Migration (client deal status fields) failed: %s", e)


def migrate_chat_messages_table() -> None:
    db_path = _get_sync_db_path()
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                partner_id INTEGER NOT NULL REFERENCES partners(id),
                sender_id INTEGER NOT NULL REFERENCES partners(id),
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_chat_messages_partner_id ON chat_messages(partner_id)")
        conn.commit()
        conn.close()
        logger.info("Ensured chat_messages table exists")
    except Exception as e:
        logger.error("Migration (chat_messages) failed: %s", e)


def migrate_partner_approval_fields() -> None:
    db_path = _get_sync_db_path()
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        if not _column_exists(cursor, "partners", "approval_status"):
            cursor.execute("ALTER TABLE partners ADD COLUMN approval_status VARCHAR(20) DEFAULT 'pending'")
            cursor.execute("UPDATE partners SET approval_status = 'approved'")
            logger.info("Added approval_status column to partners (existing set to approved)")

        if not _column_exists(cursor, "partners", "rejection_reason"):
            cursor.execute("ALTER TABLE partners ADD COLUMN rejection_reason VARCHAR(1000)")
            logger.info("Added rejection_reason column to partners")

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Migration (partner approval fields) failed: %s", e)


def migrate_partner_payment_details() -> None:
    db_path = _get_sync_db_path()
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        if not _column_exists(cursor, "partners", "payment_details"):
            cursor.execute("ALTER TABLE partners ADD COLUMN payment_details TEXT")
            logger.info("Added payment_details column to partners")

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Migration (partner_payment_details) failed: %s", e)


def migrate_payment_request_details() -> None:
    db_path = _get_sync_db_path()
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        if not _column_exists(cursor, "payment_requests", "payment_details"):
            cursor.execute("ALTER TABLE payment_requests ADD COLUMN payment_details TEXT")
            logger.info("Added payment_details column to payment_requests")

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Migration (payment_request_details) failed: %s", e)


def migrate_partner_b24_fields() -> None:
    db_path = _get_sync_db_path()
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        if not _column_exists(cursor, "partners", "workflow_id"):
            cursor.execute("ALTER TABLE partners ADD COLUMN workflow_id INTEGER")
            logger.info("Added workflow_id column to partners")

        if not _column_exists(cursor, "partners", "b24_api_token"):
            cursor.execute("ALTER TABLE partners ADD COLUMN b24_api_token VARCHAR(255)")
            logger.info("Added b24_api_token column to partners")

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Migration failed: %s", e)
