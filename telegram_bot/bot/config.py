from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    TELEGRAM_BOT_TOKEN: str
    BACKEND_URL: str = "http://backend:8003"
    PUBLIC_BASE_URL: str = "http://localhost:8003"
    NOTIFICATION_POLL_INTERVAL: int = 60

    @property
    def api_base_url(self) -> str:
        return f"{self.BACKEND_URL}/api"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
