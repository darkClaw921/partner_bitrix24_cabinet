from datetime import datetime
from typing import Optional


def format_dashboard(data: dict) -> str:
    lines = ["<b>📊 Дашборд</b>\n"]
    lines.append(f"🖱 Кликов всего: <b>{data.get('total_clicks', 0)}</b>")
    lines.append(f"🖱 Кликов сегодня: <b>{data.get('today_clicks', 0)}</b>")
    lines.append(f"👥 Клиентов: <b>{data.get('total_clients', 0)}</b>")
    lines.append(f"👥 Клиентов сегодня: <b>{data.get('today_clients', 0)}</b>")
    lines.append(f"🔗 Ссылок: <b>{data.get('total_links', 0)}</b>")
    conv = data.get("conversion_rate", 0) or 0
    lines.append(f"📈 Конверсия: <b>{conv:.1f}%</b>")
    return "\n".join(lines)


def format_link_detail(link: dict) -> str:
    from bot.config import settings
    status = "✅ Активна" if link.get("is_active") else "❌ Неактивна"
    link_code = link.get("link_code", "")
    public_url = f"{settings.PUBLIC_BASE_URL}/api/public/r/{link_code}"
    lines = [
        f"<b>🔗 {link.get('title', 'Ссылка')}</b>\n",
        f"Статус: {status}",
        f"Тип: {link.get('link_type', '—')}",
        f"Код: <code>{link_code}</code>",
        f"Целевой URL: {link.get('target_url', '—')}",
        f"Кликов: {link.get('clicks_count', 0)}",
        f"\n🔗 <b>Партнёрская ссылка (скопируйте):</b>",
        f"<code>{public_url}</code>",
    ]
    for field in ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]:
        val = link.get(field)
        if val:
            lines.append(f"{field}: <code>{val}</code>")
    return "\n".join(lines)


def format_client_detail(client: dict) -> str:
    lines = [f"<b>👤 {client.get('name', 'Клиент')}</b>\n"]
    lines.append(f"Источник: {'📝 Форма' if client.get('source') == 'form' else '✋ Вручную'}")
    if client.get("link_title"):
        lines.append(f"Ссылка: {client['link_title']}")
    if client.get("deal_status_name"):
        lines.append(f"Сделка: {client['deal_status_name']}")
    if client.get("deal_amount"):
        lines.append(f"Сумма сделки: {client['deal_amount']:.0f} ₽")
    if client.get("partner_reward"):
        lines.append(f"Вознаграждение: {client['partner_reward']:.0f} ₽")
    paid = "✅ Оплачено" if client.get("is_paid") else "⏳ Не оплачено"
    lines.append(f"Оплата: {paid}")
    if client.get("comment"):
        lines.append(f"Комментарий: {client['comment']}")
    lines.append(f"Создан: {_format_dt(client.get('created_at'))}")
    return "\n".join(lines)


def format_analytics(summary: dict, links_stats: list[dict]) -> str:
    lines = ["<b>📈 Аналитика</b>\n"]
    lines.append(f"🖱 Всего кликов: <b>{summary.get('total_clicks', 0)}</b>")
    lines.append(f"👥 Всего клиентов: <b>{summary.get('total_clients', 0)}</b>")
    conv = summary.get("conversion_rate", 0) or 0
    lines.append(f"📊 Конверсия: <b>{conv:.1f}%</b>")

    if links_stats:
        lines.append("\n<b>По ссылкам:</b>")
        for ls in links_stats[:10]:
            lines.append(
                f"  • {ls.get('title', '—')}: "
                f"{ls.get('clicks_count', 0)} кл., "
                f"{ls.get('clients_count', 0)} кл-тов"
            )
    return "\n".join(lines)


def format_report(report: dict) -> str:
    metrics = report.get("metrics", {})
    period = report.get("period", {})
    lines = ["<b>📋 Отчёт</b>\n"]
    if period:
        lines.append(f"Период: {period.get('date_from', '—')} — {period.get('date_to', '—')}\n")
    lines.append(f"👥 Лидов: <b>{metrics.get('total_leads', 0)}</b>")
    lines.append(f"🖱 Кликов: <b>{metrics.get('total_clicks', 0)}</b>")
    lines.append(f"👤 Уникальных клиентов: <b>{metrics.get('unique_clients', 0)}</b>")
    lines.append(f"📊 Сделок: <b>{metrics.get('total_deals', 0)}</b>")
    lines.append(f"✅ Успешных: <b>{metrics.get('total_successful_deals', 0)}</b>")
    lines.append(f"❌ Проигранных: <b>{metrics.get('total_lost_deals', 0)}</b>")
    conv_ld = metrics.get("conversion_leads_to_deals", 0) or 0
    conv_ds = metrics.get("conversion_deals_to_successful", 0) or 0
    lines.append(f"📈 Конверсия лиды→сделки: <b>{conv_ld:.1f}%</b>")
    lines.append(f"📈 Конверсия сделки→успешные: <b>{conv_ds:.1f}%</b>")
    lines.append(f"💰 Сумма продаж: <b>{metrics.get('total_deal_amount', 0):.0f} ₽</b>")
    lines.append(f"💵 Комиссия: <b>{metrics.get('total_partner_reward', 0):.0f} ₽</b>")
    lines.append(f"✅ Выплачено: <b>{metrics.get('paid_amount', 0):.0f} ₽</b>")
    lines.append(f"⏳ Ожидает: <b>{metrics.get('pending_amount', 0):.0f} ₽</b>")
    lines.append(f"📝 Запросов на выплату: <b>{metrics.get('payment_requests_count', 0)}</b>")
    return "\n".join(lines)


