from datetime import datetime

from fpdf import FPDF
from fpdf.fonts import FontFace

from app.schemas.report import (
    AllPartnersReportResponse,
    PartnerReportMetrics,
    PartnerReportResponse,
)

FONT_PATH = "/usr/share/fonts/truetype/dejavu/"


def _format_period(date_from, date_to) -> str:
    if date_from and date_to:
        return f"{date_from.strftime('%d.%m.%Y')} – {date_to.strftime('%d.%m.%Y')}"
    if date_from:
        return f"с {date_from.strftime('%d.%m.%Y')}"
    if date_to:
        return f"по {date_to.strftime('%d.%m.%Y')}"
    return "за весь период"


def _format_money(value: float) -> str:
    if value == 0:
        return "0,00"
    # 1234567.89 -> "1 234 567,89"
    integer_part = int(value)
    decimal_part = round((value - integer_part) * 100)
    int_str = f"{integer_part:,}".replace(",", " ")
    return f"{int_str},{decimal_part:02d}"


def _today_str() -> str:
    return datetime.utcnow().strftime("%d.%m.%Y")


class ReportPDF(FPDF):
    """Subclass with formal header/footer for legal-style documents."""

    def __init__(self, title_text: str):
        super().__init__()
        self._title_text = title_text
        self._header_ready = False

    def _ensure_fonts(self):
        if not self._header_ready:
            self.add_font("DejaVu", "", FONT_PATH + "DejaVuSans.ttf")
            self.add_font("DejaVu", "B", FONT_PATH + "DejaVuSans-Bold.ttf")
            self._header_ready = True

    def header(self):
        self._ensure_fonts()
        # Top line
        self.set_draw_color(0, 0, 0)
        self.set_line_width(0.5)
        self.line(10, 10, 200, 10)

        # Company name / document type — left-aligned, small caps style
        self.set_font("DejaVu", "B", 9)
        self.set_text_color(0, 0, 0)
        self.set_y(12)
        self.cell(w=0, h=5, text="ПАРТНЁРСКИЙ КАБИНЕТ", align="L")

        # Document number / date — right side
        self.set_font("DejaVu", "", 8)
        self.set_text_color(80, 80, 80)
        self.set_xy(10, 12)
        self.cell(w=0, h=5, text=f"Дата формирования: {_today_str()}", align="R")

        # Thin line under header
        self.set_draw_color(180, 180, 180)
        self.set_line_width(0.2)
        self.line(10, 19, 200, 19)
        self.ln(14)

    def footer(self):
        self.set_y(-15)
        self.set_draw_color(180, 180, 180)
        self.set_line_width(0.2)
        self.line(10, self.get_y(), 200, self.get_y())
        self.set_font("DejaVu", "", 7)
        self.set_text_color(120, 120, 120)
        self.cell(w=95, h=10, text="Документ сформирован автоматически", align="L")
        self.cell(w=95, h=10, text=f"Стр. {self.page_no()}/{{nb}}", align="R")


def _setup_pdf(title: str) -> ReportPDF:
    pdf = ReportPDF(title)
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    return pdf


def _render_document_title(pdf: ReportPDF, title: str) -> None:
    pdf.set_font("DejaVu", "B", 14)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(w=0, h=8, text=title, align="C")
    pdf.ln(10)


def _render_info_line(pdf: ReportPDF, label: str, value: str) -> None:
    pdf.set_font("DejaVu", "B", 9)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(w=35, h=6, text=label)
    pdf.set_font("DejaVu", "", 9)
    pdf.set_text_color(50, 50, 50)
    pdf.cell(w=0, h=6, text=value)
    pdf.ln(6)


def _render_section_header(pdf: ReportPDF, title: str) -> None:
    pdf.ln(4)
    pdf.set_draw_color(0, 0, 0)
    pdf.set_line_width(0.3)
    y = pdf.get_y()
    pdf.line(10, y, 200, y)
    pdf.ln(3)
    pdf.set_font("DejaVu", "B", 10)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(w=0, h=6, text=title.upper())
    pdf.ln(8)


def _render_metrics_block(pdf: ReportPDF, metrics: PartnerReportMetrics) -> None:
    headings_style = FontFace(emphasis="BOLD", color=(0, 0, 0), fill_color=(230, 230, 230))

    pdf.set_font("DejaVu", "", 9)
    pdf.set_text_color(0, 0, 0)

    items = [
        ("Количество лидов", str(metrics.total_leads)),
        ("Количество продаж", str(metrics.total_sales)),
        ("Сумма сделок, руб.", _format_money(metrics.total_deal_amount)),
        ("Начисленная комиссия, руб.", _format_money(metrics.total_commission)),
        ("Выплаченная комиссия, руб.", _format_money(metrics.paid_commission)),
        ("Невыплаченная комиссия, руб.", _format_money(metrics.unpaid_commission)),
        ("Лиды в работе", str(metrics.leads_in_progress)),
        ("Количество кликов", str(metrics.total_clicks)),
        ("Запросов на выплату (всего)", str(metrics.payment_requests_total)),
        ("Запросов одобрено", str(metrics.payment_requests_approved)),
        ("Запросов отклонено", str(metrics.payment_requests_rejected)),
        ("Запросов на рассмотрении", str(metrics.payment_requests_pending)),
    ]

    with pdf.table(
        headings_style=headings_style,
        borders_layout="SINGLE_TOP_LINE",
        cell_fill_mode="ROWS",
        cell_fill_color=(248, 248, 248),
        col_widths=(65, 35),
        text_align=("LEFT", "RIGHT"),
    ) as table:
        header = table.row()
        header.cell("Показатель")
        header.cell("Значение")
        for label, value in items:
            row = table.row()
            row.cell(label)
            row.cell(value)


