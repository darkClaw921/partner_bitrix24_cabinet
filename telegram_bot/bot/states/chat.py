from aiogram.fsm.state import State, StatesGroup


class ChatStates(StatesGroup):
    active = State()  # Chat mode — any text is sent as message