def format_payment_request_detail(req: dict) -> str:
    status_map = {"pending": "🟡 Ожидает", "approved": "🟢 Одобрен", "rejected": "🔴 Отклонён", "paid": "✅ Выплачен"}
    lines = [
        f"<b>💰 Запрос #{req.get('id', '—')}</b>\n",
        f"Статус: {status_map.get(req.get('status'), req.get('status', '—'))}",
        f"Сумма: <b>{req.get('total_amount', 0):.0f} ₽</b>",
    ]
    pd = req.get("payment_details")
    if pd:
        if isinstance(pd, dict):
            lines.append(f"Реквизиты: {pd.get('label', '')} — {pd.get('value', '')}")
        else:
            lines.append(f"Реквизиты: {pd}")
    if req.get("comment"):
        lines.append(f"Комментарий: {req['comment']}")
    if req.get("admin_comment"):
        lines.append(f"Ответ админа: {req['admin_comment']}")
    lines.append(f"Создан: {_format_dt(req.get('created_at'))}")
    if req.get("processed_at"):
        lines.append(f"Обработан: {_format_dt(req['processed_at'])}")
    return "\n".join(lines)


def format_notification(n: dict) -> str:
    is_read = "📭" if n.get("is_read") else "📬"
    lines = [
        f"{is_read} <b>{n.get('title', 'Уведомление')}</b>\n",
        n.get("message", ""),
    ]
    if n.get("file_name") and not n.get("file_url"):
        lines.append(f"\n📎 {n['file_name']}")
    lines.append(f"\n{_format_dt(n.get('created_at'))}")
    return "\n".join(lines)


def format_notification_push(n: dict) -> str:
    """Format a notification for push delivery in Telegram."""
    lines = [
        f"🔔 <b>{n.get('title', 'Уведомление')}</b>\n",
        n.get("message", ""),
    ]
    if n.get("file_name") and not n.get("file_url"):
        lines.append(f"\n📎 {n['file_name']}")
    lines.append(f"\n<i>{_format_dt(n.get('created_at'))}</i>")
    return "\n".join(lines)


def get_notification_file_type(file_name: str) -> str:
    """Return 'image', 'video', or 'document' based on file extension."""
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if ext in ("jpg", "jpeg", "png", "gif", "webp"):
        return "image"
    if ext in ("mp4", "mov", "avi"):
        return "video"
    return "document"


CHAT_PER_PAGE = 8


def format_chat_page(messages: list[dict], partner_id: int, page: int) -> tuple[str, int, int]:
    """Format a page of chat messages.

    Returns (text, current_page, total_pages).
    Page -1 means last page.
    """
    if not messages:
        return "💬 <b>Чат с поддержкой</b>\n\n<i>Сообщений пока нет. Напишите что-нибудь!</i>", 0, 1

    total = len(messages)
    total_pages = max(1, (total + CHAT_PER_PAGE - 1) // CHAT_PER_PAGE)

    if page < 0 or page >= total_pages:
        page = total_pages - 1

    start = page * CHAT_PER_PAGE
    end = min(start + CHAT_PER_PAGE, total)
    page_msgs = messages[start:end]

    lines = ["💬 <b>Чат с поддержкой</b>\n"]
    for msg in page_msgs:
        is_me = msg.get("sender_id") == partner_id
        sender = "📤 Вы" if is_me else "👨‍💼 Админ"
        dt = _format_dt(msg.get("created_at"))
        text = msg.get("message", "")
        file_name = msg.get("file_name")
        content_parts = []
        if file_name:
            content_parts.append(f"📎 {file_name}")
        if text:
            content_parts.append(text)
        content = "\n".join(content_parts)
        lines.append(f"<b>{sender}</b>  <i>{dt}</i>\n{content}")
    return "\n\n".join(lines), page, total_pages


def format_profile(partner: dict) -> str:
    lines = [
        "<b>👤 Профиль</b>\n",
        f"Имя: {partner.get('name', '—')}",
        f"Email: {partner.get('email', '—')}",
    ]
    if partner.get("company"):
        lines.append(f"Компания: {partner['company']}")
    lines.append(f"Код партнёра: <code>{partner.get('partner_code', '—')}</code>")

    methods = partner.get("saved_payment_methods") or []
    if methods:
        lines.append("\n<b>Способы оплаты:</b>")
        for m in methods:
            lines.append(f"  💳 {m.get('label', '')} — {m.get('value', '')}")
    else:
        lines.append("\nСпособы оплаты не добавлены")
    return "\n".join(lines)


def _format_dt(dt_str: Optional[str]) -> str:
    if not dt_str:
        return "—"
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%d.%m.%Y %H:%M")
    except (ValueError, AttributeError):
        return str(dt_str)[:16]
