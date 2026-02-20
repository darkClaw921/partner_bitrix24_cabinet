from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.types import InlineKeyboardMarkup
from bot.keyboards.callbacks import (
    PaginationCB, LinkCB, ClientCB, PaymentCB, ReportCB,
    ChatCB, NotifCB, ProfileCB, ClientSelectCB, PayMethodCB,
    ConfirmCB,
)


def paginated_list_keyboard(
    items: list[dict],
    section: str,
    callback_cls,
    page: int = 0,
    per_page: int = 5,
    label_fn=None,
) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    start = page * per_page
    end = start + per_page
    page_items = items[start:end]

    for item in page_items:
        label = label_fn(item) if label_fn else str(item.get("title", item.get("name", f"#{item['id']}")))
        builder.button(
            text=label,
            callback_data=callback_cls(action="detail", id=item["id"]),
        )

    nav_buttons = []
    if page > 0:
        nav_buttons.append(("⬅️", PaginationCB(section=section, page=page - 1)))
    total_pages = max(1, (len(items) + per_page - 1) // per_page)
    nav_buttons.append((f"{page + 1}/{total_pages}", PaginationCB(section=section, page=page)))
    if end < len(items):
        nav_buttons.append(("➡️", PaginationCB(section=section, page=page + 1)))

    if len(nav_buttons) > 1:
        for text, cb in nav_buttons:
            builder.button(text=text, callback_data=cb)

    builder.adjust(1, *([1] * len(page_items)), len(nav_buttons) if len(nav_buttons) > 1 else 0)
    return builder.as_markup()


def links_list_keyboard(links: list[dict], page: int = 0) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    per_page = 5
    start = page * per_page
    end = start + per_page
    page_items = links[start:end]

    for link in page_items:
        status = "✅" if link.get("is_active") else "❌"
        builder.button(
            text=f"{status} {link['title']} ({link.get('clicks_count', 0)} кл.)",
            callback_data=LinkCB(action="detail", id=link["id"]),
        )

    nav = []
    if page > 0:
        nav.append(("⬅️", PaginationCB(section="links", page=page - 1)))
    total_pages = max(1, (len(links) + per_page - 1) // per_page)
    nav.append((f"{page + 1}/{total_pages}", PaginationCB(section="links", page=page)))
    if end < len(links):
        nav.append(("➡️", PaginationCB(section="links", page=page + 1)))

    if len(nav) > 1:
        for text, cb in nav:
            builder.button(text=text, callback_data=cb)

    builder.button(text="➕ Создать ссылку", callback_data=LinkCB(action="create"))
    builder.adjust(1)
    return builder.as_markup()


def clients_list_keyboard(clients: list[dict], page: int = 0) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    per_page = 10
    start = page * per_page
    end = start + per_page
    page_items = clients[start:end]

    for c in page_items:
        source = "📝" if c.get("source") == "form" else "✋"
        builder.button(
            text=f"{source} {c['name']}",
            callback_data=ClientCB(action="detail", id=c["id"]),
        )

    nav = []
    if page > 0:
        nav.append(("⬅️", PaginationCB(section="clients", page=page - 1)))
    total_pages = max(1, (len(clients) + per_page - 1) // per_page)
    nav.append((f"{page + 1}/{total_pages}", PaginationCB(section="clients", page=page)))
    if end < len(clients):
        nav.append(("➡️", PaginationCB(section="clients", page=page + 1)))

    if len(nav) > 1:
        for text, cb in nav:
            builder.button(text=text, callback_data=cb)

    builder.button(text="➕ Добавить клиента", callback_data=ClientCB(action="create"))
    builder.adjust(1)
    return builder.as_markup()


def payment_requests_keyboard(requests: list[dict], page: int = 0) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    per_page = 5
    start = page * per_page
    end = start + per_page
    page_items = requests[start:end]

    status_emoji = {"pending": "🟡", "approved": "🟢", "rejected": "🔴", "paid": "✅"}
    for req in page_items:
        emoji = status_emoji.get(req.get("status"), "⚪")
        builder.button(
            text=f"{emoji} #{req['id']} — {req.get('total_amount', 0):.0f} ₽",
            callback_data=PaymentCB(action="detail", id=req["id"]),
        )

    nav = []
    if page > 0:
        nav.append(("⬅️", PaginationCB(section="payments", page=page - 1)))
    total_pages = max(1, (len(requests) + per_page - 1) // per_page)
    nav.append((f"{page + 1}/{total_pages}", PaginationCB(section="payments", page=page)))
    if end < len(requests):
        nav.append(("➡️", PaginationCB(section="payments", page=page + 1)))

    if len(nav) > 1:
        for text, cb in nav:
            builder.button(text=text, callback_data=cb)

    builder.button(text="➕ Создать запрос", callback_data=PaymentCB(action="create"))
    builder.adjust(1)
    return builder.as_markup()


def report_period_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    periods = [
        ("Сегодня", "today"),
        ("Неделя", "week"),
        ("Месяц", "month"),
        ("Квартал", "quarter"),
        ("Год", "year"),
        ("Всё время", "all"),
        ("📅 Указать даты", "custom"),
    ]
    for label, period in periods:
        builder.button(text=label, callback_data=ReportCB(action="period", period=period))
    builder.adjust(3, 3, 1)
    return builder.as_markup()


def notifications_list_keyboard(notifications: list[dict], page: int = 0) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    per_page = 5
    start = page * per_page
    end = start + per_page
    page_items = notifications[start:end]

    for n in page_items:
        is_read = n.get("is_read", False)
        icon = "📭" if is_read else "📬"
        title = n.get("title", "Уведомление")
        if len(title) > 30:
            title = title[:27] + "..."
        builder.button(
            text=f"{icon} {title}",
            callback_data=NotifCB(action="detail", id=n["id"]),
        )

    nav = []
    if page > 0:
        nav.append(("⬅️", PaginationCB(section="notifs", page=page - 1)))
    total_pages = max(1, (len(notifications) + per_page - 1) // per_page)
    nav.append((f"{page + 1}/{total_pages}", PaginationCB(section="notifs", page=page)))
    if end < len(notifications):
        nav.append(("➡️", PaginationCB(section="notifs", page=page + 1)))

    if len(nav) > 1:
        for text, cb in nav:
            builder.button(text=text, callback_data=cb)

    builder.button(text="✅ Прочитать все", callback_data=NotifCB(action="read_all"))
    builder.adjust(1)
    return builder.as_markup()


def chat_pagination_keyboard(page: int, total_pages: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    nav = []
    if page > 0:
        nav.append(("◀️", ChatCB(action="page", page=page - 1)))
    nav.append((f"{page + 1}/{total_pages}", ChatCB(action="noop")))
    if page < total_pages - 1:
        nav.append(("▶️", ChatCB(action="page", page=page + 1)))
    for text, cb in nav:
        builder.button(text=text, callback_data=cb)
    builder.adjust(len(nav))
    return builder.as_markup()


def client_select_keyboard(clients: list[dict], selected_ids: set[int]) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for c in clients:
        is_sel = c["id"] in selected_ids
        icon = "✅" if is_sel else "⬜"
        reward = c.get("partner_reward", 0) or 0
        builder.button(
            text=f"{icon} {c['name']} — {reward:.0f} ₽",
            callback_data=ClientSelectCB(id=c["id"], selected=not is_sel),
        )

    total = sum((c.get("partner_reward", 0) or 0) for c in clients if c["id"] in selected_ids)
    builder.button(text=f"💰 Итого: {total:.0f} ₽ → Далее", callback_data=ConfirmCB(action="clients_done"))
    builder.adjust(1)
    return builder.as_markup()


def payment_method_keyboard(methods: list[dict]) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for i, m in enumerate(methods):
        builder.button(
            text=f"💳 {m.get('label', '')}",
            callback_data=PayMethodCB(action="select", index=i),
        )
    builder.button(text="✏️ Ввести новый", callback_data=PayMethodCB(action="new"))
    builder.adjust(1)
    return builder.as_markup()


def confirm_keyboard(action: str) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Подтвердить", callback_data=ConfirmCB(action=action, value="yes"))
    builder.button(text="❌ Отмена", callback_data=ConfirmCB(action=action, value="no"))
    builder.adjust(2)
    return builder.as_markup()


def skip_keyboard(action: str) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="⏭ Пропустить", callback_data=ConfirmCB(action=action, value="skip"))
    builder.adjust(1)
    return builder.as_markup()


def profile_keyboard(payment_methods: list[dict]) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for m in payment_methods:
        builder.button(
            text=f"🗑 {m.get('label', '')}",
            callback_data=ProfileCB(action="delete_pm", id=m.get("id", 0)),
        )
    builder.button(text="➕ Добавить способ оплаты", callback_data=ProfileCB(action="add_pm"))
    builder.adjust(1)
    return builder.as_markup()
