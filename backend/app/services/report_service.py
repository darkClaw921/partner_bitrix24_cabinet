import logging
from datetime import date

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.click import LinkClick
from app.models.client import Client
from app.models.link import PartnerLink
from app.models.partner import Partner
from app.models.payment_request import PaymentRequest
from app.schemas.report import (
    AllPartnersReportResponse,
    AllPartnersReportRow,
    PartnerReportMetrics,
    PartnerReportResponse,
)
from app.services.b24_integration_service import b24_service

logger = logging.getLogger(__name__)


FINAL_DEAL_STATUSES = {"WON", "LOSE", "C:WON", "C:LOSE"}


def _apply_date_filter(query, column, date_from: date | None, date_to: date | None):
    if date_from:
        query = query.where(func.date(column) >= date_from)
    if date_to:
        query = query.where(func.date(column) <= date_to)
    return query


async def _compute_partner_metrics(
    db: AsyncSession, partner_id: int, date_from: date | None, date_to: date | None
) -> PartnerReportMetrics:
    # Base client query with date filter
    base_q = select(Client).where(Client.partner_id == partner_id)
    base_q = _apply_date_filter(base_q, Client.created_at, date_from, date_to)

    result = await db.execute(base_q)
    clients = list(result.scalars().all())

    total_leads = len(clients)
    total_sales = sum(1 for c in clients if c.deal_amount and c.deal_amount > 0)
    total_deal_amount = sum(c.deal_amount or 0 for c in clients)
    total_commission = sum(c.partner_reward or 0 for c in clients)
    paid_commission = sum(c.partner_reward or 0 for c in clients if c.is_paid)
    unpaid_commission = sum(c.partner_reward or 0 for c in clients if not c.is_paid and c.partner_reward)
    leads_in_progress = sum(
        1 for c in clients
        if c.deal_status not in FINAL_DEAL_STATUSES or c.deal_status is None
    )

    # Clicks
    clicks_q = select(func.count(LinkClick.id)).where(
        LinkClick.link_id.in_(
            select(PartnerLink.id).where(PartnerLink.partner_id == partner_id)
        )
    )
    clicks_q = _apply_date_filter(clicks_q, LinkClick.created_at, date_from, date_to)
    total_clicks = (await db.execute(clicks_q)).scalar() or 0

    # Payment requests
    pr_q = select(PaymentRequest).where(PaymentRequest.partner_id == partner_id)
    pr_q = _apply_date_filter(pr_q, PaymentRequest.created_at, date_from, date_to)
    pr_result = await db.execute(pr_q)
    payment_requests = list(pr_result.scalars().all())

    pr_total = len(payment_requests)
    pr_approved = sum(1 for pr in payment_requests if pr.status == "approved")
    pr_rejected = sum(1 for pr in payment_requests if pr.status == "rejected")
    pr_pending = sum(1 for pr in payment_requests if pr.status == "pending")
    pr_amount = sum(pr.total_amount for pr in payment_requests)

    return PartnerReportMetrics(
        total_leads=total_leads,
        total_sales=total_sales,
        total_deal_amount=round(total_deal_amount, 2),
        total_commission=round(total_commission, 2),
        paid_commission=round(paid_commission, 2),
        unpaid_commission=round(unpaid_commission, 2),
        leads_in_progress=leads_in_progress,
        total_clicks=total_clicks,
        payment_requests_total=pr_total,
        payment_requests_approved=pr_approved,
        payment_requests_rejected=pr_rejected,
        payment_requests_pending=pr_pending,
        payment_requests_amount=round(pr_amount, 2),
    )


async def _build_lead_status_maps(workflow_id: int) -> tuple[dict[str, str], dict[str, str]]:
    """Fetch leads from b24-transfer-lead and build status lookup maps.

    Returns:
        (by_external_id, by_phone) — two maps: bitrix24_lead_id → status, phone → status.
    """
    by_ext_id: dict[str, str] = {}
    by_phone: dict[str, str] = {}
    try:
        leads = await b24_service.get_leads(workflow_id)

        # Resolve lead status IDs to names
        status_name_map: dict[str, str] = {}
        try:
            lead_statuses = await b24_service.get_lead_statuses(workflow_id)
            for s in lead_statuses:
                status_name_map[s.get("id", "")] = s.get("name", "")
        except Exception:
            pass

        for lead in leads:
            raw_status = lead.get("status", "")
            status_display = (
                lead.get("deal_status_name")
                or status_name_map.get(raw_status)
                or raw_status
            )

            b24_id = str(lead.get("bitrix24_lead_id") or lead.get("id", ""))
            if b24_id:
                by_ext_id[b24_id] = status_display

            phone = lead.get("phone", "")
            if phone:
                by_phone[phone] = status_display
    except Exception as e:
        logger.warning("Failed to build lead status maps from b24-transfer-lead: %s", e)
    return by_ext_id, by_phone


