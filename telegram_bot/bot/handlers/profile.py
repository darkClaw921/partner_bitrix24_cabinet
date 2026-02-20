from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from bot.api_client import auth as auth_api
from bot.api_client.base import APIClient
from bot.services.session_manager import UserSession
from bot.keyboards.inline import profile_keyboard
from bot.keyboards.callbacks import ProfileCB
from bot.utils.formatters import format_profile

router = Router()


class AddPaymentMethodStates(StatesGroup):
    label = State()
    value = State()


@router.message(F.text == "👤 Профиль")
async def show_profile(message: Message, api_client: APIClient, session: UserSession):
    me = await auth_api.get_me(session.access_token)
    if not me:
        await message.answer("Не удалось загрузить профиль.")
        return
    text = format_profile(me)
    methods = me.get("saved_payment_methods", [])
    await message.answer(text, reply_markup=profile_keyboard(methods))


@router.callback_query(ProfileCB.filter(F.action == "add_pm"))
async def start_add_pm(callback: CallbackQuery, state: FSMContext, api_client: APIClient, session: UserSession):
    await callback.answer()
    await state.set_state(AddPaymentMethodStates.label)
    await callback.message.answer("Введите название способа оплаты (например: Карта Сбербанк):")


@router.message(AddPaymentMethodStates.label)
async def pm_label(message: Message, state: FSMContext):
    await state.update_data(pm_label=message.text.strip())
    await state.set_state(AddPaymentMethodStates.value)
    await message.answer("Введите реквизиты (номер карты/кошелька):")


@router.message(AddPaymentMethodStates.value)
async def pm_value(message: Message, state: FSMContext, api_client: APIClient, session: UserSession):
    data = await state.get_data()
    await state.clear()

    resp = await api_client.post("/auth/payment-methods", json={
        "label": data["pm_label"],
        "value": message.text.strip(),
    })
    if resp.status_code == 200:
        me = resp.json()
        await message.answer(f"✅ Способ оплаты добавлен!\n\n{format_profile(me)}", reply_markup=profile_keyboard(me.get("saved_payment_methods", [])))
    else:
        await message.answer("Не удалось добавить способ оплаты.")


@router.callback_query(ProfileCB.filter(F.action == "delete_pm"))
async def delete_pm(callback: CallbackQuery, callback_data: ProfileCB, api_client: APIClient, session: UserSession):
    await callback.answer()
    resp = await api_client.delete(f"/auth/payment-methods/{callback_data.id}")
    if resp.status_code == 200:
        me = resp.json()
        methods = me.get("saved_payment_methods", [])
        await callback.message.answer(f"✅ Способ оплаты удалён!\n\n{format_profile(me)}", reply_markup=profile_keyboard(methods))
    else:
        await callback.message.answer("Не удалось удалить способ оплаты.")
