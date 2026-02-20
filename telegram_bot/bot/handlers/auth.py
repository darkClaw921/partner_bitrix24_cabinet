from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message
from aiogram.fsm.context import FSMContext

from bot.states.auth import LoginStates
from bot.api_client import auth as auth_api
from bot.services.session_manager import save_session, delete_session, get_session, UserSession
from bot.services.notification_poller import clear_user_state
from bot.keyboards.main_menu import get_main_menu, remove_keyboard

router = Router()


@router.message(Command("login"))
async def cmd_login(message: Message, state: FSMContext):
    session = get_session(message.from_user.id)
    if session:
        await message.answer(
            f"Вы уже авторизованы как <b>{session.partner_name}</b>.\n"
            "Используйте /logout для выхода.",
            reply_markup=get_main_menu(),
        )
        return
    await state.set_state(LoginStates.email)
    await message.answer("Введите ваш email:", reply_markup=remove_keyboard)


@router.message(LoginStates.email)
async def process_email(message: Message, state: FSMContext):
    email = message.text.strip()
    if "@" not in email:
        await message.answer("Введите корректный email:")
        return
    await state.update_data(email=email)
    await state.set_state(LoginStates.password)
    await message.answer("Введите пароль:")


@router.message(LoginStates.password)
async def process_password(message: Message, state: FSMContext):
    data = await state.get_data()
    email = data["email"]
    password = message.text.strip()

    result = await auth_api.login(email, password)
    if not result or "error" in result:
        error_msg = result.get("error", "Ошибка авторизации") if result else "Ошибка авторизации"
        await message.answer(f"Ошибка: {error_msg}\n\nПопробуйте ещё раз: /login")
        await state.clear()
        return

    access_token = result["access_token"]
    refresh_token = result["refresh_token"]

    me = await auth_api.get_me(access_token)
    if not me:
        await message.answer("Не удалось получить данные профиля.\nПопробуйте ещё раз: /login")
        await state.clear()
        return

    session = UserSession(
        access_token=access_token,
        refresh_token=refresh_token,
        partner_id=me["id"],
        partner_name=me["name"],
        partner_email=me["email"],
    )
    save_session(message.from_user.id, session)
    await state.clear()

    await message.answer(
        f"Добро пожаловать, <b>{me['name']}</b>!\n"
        "Выберите раздел в меню.",
        reply_markup=get_main_menu(),
    )


@router.message(Command("logout"))
async def cmd_logout(message: Message, state: FSMContext):
    await state.clear()
    session = get_session(message.from_user.id)
    if not session:
        await message.answer("Вы не авторизованы.")
        return
    delete_session(message.from_user.id)
    clear_user_state(message.from_user.id)
    await message.answer(
        "Вы вышли из аккаунта.\nДля повторного входа: /login",
        reply_markup=remove_keyboard,
    )
