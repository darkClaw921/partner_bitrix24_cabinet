from aiogram.fsm.state import State, StatesGroup


class CreateClientStates(StatesGroup):
    name = State()
    phone = State()
    email = State()
    company = State()
    comment = State()
    link_id = State()
    confirm = State()
