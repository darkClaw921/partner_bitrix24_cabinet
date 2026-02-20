from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext

from bot.api_client import payment_requests as pay_api
from bot.api_client import clients as clients_api
from bot.api_client import auth as auth_api
from bot.api_client.base import APIClient
from bot.services.session_manager import UserSession
from bot.keyboards.inline import (
    payment_requests_keyboard, client_select_keyboard,
    payment_method_keyboard, skip_keyboard, confirm_keyboard,
)
from bot.keyboards.callbacks import PaymentCB, PaginationCB, ClientSelectCB, PayMethodCB, ConfirmCB
from bot.states.payment_request import CreatePaymentStates
from bot.utils.formatters import format_payment_request_detail

router = Router()

_pay_cache: dict[int, list] = {}


@router.message(F.text == "💰 Выплаты")
async def show_payments(message: Message, api_client: APIClient, session: UserSession):
    requests = await pay_api.get_payment_requests(api_client)
    if requests is None:
        await message.answer("Не удалось загрузить запросы на выплату.")
        return
    if not requests:
        from aiogram.utils.keyboard import InlineKeyboardBuilder
        builder = InlineKeyboardBuilder()
        builder.button(text="➕ Создать запрос", callback_data=PaymentCB(action="create"))
        await message.answer("У вас нет запросов на выплату.", reply_markup=builder.as_markup())
        return
    _pay_cache[message.from_user.id] = requests
    await message.answer("💰 <b>Запросы на выплату:</b>", reply_markup=payment_requests_keyboard(requests, 0))


@router.callback_query(PaginationCB.filter(F.section == "payments"))
async def paginate_payments(callback: CallbackQuery, callback_data: PaginationCB, api_client: APIClient, session: UserSession):
    await callback.answer()
    requests = _pay_cache.get(callback.from_user.id)
    if not requests:
        requests = await pay_api.get_payment_requests(api_client)
        if requests:
            _pay_cache[callback.from_user.id] = requests
    if not requests:
        return
    await callback.message.edit_reply_markup(reply_markup=payment_requests_keyboard(requests, callback_data.page))


@router.callback_query(PaymentCB.filter(F.action == "detail"))
async def payment_detail(callback: CallbackQuery, callback_data: PaymentCB, api_client: APIClient, session: UserSession):
    await callback.answer()
    req = await pay_api.get_payment_request(api_client, callback_data.id)
    if not req:
        await callback.message.answer("Запрос не найден.")
        return
    await callback.message.answer(format_payment_request_detail(req))


@router.callback_query(PaymentCB.filter(F.action == "create"))
async def start_create_payment(callback: CallbackQuery, state: FSMContext, api_client: APIClient, session: UserSession):
    await callback.answer()
    all_clients = await clients_api.get_all_clients(api_client)
    if not all_clients:
        await callback.message.answer("Не удалось загрузить клиентов.")
        return

    eligible = [
        c for c in all_clients
        if (c.get("partner_reward") or 0) > 0 and not c.get("is_paid")
    ]
    if not eligible:
        await callback.message.answer("Нет клиентов, подходящих для выплаты (нужно рассчитанное вознаграждение, не оплачено).")
        return

    await state.update_data(eligible_clients=eligible, selected_ids=[])
    await state.set_state(CreatePaymentStates.select_clients)
    await callback.message.answer(
        "Выберите клиентов для выплаты (нажмите для выбора/снятия):",
        reply_markup=client_select_keyboard(eligible, set()),
    )


@router.callback_query(ClientSelectCB.filter(), CreatePaymentStates.select_clients)
async def toggle_client(callback: CallbackQuery, callback_data: ClientSelectCB, state: FSMContext):
    await callback.answer()
    data = await state.get_data()
    selected = set(data.get("selected_ids", []))
    if callback_data.selected:
        selected.add(callback_data.id)
    else:
        selected.discard(callback_data.id)
    await state.update_data(selected_ids=list(selected))
    eligible = data["eligible_clients"]
    await callback.message.edit_reply_markup(reply_markup=client_select_keyboard(eligible, selected))


@router.callback_query(ConfirmCB.filter(F.action == "clients_done"), CreatePaymentStates.select_clients)
async def clients_done(callback: CallbackQuery, state: FSMContext, api_client: APIClient, session: UserSession):
    await callback.answer()
    data = await state.get_data()
    selected = data.get("selected_ids", [])
    if not selected:
        await callback.message.answer("Выберите хотя бы одного клиента.")
        return

    me = await auth_api.get_me(session.access_token)
    methods = (me or {}).get("saved_payment_methods", []) if me else []

    await state.update_data(payment_methods=methods)
    await state.set_state(CreatePaymentStates.select_payment_method)

    if methods:
        await callback.message.answer("Выберите способ оплаты:", reply_markup=payment_method_keyboard(methods))
    else:
        await callback.message.answer("У вас нет сохранённых способов оплаты.\nВведите название (label):")
        await state.set_state(CreatePaymentStates.new_payment_label)


