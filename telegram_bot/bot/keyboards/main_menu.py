from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove


def get_main_menu() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📊 Дашборд"), KeyboardButton(text="🔗 Ссылки")],
            [KeyboardButton(text="👥 Клиенты"), KeyboardButton(text="📈 Аналитика")],
            [KeyboardButton(text="📋 Отчёты"), KeyboardButton(text="💰 Выплаты")],
            [KeyboardButton(text="💬 Чат"), KeyboardButton(text="🔔 Уведомления")],
            [KeyboardButton(text="👤 Профиль")],
        ],
        resize_keyboard=True,
        input_field_placeholder="Выберите раздел",
    )


remove_keyboard = ReplyKeyboardRemove()
