import logging
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.click import LinkClick
from app.models.client import Client
from app.models.landing import LandingPage
from app.models.link import PartnerLink
from app.models.partner import Partner
from app.config import get_settings
from app.schemas.admin import (
    AdminOverviewResponse,
    AdminPartnerDetailResponse,
    BulkClientPaymentUpdateRequest,
    ClientPaymentUpdateRequest,
    PartnerPaymentSummaryResponse,
    PartnerStatsResponse,
    RegistrationRequestResponse,
)
from app.services.auth_service import create_partner_workflow

logger = logging.getLogger(__name__)


def _get_effective_reward_percentage(partner: Partner) -> float:
    if partner.reward_percentage is not None:
        return partner.reward_percentage
    return get_settings().DEFAULT_REWARD_PERCENTAGE


async def update_client_payment(
    db: AsyncSession, client_id: int, data: ClientPaymentUpdateRequest
) -> Client | None:
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        return None

    if data.deal_amount is not None:
        client.deal_amount = data.deal_amount
    if data.partner_reward is not None:
        client.partner_reward = data.partner_reward
    elif data.deal_amount is not None and data.deal_amount > 0:
        # Auto-calculate partner_reward from deal_amount
        partner_result = await db.execute(select(Partner).where(Partner.id == client.partner_id))
        partner = partner_result.scalar_one_or_none()
        if partner:
            pct = _get_effective_reward_percentage(partner)
            client.partner_reward = round(data.deal_amount * pct / 100, 2)
    if data.payment_comment is not None:
        client.payment_comment = data.payment_comment
    if data.is_paid is not None:
        client.is_paid = data.is_paid
        if data.is_paid and not client.paid_at:
            client.paid_at = datetime.utcnow()
        elif not data.is_paid:
            client.paid_at = None

    await db.commit()
    await db.refresh(client)
    return client


async def bulk_update_client_payments(
    db: AsyncSession, data: BulkClientPaymentUpdateRequest
) -> list[Client]:
    result = await db.execute(
        select(Client).where(Client.id.in_(data.client_ids))
    )
    clients = list(result.scalars().all())

    # Cache partners for auto-calculation
    partners_cache: dict[int, Partner] = {}
    need_auto_calc = data.deal_amount is not None and data.deal_amount > 0 and data.partner_reward is None
    if need_auto_calc:
        partner_ids = {c.partner_id for c in clients}
        partners_result = await db.execute(select(Partner).where(Partner.id.in_(partner_ids)))
        for p in partners_result.scalars().all():
            partners_cache[p.id] = p

    for client in clients:
        if data.deal_amount is not None:
            client.deal_amount = data.deal_amount
        if data.partner_reward is not None:
            client.partner_reward = data.partner_reward
        elif need_auto_calc:
            partner = partners_cache.get(client.partner_id)
            if partner:
                pct = _get_effective_reward_percentage(partner)
                client.partner_reward = round(data.deal_amount * pct / 100, 2)
        if data.payment_comment is not None:
            client.payment_comment = data.payment_comment
        if data.is_paid is not None:
            client.is_paid = data.is_paid
            if data.is_paid and not client.paid_at:
                client.paid_at = datetime.utcnow()
            elif not data.is_paid:
                client.paid_at = None

    await db.commit()
    for client in clients:
        await db.refresh(client)
    return clients


