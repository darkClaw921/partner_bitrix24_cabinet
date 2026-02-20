from aiogram.fsm.state import State, StatesGroup


class ReportStates(StatesGroup):
    date_from = State()
    date_to = State()
