from aiogram.fsm.state import State, StatesGroup


class CreatePaymentStates(StatesGroup):
    select_clients = State()
    select_payment_method = State()
    new_payment_label = State()
    new_payment_value = State()
    comment = State()
    confirm = State()
