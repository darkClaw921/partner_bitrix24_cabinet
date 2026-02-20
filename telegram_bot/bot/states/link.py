from aiogram.fsm.state import State, StatesGroup


class CreateLinkStates(StatesGroup):
    title = State()
    link_type = State()
    target_url = State()
    utm_source = State()
    utm_medium = State()
    utm_campaign = State()
    confirm = State()
