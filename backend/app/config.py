from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/app.db"
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    UPLOAD_DIR: str = "./uploads"

    # b24-transfer-lead service
    B24_SERVICE_URL: str = "http://b24-service:7860"
    B24_INTERNAL_API_KEY: str = ""
    B24_WEBHOOK_URL: str = ""

    # Workflow defaults (applied to every new partner workflow)
    B24_ENTITY_TYPE: str = "lead"  # "lead" or "deal"
    B24_DEAL_CATEGORY_ID: str = ""  # funnel ID (int as string), empty = not set
    B24_DEAL_STAGE_ID: str = ""
    B24_LEAD_STATUS_ID: str = "NEW"
    B24_FIELD_MAPPINGS: str = "[]"  # JSON array of field mappings

    # Reward
    DEFAULT_REWARD_PERCENTAGE: float = 10.0

    # Admin
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""
    B24_SERVICE_FRONTEND_URL: str = "http://localhost:7860"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
