from datetime import date

from pydantic import BaseModel


class PartnerReportMetrics(BaseModel):
    total_leads: int = 0
    total_sales: int = 0
    total_deal_amount: float = 0.0
    total_commission: float = 0.0
    paid_commission: float = 0.0
    unpaid_commission: float = 0.0
    leads_in_progress: int = 0
    total_clicks: int = 0
    payment_requests_total: int = 0
    payment_requests_approved: int = 0
    payment_requests_rejected: int = 0
    payment_requests_pending: int = 0
    payment_requests_amount: float = 0.0


class PartnerReportResponse(BaseModel):
    partner_id: int
    partner_name: str
    partner_email: str
    date_from: date | None
    date_to: date | None
    metrics: PartnerReportMetrics
    clients: list[dict] = []


class AllPartnersReportRow(BaseModel):
    partner_id: int
    partner_name: str
    partner_email: str
    metrics: PartnerReportMetrics


class AllPartnersReportResponse(BaseModel):
    date_from: date | None
    date_to: date | None
    totals: PartnerReportMetrics
    partners: list[AllPartnersReportRow] = []