@router.callback_query(PayMethodCB.filter(F.action == "select"), CreatePaymentStates.select_payment_method)
async def select_payment_method(callback: CallbackQuery, callback_data: PayMethodCB, state: FSMContext):
    await callback.answer()
    data = await state.get_data()
    methods = data.get("payment_methods", [])
    if callback_data.index < len(methods):
        method = methods[callback_data.index]
        await state.update_data(payment_details={"label": method["label"], "value": method["value"]})
        await state.set_state(CreatePaymentStates.comment)
        await callback.message.answer("Добавьте комментарий (или Пропустить):", reply_markup=skip_keyboard("pay_comment"))


@router.callback_query(PayMethodCB.filter(F.action == "new"), CreatePaymentStates.select_payment_method)
async def new_payment_method(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(CreatePaymentStates.new_payment_label)
    await callback.message.answer("Введите название способа оплаты (например: Карта Сбербанк):")


@router.message(CreatePaymentStates.new_payment_label)
async def payment_label(message: Message, state: FSMContext):
    await state.update_data(new_label=message.text.strip())
    await state.set_state(CreatePaymentStates.new_payment_value)
    await message.answer("Введите реквизиты (номер карты/кошелька):")


@router.message(CreatePaymentStates.new_payment_value)
async def payment_value(message: Message, state: FSMContext):
    data = await state.get_data()
    await state.update_data(payment_details={"label": data["new_label"], "value": message.text.strip()})
    await state.set_state(CreatePaymentStates.comment)
    await message.answer("Добавьте комментарий (или Пропустить):", reply_markup=skip_keyboard("pay_comment"))


@router.callback_query(ConfirmCB.filter((F.action == "pay_comment") & (F.value == "skip")), CreatePaymentStates.comment)
async def skip_pay_comment(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.update_data(comment=None)
    await _confirm_payment(callback.message, state)


@router.message(CreatePaymentStates.comment)
async def pay_comment(message: Message, state: FSMContext):
    await state.update_data(comment=message.text.strip())
    await _confirm_payment(message, state)


async def _confirm_payment(message: Message, state: FSMContext):
    data = await state.get_data()
    await state.set_state(CreatePaymentStates.confirm)
    selected = set(data.get("selected_ids", []))
    eligible = data.get("eligible_clients", [])
    total = sum((c.get("partner_reward", 0) or 0) for c in eligible if c["id"] in selected)
    pd = data.get("payment_details", {})

    text = (
        "<b>Подтверждение запроса на выплату</b>\n\n"
        f"Клиентов: {len(selected)}\n"
        f"Сумма: <b>{total:.0f} ₽</b>\n"
        f"Реквизиты: {pd.get('label', '')} — {pd.get('value', '')}\n"
    )
    if data.get("comment"):
        text += f"Комментарий: {data['comment']}\n"
    text += "\nСоздать запрос?"
    await message.answer(text, reply_markup=confirm_keyboard("create_payment"))


@router.callback_query(ConfirmCB.filter(F.action == "create_payment"), CreatePaymentStates.confirm)
async def confirm_create_payment(callback: CallbackQuery, callback_data: ConfirmCB, state: FSMContext, api_client: APIClient, session: UserSession):
    await callback.answer()
    if callback_data.value != "yes":
        await state.clear()
        await callback.message.answer("Создание отменено.")
        return

    data = await state.get_data()
    await state.clear()

    pd = data.get("payment_details") or {}
    if isinstance(pd, dict):
        payment_details_str = f"{pd.get('label', '')} — {pd.get('value', '')}"
    else:
        payment_details_str = str(pd)

    payload = {
        "client_ids": data["selected_ids"],
        "payment_details": payment_details_str,
    }
    if data.get("comment"):
        payload["comment"] = data["comment"]

    result = await pay_api.create_payment_request(api_client, payload)
    if result and "error" not in result:
        await callback.message.answer(f"✅ Запрос на выплату создан!\n\n{format_payment_request_detail(result)}")
    else:
        err = result.get("error", "Неизвестная ошибка") if result else "Ошибка"
        await callback.message.answer(f"Ошибка: {err}")