def _render_clients_table(pdf: ReportPDF, clients: list[dict]) -> None:
    _render_section_header(pdf, "Детализация по клиентам")

    headings_style = FontFace(emphasis="BOLD", color=(0, 0, 0), fill_color=(220, 220, 220))
    pdf.set_font("DejaVu", "", 7)
    pdf.set_text_color(0, 0, 0)

    with pdf.table(
        headings_style=headings_style,
        cell_fill_mode="ROWS",
        cell_fill_color=(250, 250, 250),
        borders_layout="SINGLE_TOP_LINE",
        col_widths=(6, 18, 20, 14, 12, 12, 6, 12),
        text_align=("CENTER", "LEFT", "LEFT", "LEFT", "RIGHT", "RIGHT", "CENTER", "CENTER"),
    ) as table:
        header = table.row()
        for h in ["№", "Имя", "Email", "Телефон", "Сумма, руб.", "Комиссия, руб.", "Опл.", "Дата"]:
            header.cell(h)

        for i, c in enumerate(clients, 1):
            row = table.row()
            row.cell(str(i))
            row.cell(str(c.get("name") or "—"))
            row.cell(str(c.get("email") or "—"))
            row.cell(str(c.get("phone") or "—"))
            row.cell(_format_money(c.get("deal_amount") or 0))
            row.cell(_format_money(c.get("partner_reward") or 0))
            row.cell("Да" if c.get("is_paid") else "Нет")
            row.cell(str(c.get("created_at") or "—"))


def _render_signature_block(pdf: ReportPDF) -> None:
    pdf.ln(16)
    pdf.set_draw_color(0, 0, 0)
    pdf.set_line_width(0.2)

    y = pdf.get_y()
    # Left: signature line
    pdf.set_font("DejaVu", "", 8)
    pdf.set_text_color(100, 100, 100)
    pdf.set_xy(10, y)
    pdf.cell(w=60, h=5, text="Подпись ___________________")

    # Right: date
    pdf.set_xy(140, y)
    pdf.cell(w=60, h=5, text=f"Дата: {_today_str()}", align="R")


# --- Public API ---


def generate_partner_report_pdf(report: PartnerReportResponse) -> bytes:
    pdf = _setup_pdf(f"Отчёт партнёра: {report.partner_name}")

    _render_document_title(pdf, "ОТЧЁТ О ДЕЯТЕЛЬНОСТИ ПАРТНЁРА")

    # Info block
    _render_info_line(pdf, "Партнёр:", report.partner_name)
    _render_info_line(pdf, "Email:", report.partner_email)
    _render_info_line(pdf, "Период:", _format_period(report.date_from, report.date_to))
    pdf.ln(4)

    # Metrics
    _render_section_header(pdf, "Сводные показатели")
    _render_metrics_block(pdf, report.metrics)

    # Clients table
    if report.clients:
        _render_clients_table(pdf, report.clients)

    _render_signature_block(pdf)

    return bytes(pdf.output())


def generate_all_partners_report_pdf(report: AllPartnersReportResponse) -> bytes:
    pdf = _setup_pdf("Сводный отчёт по партнёрам")

    _render_document_title(pdf, "СВОДНЫЙ ОТЧЁТ ПО ПАРТНЁРАМ")

    # Info
    _render_info_line(pdf, "Период:", _format_period(report.date_from, report.date_to))
    _render_info_line(pdf, "Партнёров:", str(len(report.partners)))
    pdf.ln(4)

    # Totals
    _render_section_header(pdf, "Итоговые показатели")
    _render_metrics_block(pdf, report.totals)

    # Partners table
    if report.partners:
        _render_section_header(pdf, "Детализация по партнёрам")

        headings_style = FontFace(emphasis="BOLD", color=(0, 0, 0), fill_color=(220, 220, 220))
        pdf.set_font("DejaVu", "", 7)
        pdf.set_text_color(0, 0, 0)

        with pdf.table(
            headings_style=headings_style,
            cell_fill_mode="ROWS",
            cell_fill_color=(250, 250, 250),
            borders_layout="SINGLE_TOP_LINE",
            col_widths=(5, 16, 20, 8, 8, 13, 13, 13),
            text_align=("CENTER", "LEFT", "LEFT", "RIGHT", "RIGHT", "RIGHT", "RIGHT", "RIGHT"),
        ) as table:
            header = table.row()
            for h in ["№", "Имя", "Email", "Лиды", "Продажи", "Комиссия", "Выплачено", "Не выплач."]:
                header.cell(h)

            for i, p in enumerate(report.partners, 1):
                row = table.row()
                row.cell(str(i))
                row.cell(p.partner_name)
                row.cell(p.partner_email)
                row.cell(str(p.metrics.total_leads))
                row.cell(str(p.metrics.total_sales))
                row.cell(_format_money(p.metrics.total_commission))
                row.cell(_format_money(p.metrics.paid_commission))
                row.cell(_format_money(p.metrics.unpaid_commission))

    _render_signature_block(pdf)

    return bytes(pdf.output())
