from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import Base, engine
from app.models import *  # noqa: F401,F403
from app.routers import admin, analytics, auth, bitrix_settings, chat, clients, landings, links, notifications, payment_requests, public, reports
from app.utils.create_admin import ensure_admin_exists
from app.utils.migrate_db import migrate_chat_messages_table, migrate_client_deal_id, migrate_client_deal_status_fields, migrate_client_payment_fields, migrate_link_utm_fields, migrate_notification_target_partner, migrate_partner_approval_fields, migrate_partner_b24_fields, migrate_partner_payment_details, migrate_partner_reward_percentage, migrate_partner_role_field, migrate_payment_request_details


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    migrate_partner_b24_fields()
    migrate_partner_role_field()
    migrate_client_payment_fields()
    migrate_partner_reward_percentage()
    migrate_link_utm_fields()
    migrate_notification_target_partner()
    migrate_client_deal_status_fields()
    migrate_chat_messages_table()
    migrate_partner_approval_fields()
    migrate_partner_payment_details()
    migrate_payment_request_details()
    migrate_client_deal_id()
    ensure_admin_exists()
    yield


settings = get_settings()

app = FastAPI(title="Partner Cabinet API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

app.include_router(auth.router, prefix="/api")
app.include_router(links.router, prefix="/api")
app.include_router(clients.router, prefix="/api")
app.include_router(landings.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(bitrix_settings.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(payment_requests.router, prefix="/api")
app.include_router(public.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/")
async def root():
    return {"status": "ok", "service": "partner-cabinet"}
