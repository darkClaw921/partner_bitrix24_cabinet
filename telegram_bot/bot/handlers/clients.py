from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext

from bot.api_client import clients as clients_api
from bot.api_client import links as links_api
from bot.api_client.base import APIClient
from bot.services.session_manager import UserSession
from bot.keyboards.inline import clients_list_keyboard, skip_keyboard, confirm_keyboard
from bot.keyboards.callbacks import ClientCB, PaginationCB, ConfirmCB
from bot.states.client import CreateClientStates
from bot.utils.formatters import format_client_detail

router = Router()

_clients_cache: dict[int, list] = {}


@router.message(F.text == "👥 Клиенты")
async def show_clients(message: Message, api_client: APIClient, session: UserSession):
    clients = await clients_api.get_clients(api_client)
    if clients is None:
        await message.answer("Не удалось загрузить клиентов.")
        return
    if not clients:
        from aiogram.utils.keyboard import InlineKeyboardBuilder
        builder = InlineKeyboardBuilder()
        builder.button(text="➕ Добавить клиента", callback_data=ClientCB(action="create"))
        await message.answer("У вас пока нет клиентов.", reply_markup=builder.as_markup())
        return
    _clients_cache[message.from_user.id] = clients
    await message.answer("👥 <b>Ваши клиенты:</b>", reply_markup=clients_list_keyboard(clients, 0))


@router.callback_query(PaginationCB.filter(F.section == "clients"))
async def paginate_clients(callback: CallbackQuery, callback_data: PaginationCB, api_client: APIClient, session: UserSession):
    await callback.answer()
    clients = _clients_cache.get(callback.from_user.id)
    if not clients:
        clients = await clients_api.get_clients(api_client)
        if clients:
            _clients_cache[callback.from_user.id] = clients
    if not clients:
        await callback.message.edit_text("Не удалось загрузить клиентов.")
        return
    await callback.message.edit_reply_markup(reply_markup=clients_list_keyboard(clients, callback_data.page))


@router.callback_query(ClientCB.filter(F.action == "detail"))
async def client_detail(callback: CallbackQuery, callback_data: ClientCB, api_client: APIClient, session: UserSession):
    await callback.answer()
    client = await clients_api.get_client(api_client, callback_data.id)
    if not client:
        await callback.message.answer("Клиент не найден.")
        return
    await callback.message.answer(format_client_detail(client))


@router.callback_query(ClientCB.filter(F.action == "create"))
async def start_create_client(callback: CallbackQuery, state: FSMContext, api_client: APIClient, session: UserSession):
    await callback.answer()
    await state.set_state(CreateClientStates.name)
    await callback.message.answer("Введите имя клиента:")


@router.message(CreateClientStates.name)
async def client_name(message: Message, state: FSMContext):
    await state.update_data(name=message.text.strip())
    await state.set_state(CreateClientStates.phone)
    await message.answer("Введите телефон (или Пропустить):", reply_markup=skip_keyboard("cl_phone"))


@router.callback_query(ConfirmCB.filter((F.action == "cl_phone") & (F.value == "skip")), CreateClientStates.phone)
async def skip_phone(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.update_data(phone=None)
    await state.set_state(CreateClientStates.email)
    await callback.message.answer("Введите email (или Пропустить):", reply_markup=skip_keyboard("cl_email"))


@router.message(CreateClientStates.phone)
async def client_phone(message: Message, state: FSMContext):
    await state.update_data(phone=message.text.strip())
    await state.set_state(CreateClientStates.email)
    await message.answer("Введите email (или Пропустить):", reply_markup=skip_keyboard("cl_email"))


@router.callback_query(ConfirmCB.filter((F.action == "cl_email") & (F.value == "skip")), CreateClientStates.email)
async def skip_email(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.update_data(email=None)
    await state.set_state(CreateClientStates.company)
    await callback.message.answer("Введите компанию (или Пропустить):", reply_markup=skip_keyboard("cl_company"))


@router.message(CreateClientStates.email)
async def client_email(message: Message, state: FSMContext):
    await state.update_data(email=message.text.strip())
    await state.set_state(CreateClientStates.company)
    await message.answer("Введите компанию (или Пропустить):", reply_markup=skip_keyboard("cl_company"))


@router.callback_query(ConfirmCB.filter((F.action == "cl_company") & (F.value == "skip")), CreateClientStates.company)
async def skip_company(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.update_data(company=None)
    await state.set_state(CreateClientStates.comment)
    await callback.message.answer("Введите комментарий (или Пропустить):", reply_markup=skip_keyboard("cl_comment"))


@router.message(CreateClientStates.company)
async def client_company(message: Message, state: FSMContext):
    await state.update_data(company=message.text.strip())
    await state.set_state(CreateClientStates.comment)
    await message.answer("Введите комментарий (или Пропустить):", reply_markup=skip_keyboard("cl_comment"))


@router.callback_query(ConfirmCB.filter((F.action == "cl_comment") & (F.value == "skip")), CreateClientStates.comment)
async def skip_comment(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.update_data(comment=None)
    await _confirm_client(callback.message, state)


@router.message(CreateClientStates.comment)
async def client_comment(message: Message, state: FSMContext):
    await state.update_data(comment=message.text.strip())
    await _confirm_client(message, state)


async def _confirm_client(message: Message, state: FSMContext):
    data = await state.get_data()
    await state.set_state(CreateClientStates.confirm)
    lines = ["<b>Создание клиента</b>\n", f"Имя: {data['name']}"]
    for field, label in [("phone", "Телефон"), ("email", "Email"), ("company", "Компания"), ("comment", "Комментарий")]:
        if data.get(field):
            lines.append(f"{label}: {data[field]}")
    lines.append("\nСоздать клиента?")
    await message.answer("\n".join(lines), reply_markup=confirm_keyboard("create_client"))


@router.callback_query(ConfirmCB.filter(F.action == "create_client"), CreateClientStates.confirm)
async def confirm_create_client(callback: CallbackQuery, callback_data: ConfirmCB, state: FSMContext, api_client: APIClient, session: UserSession):
    await callback.answer()
    if callback_data.value != "yes":
        await state.clear()
        await callback.message.answer("Создание отменено.")
        return

    data = await state.get_data()
    await state.clear()

    payload = {"name": data["name"]}
    for k in ["phone", "email", "company", "comment"]:
        if data.get(k):
            payload[k] = data[k]

    result = await clients_api.create_client(api_client, payload)
    if result and "error" not in result:
        await callback.message.answer(f"✅ Клиент создан!\n\n{format_client_detail(result)}")
    else:
        err = result.get("error", "Неизвестная ошибка") if result else "Ошибка"
        await callback.message.answer(f"Ошибка: {err}")
