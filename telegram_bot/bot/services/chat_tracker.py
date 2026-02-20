"""In-memory tracking of users currently in chat mode.

Used by chat handler (enter/exit/track messages) and notification poller
(detect chat mode to push new messages instead of generic notifications).
"""

from dataclasses import dataclass, field


@dataclass
class ChatModeState:
    chat_id: int  # Telegram chat ID to send messages to
    message_ids: list[int] = field(default_factory=list)  # Bot message IDs to delete


_states: dict[int, ChatModeState] = {}  # tg_user_id -> state


def enter_chat(tg_user_id: int, chat_id: int) -> None:
    _states[tg_user_id] = ChatModeState(chat_id=chat_id)


def exit_chat(tg_user_id: int) -> None:
    _states.pop(tg_user_id, None)


def is_in_chat(tg_user_id: int) -> bool:
    return tg_user_id in _states


def track_message(tg_user_id: int, msg_id: int) -> None:
    state = _states.get(tg_user_id)
    if state:
        state.message_ids.append(msg_id)


def get_and_clear_messages(tg_user_id: int) -> tuple[int | None, list[int]]:
    """Return (chat_id, message_ids) and clear tracked messages."""
    state = _states.get(tg_user_id)
    if not state:
        return None, []
    ids = state.message_ids
    state.message_ids = []
    return state.chat_id, ids


def get_chat_id(tg_user_id: int) -> int | None:
    state = _states.get(tg_user_id)
    return state.chat_id if state else None
