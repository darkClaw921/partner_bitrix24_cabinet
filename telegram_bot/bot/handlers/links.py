from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext

from bot.api_client import links as links_api
from bot.api_client.base import APIClient
from bot.services.session_manager import UserSession
from bot.keyboards.inline import links_list_keyboard, skip_keyboard, confirm_keyboard
from bot.keyboards.callbacks import LinkCB, PaginationCB, ConfirmCB
from bot.states.link import CreateLinkStates
from bot.utils.formatters import format_link_detail

router = Router()

_links_cache: dict[int, list] = {}


@router.message(F.text == "🔗 Ссылки")
async def show_links(message: Message, api_client: APIClient, session: UserSession):
    links = await links_api.get_links(api_client)
    if links is None:
        await message.answer("Не удалось загрузить ссылки.")
        return
    if not links:
        from aiogram.utils.keyboard import InlineKeyboardBuilder
        from bot.keyboards.callbacks import LinkCB
        builder = InlineKeyboardBuilder()
        builder.button(text="➕ Создать ссылку", callback_data=LinkCB(action="create"))
        await message.answer("У вас пока нет ссылок.", reply_markup=builder.as_markup())
        return
    _links_cache[message.from_user.id] = links
    await message.answer("🔗 <b>Ваши ссылки:</b>", reply_markup=links_list_keyboard(links, 0))


@router.callback_query(PaginationCB.filter(F.section == "links"))
async def paginate_links(callback: CallbackQuery, callback_data: PaginationCB, api_client: APIClient, session: UserSession):
    await callback.answer()
    links = _links_cache.get(callback.from_user.id)
    if not links:
        links = await links_api.get_links(api_client)
        if links:
            _links_cache[callback.from_user.id] = links
    if not links:
        await callback.message.edit_text("Не удалось загрузить ссылки.")
        return
    await callback.message.edit_reply_markup(reply_markup=links_list_keyboard(links, callback_data.page))


@router.callback_query(LinkCB.filter(F.action == "detail"))
async def link_detail(callback: CallbackQuery, callback_data: LinkCB, api_client: APIClient, session: UserSession):
    await callback.answer()
    link = await links_api.get_link(api_client, callback_data.id)
    if not link:
        await callback.message.answer("Ссылка не найдена.")
        return
    await callback.message.answer(format_link_detail(link))


@router.callback_query(LinkCB.filter(F.action == "create"))
async def start_create_link(callback: CallbackQuery, state: FSMContext, api_client: APIClient, session: UserSession):
    await callback.answer()
    await state.set_state(CreateLinkStates.title)
    await callback.message.answer("Введите название ссылки:")


@router.message(CreateLinkStates.title)
async def link_title(message: Message, state: FSMContext):
    await state.update_data(title=message.text.strip())
    await state.set_state(CreateLinkStates.link_type)
    from aiogram.utils.keyboard import InlineKeyboardBuilder
    builder = InlineKeyboardBuilder()
    builder.button(text="Direct", callback_data=ConfirmCB(action="link_type", value="direct"))
    builder.button(text="Iframe", callback_data=ConfirmCB(action="link_type", value="iframe"))
    builder.button(text="Landing", callback_data=ConfirmCB(action="link_type", value="landing"))
    builder.adjust(3)
    await message.answer("Выберите тип ссылки:", reply_markup=builder.as_markup())


@router.callback_query(ConfirmCB.filter(F.action == "link_type"), CreateLinkStates.link_type)
async def link_type_selected(callback: CallbackQuery, callback_data: ConfirmCB, state: FSMContext):
    await callback.answer()
    await state.update_data(link_type=callback_data.value)
    await state.set_state(CreateLinkStates.target_url)
    await callback.message.answer("Введите целевой URL:")


@router.message(CreateLinkStates.target_url)
async def link_target_url(message: Message, state: FSMContext):
    url = message.text.strip()
    await state.update_data(target_url=url)
    await state.set_state(CreateLinkStates.utm_source)
    await message.answer("Введите utm_source (или нажмите Пропустить):", reply_markup=skip_keyboard("utm"))


@router.callback_query(ConfirmCB.filter((F.action == "utm") & (F.value == "skip")), CreateLinkStates.utm_source)
async def skip_utm(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.update_data(utm_source=None, utm_medium=None, utm_campaign=None)
    await _confirm_link(callback.message, state)


@router.message(CreateLinkStates.utm_source)
async def link_utm_source(message: Message, state: FSMContext):
    await state.update_data(utm_source=message.text.strip())
    await state.set_state(CreateLinkStates.utm_medium)
    await message.answer("Введите utm_medium (или нажмите Пропустить):", reply_markup=skip_keyboard("utm_med"))


@router.callback_query(ConfirmCB.filter((F.action == "utm_med") & (F.value == "skip")), CreateLinkStates.utm_medium)
async def skip_utm_medium(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.update_data(utm_medium=None, utm_campaign=None)
    await _confirm_link(callback.message, state)


@router.message(CreateLinkStates.utm_medium)
async def link_utm_medium(message: Message, state: FSMContext):
    await state.update_data(utm_medium=message.text.strip())
    await state.set_state(CreateLinkStates.utm_campaign)
    await message.answer("Введите utm_campaign (или нажмите Пропустить):", reply_markup=skip_keyboard("utm_camp"))


@router.callback_query(ConfirmCB.filter((F.action == "utm_camp") & (F.value == "skip")), CreateLinkStates.utm_campaign)
async def skip_utm_campaign(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.update_data(utm_campaign=None)
    await _confirm_link(callback.message, state)


@router.message(CreateLinkStates.utm_campaign)
async def link_utm_campaign(message: Message, state: FSMContext):
    await state.update_data(utm_campaign=message.text.strip())
    await _confirm_link(message, state)


async def _confirm_link(message: Message, state: FSMContext):
    data = await state.get_data()
    await state.set_state(CreateLinkStates.confirm)
    text = (
        "<b>Создание ссылки</b>\n\n"
        f"Название: {data.get('title')}\n"
        f"Тип: {data.get('link_type')}\n"
        f"URL: {data.get('target_url')}\n"
    )
    for k in ["utm_source", "utm_medium", "utm_campaign"]:
        if data.get(k):
            text += f"{k}: {data[k]}\n"
    text += "\nСоздать ссылку?"
    await message.answer(text, reply_markup=confirm_keyboard("create_link"))


@router.callback_query(ConfirmCB.filter(F.action == "create_link"), CreateLinkStates.confirm)
async def confirm_create_link(callback: CallbackQuery, callback_data: ConfirmCB, state: FSMContext, api_client: APIClient, session: UserSession):
    await callback.answer()
    if callback_data.value != "yes":
        await state.clear()
        await callback.message.answer("Создание отменено.")
        return

    data = await state.get_data()
    await state.clear()

    payload = {
        "title": data["title"],
        "link_type": data["link_type"],
        "target_url": data["target_url"],
    }
    for k in ["utm_source", "utm_medium", "utm_campaign"]:
        if data.get(k):
            payload[k] = data[k]

    result = await links_api.create_link(api_client, payload)
    if result and "error" not in result:
        await callback.message.answer(f"✅ Ссылка создана!\n\n{format_link_detail(result)}")
    else:
        err = result.get("error", "Неизвестная ошибка") if result else "Ошибка"
        await callback.message.answer(f"Ошибка: {err}")
