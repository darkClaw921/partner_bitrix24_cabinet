from datetime import datetime, timedelta
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, BufferedInputFile
from aiogram.fsm.context import FSMContext

from bot.api_client import reports as reports_api
from bot.api_client.base import APIClient
from bot.services.session_manager import UserSession
from bot.keyboards.inline import report_period_keyboard, confirm_keyboard
from bot.keyboards.callbacks import ReportCB, ConfirmCB
from bot.states.report import ReportStates
from bot.utils.formatters import format_report

router = Router()


@router.message(F.text == "📋 Отчёты")
async def show_reports(message: Message, api_client: APIClient, session: UserSession):
    await message.answer("📋 <b>Выберите период отчёта:</b>", reply_markup=report_period_keyboard())


@router.callback_query(ReportCB.filter(F.action == "period"))
async def report_period_selected(callback: CallbackQuery, callback_data: ReportCB, state: FSMContext, api_client: APIClient, session: UserSession):
    await callback.answer()
    period = callback_data.period

    if period == "custom":
        await state.set_state(ReportStates.date_from)
        await callback.message.answer("Введите дату начала (YYYY-MM-DD):")
        return

    today = datetime.now().date()
    date_from, date_to = "", ""

    if period == "today":
        date_from = date_to = today.isoformat()
    elif period == "week":
        date_from = (today - timedelta(days=7)).isoformat()
        date_to = today.isoformat()
    elif period == "month":
        date_from = (today - timedelta(days=30)).isoformat()
        date_to = today.isoformat()
    elif period == "quarter":
        date_from = (today - timedelta(days=90)).isoformat()
        date_to = today.isoformat()
    elif period == "year":
        date_from = (today - timedelta(days=365)).isoformat()
        date_to = today.isoformat()

    await state.update_data(date_from=date_from, date_to=date_to)
    await _show_report(callback.message, api_client, date_from, date_to, state)


@router.message(ReportStates.date_from)
async def report_date_from(message: Message, state: FSMContext):
    text = message.text.strip()
    try:
        datetime.strptime(text, "%Y-%m-%d")
    except ValueError:
        await message.answer("Неверный формат. Введите дату в формате YYYY-MM-DD:")
        return
    await state.update_data(date_from=text)
    await state.set_state(ReportStates.date_to)
    await message.answer("Введите дату окончания (YYYY-MM-DD):")


@router.message(ReportStates.date_to)
async def report_date_to(message: Message, state: FSMContext, api_client: APIClient, session: UserSession):
    text = message.text.strip()
    try:
        datetime.strptime(text, "%Y-%m-%d")
    except ValueError:
        await message.answer("Неверный формат. Введите дату в формате YYYY-MM-DD:")
        return
    data = await state.get_data()
    await state.update_data(date_to=text)
    await _show_report(message, api_client, data["date_from"], text, state)


async def _show_report(message: Message, api_client: APIClient, date_from: str, date_to: str, state: FSMContext):
    report = await reports_api.get_report(api_client, date_from, date_to)
    if not report:
        await state.clear()
        await message.answer("Не удалось загрузить отчёт.")
        return

    text = format_report(report)
    from aiogram.utils.keyboard import InlineKeyboardBuilder
    builder = InlineKeyboardBuilder()
    builder.button(text="📄 Скачать PDF", callback_data=ReportCB(action="pdf"))
    builder.button(text="📋 Другой период", callback_data=ReportCB(action="new"))
    builder.adjust(2)
    await message.answer(text, reply_markup=builder.as_markup())


@router.callback_query(ReportCB.filter(F.action == "pdf"))
async def download_pdf(callback: CallbackQuery, state: FSMContext, api_client: APIClient, session: UserSession):
    await callback.answer("Генерация PDF...")
    data = await state.get_data()
    date_from = data.get("date_from", "")
    date_to = data.get("date_to", "")

    pdf_bytes = await reports_api.get_report_pdf(api_client, date_from, date_to)
    if not pdf_bytes:
        await callback.message.answer("Не удалось сгенерировать PDF.")
        return

    filename = f"report_{date_from}_{date_to}.pdf" if date_from else "report.pdf"
    doc = BufferedInputFile(pdf_bytes, filename=filename)
    await callback.message.answer_document(doc, caption="📄 Ваш отчёт")


@router.callback_query(ReportCB.filter(F.action == "new"))
async def new_report(callback: CallbackQuery, state: FSMContext, api_client: APIClient, session: UserSession):
    await callback.answer()
    await state.clear()
    await callback.message.answer("📋 <b>Выберите период отчёта:</b>", reply_markup=report_period_keyboard())