async def get_partner_payment_summary(
    db: AsyncSession, partner_id: int
) -> PartnerPaymentSummaryResponse | None:
    result = await db.execute(select(Partner).where(Partner.id == partner_id))
    partner = result.scalar_one_or_none()
    if not partner:
        return None

    clients_result = await db.execute(
        select(Client).where(Client.partner_id == partner_id).order_by(Client.created_at.desc())
    )
    clients = clients_result.scalars().all()

    total_deal_amount = sum(c.deal_amount or 0 for c in clients)
    total_reward = sum(c.partner_reward or 0 for c in clients)
    paid_amount = sum(c.partner_reward or 0 for c in clients if c.is_paid)
    unpaid_amount = sum(c.partner_reward or 0 for c in clients if not c.is_paid)

    return PartnerPaymentSummaryResponse(
        partner_id=partner.id,
        partner_name=partner.name,
        total_deal_amount=total_deal_amount,
        total_reward=total_reward,
        paid_amount=paid_amount,
        unpaid_amount=unpaid_amount,
        clients=[
            {
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "phone": c.phone,
                "company": c.company,
                "source": c.source,
                "deal_amount": c.deal_amount,
                "partner_reward": c.partner_reward,
                "is_paid": c.is_paid,
                "paid_at": c.paid_at.isoformat() if c.paid_at else None,
                "payment_comment": c.payment_comment,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in clients
        ],
    )


async def get_admin_overview(db: AsyncSession) -> AdminOverviewResponse:
    total_partners = (await db.execute(
        select(func.count(Partner.id)).where(Partner.role == "partner")
    )).scalar() or 0
    total_links = (await db.execute(select(func.count(PartnerLink.id)))).scalar() or 0
    total_clicks = (await db.execute(select(func.count(LinkClick.id)))).scalar() or 0
    total_clients = (await db.execute(select(func.count(Client.id)))).scalar() or 0
    total_landings = (await db.execute(select(func.count(LandingPage.id)))).scalar() or 0

    total_paid_amount = (await db.execute(
        select(func.coalesce(func.sum(
            case((Client.is_paid == True, Client.partner_reward), else_=0)  # noqa: E712
        ), 0))
    )).scalar() or 0

    total_unpaid_amount = (await db.execute(
        select(func.coalesce(func.sum(
            case((Client.is_paid == False, Client.partner_reward), else_=0)  # noqa: E712
        ), 0))
    )).scalar() or 0

    partners = await get_partners_stats(db)

    return AdminOverviewResponse(
        total_partners=total_partners,
        total_links=total_links,
        total_clicks=total_clicks,
        total_clients=total_clients,
        total_landings=total_landings,
        total_paid_amount=float(total_paid_amount),
        total_unpaid_amount=float(total_unpaid_amount),
        partners=partners,
    )


async def get_partners_stats(db: AsyncSession) -> list[PartnerStatsResponse]:
    links_sq = (
        select(PartnerLink.partner_id, func.count(PartnerLink.id).label("cnt"))
        .group_by(PartnerLink.partner_id)
        .subquery()
    )
    clients_sq = (
        select(Client.partner_id, func.count(Client.id).label("cnt"))
        .group_by(Client.partner_id)
        .subquery()
    )
    landings_sq = (
        select(LandingPage.partner_id, func.count(LandingPage.id).label("cnt"))
        .group_by(LandingPage.partner_id)
        .subquery()
    )

    # Clicks subquery: count clicks through partner's links
    clicks_sq = (
        select(PartnerLink.partner_id, func.count(LinkClick.id).label("cnt"))
        .join(LinkClick, PartnerLink.id == LinkClick.link_id)
        .group_by(PartnerLink.partner_id)
        .subquery()
    )

    # Payment subqueries
    paid_sq = (
        select(
            Client.partner_id,
            func.coalesce(func.sum(
                case((Client.is_paid == True, Client.partner_reward), else_=0)  # noqa: E712
            ), 0).label("paid"),
        )
        .group_by(Client.partner_id)
        .subquery()
    )
    unpaid_sq = (
        select(
            Client.partner_id,
            func.coalesce(func.sum(
                case((Client.is_paid == False, Client.partner_reward), else_=0)  # noqa: E712
            ), 0).label("unpaid"),
        )
        .group_by(Client.partner_id)
        .subquery()
    )

    query = (
        select(
            Partner,
            func.coalesce(links_sq.c.cnt, 0).label("links_count"),
            func.coalesce(clicks_sq.c.cnt, 0).label("clicks_count"),
            func.coalesce(clients_sq.c.cnt, 0).label("clients_count"),
            func.coalesce(landings_sq.c.cnt, 0).label("landings_count"),
            func.coalesce(paid_sq.c.paid, 0).label("paid_amount"),
            func.coalesce(unpaid_sq.c.unpaid, 0).label("unpaid_amount"),
        )
        .outerjoin(links_sq, Partner.id == links_sq.c.partner_id)
        .outerjoin(clicks_sq, Partner.id == clicks_sq.c.partner_id)
        .outerjoin(clients_sq, Partner.id == clients_sq.c.partner_id)
        .outerjoin(landings_sq, Partner.id == landings_sq.c.partner_id)
        .outerjoin(paid_sq, Partner.id == paid_sq.c.partner_id)
        .outerjoin(unpaid_sq, Partner.id == unpaid_sq.c.partner_id)
        .where(Partner.role == "partner")
        .order_by(Partner.created_at.desc())
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        PartnerStatsResponse(
            id=row.Partner.id,
            email=row.Partner.email,
            name=row.Partner.name,
            company=row.Partner.company,
            partner_code=row.Partner.partner_code,
            created_at=row.Partner.created_at,
            is_active=row.Partner.is_active,
            links_count=row.links_count,
            clicks_count=row.clicks_count,
            clients_count=row.clients_count,
            landings_count=row.landings_count,
            paid_amount=float(row.paid_amount),
            unpaid_amount=float(row.unpaid_amount),
            reward_percentage=row.Partner.reward_percentage,
        )
        for row in rows
    ]


async def get_partner_detail(db: AsyncSession, partner_id: int) -> AdminPartnerDetailResponse | None:
    result = await db.execute(select(Partner).where(Partner.id == partner_id))
    partner = result.scalar_one_or_none()
    if not partner:
        return None

    links_result = await db.execute(select(PartnerLink).where(PartnerLink.partner_id == partner_id))
    links = links_result.scalars().all()

    clients_result = await db.execute(
        select(Client).where(Client.partner_id == partner_id).order_by(Client.created_at.desc()).limit(50)
    )
    clients = clients_result.scalars().all()

    # Count clicks
    clicks_count = (await db.execute(
        select(func.count(LinkClick.id)).where(
            LinkClick.link_id.in_(select(PartnerLink.id).where(PartnerLink.partner_id == partner_id))
        )
    )).scalar() or 0

    landings_count = (await db.execute(
        select(func.count(LandingPage.id)).where(LandingPage.partner_id == partner_id)
    )).scalar() or 0

    return AdminPartnerDetailResponse(
        id=partner.id,
        email=partner.email,
        name=partner.name,
        company=partner.company,
        partner_code=partner.partner_code,
        role=partner.role,
        created_at=partner.created_at,
        is_active=partner.is_active,
        workflow_id=partner.workflow_id,
        reward_percentage=partner.reward_percentage,
        effective_reward_percentage=_get_effective_reward_percentage(partner),
        links_count=len(links),
        clicks_count=clicks_count,
        clients_count=len(clients),
        landings_count=landings_count,
        links=[
            {
                "id": link.id,
                "title": link.title,
                "link_type": link.link_type,
                "link_code": link.link_code,
                "target_url": link.target_url,
                "is_active": link.is_active,
                "created_at": link.created_at.isoformat() if link.created_at else None,
            }
            for link in links
        ],
        clients=[
            {
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "phone": c.phone,
                "company": c.company,
                "source": c.source,
                "deal_amount": c.deal_amount,
                "partner_reward": c.partner_reward,
                "is_paid": c.is_paid,
                "paid_at": c.paid_at.isoformat() if c.paid_at else None,
                "payment_comment": c.payment_comment,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in clients
        ],
    )


async def update_partner_reward_percentage(
    db: AsyncSession, partner_id: int, reward_percentage: float | None
) -> Partner | None:
    result = await db.execute(select(Partner).where(Partner.id == partner_id))
    partner = result.scalar_one_or_none()
    if not partner:
        return None

    partner.reward_percentage = reward_percentage
    await db.commit()
    await db.refresh(partner)
    return partner


async def get_pending_registrations(db: AsyncSession) -> list[RegistrationRequestResponse]:
    result = await db.execute(
        select(Partner)
        .where(Partner.approval_status == "pending", Partner.role == "partner")
        .order_by(Partner.created_at.desc())
    )
    partners = result.scalars().all()
    return [RegistrationRequestResponse.model_validate(p) for p in partners]


async def get_pending_registrations_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count(Partner.id))
        .where(Partner.approval_status == "pending", Partner.role == "partner")
    )
    return result.scalar() or 0


async def approve_registration(db: AsyncSession, partner_id: int) -> Partner:
    result = await db.execute(select(Partner).where(Partner.id == partner_id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Партнёр не найден")
    if partner.approval_status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Заявка уже обработана")

    partner.approval_status = "approved"
    partner.is_active = True
    await db.commit()
    await db.refresh(partner)

    await create_partner_workflow(db, partner)

    return partner


async def reject_registration(db: AsyncSession, partner_id: int, reason: str | None = None) -> Partner:
    result = await db.execute(select(Partner).where(Partner.id == partner_id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Партнёр не найден")
    if partner.approval_status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Заявка уже обработана")

    partner.approval_status = "rejected"
    partner.rejection_reason = reason
    await db.commit()
    await db.refresh(partner)

    return partner
