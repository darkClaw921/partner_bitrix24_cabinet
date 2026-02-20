from aiogram.fsm.state import State, StatesGroup


class LoginStates(StatesGroup):
    email = State()
    password = State()
