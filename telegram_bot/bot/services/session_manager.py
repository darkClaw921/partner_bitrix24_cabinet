from dataclasses import dataclass
from typing import Optional
from bot.api_client.base import APIClient


@dataclass
class UserSession:
    access_token: str
    refresh_token: str
    partner_id: int
    partner_name: str
    partner_email: str


_sessions: dict[int, UserSession] = {}


def save_session(telegram_user_id: int, session: UserSession) -> None:
    _sessions[telegram_user_id] = session


def get_session(telegram_user_id: int) -> Optional[UserSession]:
    return _sessions.get(telegram_user_id)


def delete_session(telegram_user_id: int) -> None:
    _sessions.pop(telegram_user_id, None)


def get_api_client(telegram_user_id: int) -> Optional[APIClient]:
    session = get_session(telegram_user_id)
    if not session:
        return None

    client = APIClient(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
    )

    async def on_refresh(new_access: str, new_refresh: str):
        session.access_token = new_access
        session.refresh_token = new_refresh

    client.set_tokens_callback(on_refresh)
    return client


def get_all_sessions() -> dict[int, UserSession]:
    return dict(_sessions)