def _resolve_client_status(
    c: Client,
    by_ext_id: dict[str, str],
    by_phone: dict[str, str],
) -> str:
    """Get human-readable status for a client, with b24 fallbacks."""
    if c.deal_status_name:
        return c.deal_status_name
    if c.deal_status:
        return c.deal_status
    # Fallback: look up in b24-transfer-lead by external_id, then by phone
    if c.external_id and c.external_id in by_ext_id:
        return by_ext_id[c.external_id]
    if c.phone and c.phone in by_phone:
        return by_phone[c.phone]
    return ""


async def _get_partner_clients_detail(
    db: AsyncSession, partner_id: int, date_from: date | None, date_to: date | None
) -> list[dict]:
    q = select(Client).where(Client.partner_id == partner_id).order_by(Client.created_at.desc())
    q = _apply_date_filter(q, Client.created_at, date_from, date_to)

    result = await db.execute(q)
    clients = list(result.scalars().all())

    # For clients without deal_status_name, fetch lead status from b24-transfer-lead
    by_ext_id: dict[str, str] = {}
    by_phone: dict[str, str] = {}
    needs_b24_lookup = any(not c.deal_status_name for c in clients)
    if needs_b24_lookup:
        partner_result = await db.execute(select(Partner).where(Partner.id == partner_id))
        partner = partner_result.scalar_one_or_none()
        if partner and partner.workflow_id:
            by_ext_id, by_phone = await _build_lead_status_maps(partner.workflow_id)

    return [
        {
            "name": c.name,
            "email": c.email,
            "phone": c.phone,
            "deal_amount": c.deal_amount,
            "partner_reward": c.partner_reward,
            "is_paid": c.is_paid,
            "deal_status": _resolve_client_status(c, by_ext_id, by_phone),
            "created_at": c.created_at.strftime("%d.%m.%Y") if c.created_at else "",
        }
        for c in clients
    ]


async def generate_partner_report(
    db: AsyncSession, partner_id: int, date_from: date | None, date_to: date | None
) -> PartnerReportResponse | None:
    result = await db.execute(select(Partner).where(Partner.id == partner_id))
    partner = result.scalar_one_or_none()
    if not partner:
        return None

    metrics = await _compute_partner_metrics(db, partner_id, date_from, date_to)
    clients = await _get_partner_clients_detail(db, partner_id, date_from, date_to)

    return PartnerReportResponse(
        partner_id=partner.id,
        partner_name=partner.name,
        partner_email=partner.email,
        date_from=date_from,
        date_to=date_to,
        metrics=metrics,
        clients=clients,
    )


async def generate_all_partners_report(
    db: AsyncSession, date_from: date | None, date_to: date | None, partner_id: int | None = None
) -> AllPartnersReportResponse:
    if partner_id:
        # Single partner mode for admin
        partners_q = select(Partner).where(Partner.id == partner_id)
    else:
        partners_q = select(Partner).where(Partner.role == "partner").order_by(Partner.created_at.desc())

    result = await db.execute(partners_q)
    partners = list(result.scalars().all())

    rows: list[AllPartnersReportRow] = []
    totals = PartnerReportMetrics()

    for p in partners:
        metrics = await _compute_partner_metrics(db, p.id, date_from, date_to)
        rows.append(AllPartnersReportRow(
            partner_id=p.id,
            partner_name=p.name,
            partner_email=p.email,
            metrics=metrics,
        ))

        totals.total_leads += metrics.total_leads
        totals.total_sales += metrics.total_sales
        totals.total_deal_amount += metrics.total_deal_amount
        totals.total_commission += metrics.total_commission
        totals.paid_commission += metrics.paid_commission
        totals.unpaid_commission += metrics.unpaid_commission
        totals.leads_in_progress += metrics.leads_in_progress
        totals.total_clicks += metrics.total_clicks
        totals.payment_requests_total += metrics.payment_requests_total
        totals.payment_requests_approved += metrics.payment_requests_approved
        totals.payment_requests_rejected += metrics.payment_requests_rejected
        totals.payment_requests_pending += metrics.payment_requests_pending
        totals.payment_requests_amount += metrics.payment_requests_amount

    totals.total_deal_amount = round(totals.total_deal_amount, 2)
    totals.total_commission = round(totals.total_commission, 2)
    totals.paid_commission = round(totals.paid_commission, 2)
    totals.unpaid_commission = round(totals.unpaid_commission, 2)
    totals.payment_requests_amount = round(totals.payment_requests_amount, 2)

    return AllPartnersReportResponse(
        date_from=date_from,
        date_to=date_to,
        totals=totals,
        partners=rows,
    )
