import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.click import LinkClick
from app.models.client import Client
from app.models.link import PartnerLink
from app.models.partner import Partner
from app.schemas.analytics import (
    BitrixClientResponse,
    BitrixStatsResponse,
    ClientStatsResponse,
    DailyClicksResponse,
    LinkStatsResponse,
    SummaryResponse,
)
from app.services.external_api import fetch_bitrix_stats as ext_fetch_bitrix_stats

logger = logging.getLogger(__name__)


async def get_summary(db: AsyncSession, partner_id: int) -> SummaryResponse:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    partner_links_sq = select(PartnerLink.id).where(PartnerLink.partner_id == partner_id).scalar_subquery()

    total_clicks_q = select(func.count(LinkClick.id)).where(LinkClick.link_id.in_(
        select(PartnerLink.id).where(PartnerLink.partner_id == partner_id)
    ))
    total_clicks = (await db.execute(total_clicks_q)).scalar() or 0

    total_clients_q = select(func.count(Client.id)).where(Client.partner_id == partner_id)
    total_clients = (await db.execute(total_clients_q)).scalar() or 0

    clicks_today_q = total_clicks_q.where(LinkClick.created_at >= today_start)
    clicks_today = (await db.execute(clicks_today_q)).scalar() or 0

    clients_today_q = select(func.count(Client.id)).where(
        Client.partner_id == partner_id,
        Client.created_at >= today_start,
    )
    clients_today = (await db.execute(clients_today_q)).scalar() or 0

    conversion_rate = round(total_clients / total_clicks * 100, 2) if total_clicks > 0 else 0.0

    return SummaryResponse(
        total_clicks=total_clicks,
        total_clients=total_clients,
        conversion_rate=conversion_rate,
        clicks_today=clicks_today,
        clients_today=clients_today,
    )


async def get_links_stats(db: AsyncSession, partner_id: int) -> list[LinkStatsResponse]:
    clicks_sq = (
        select(LinkClick.link_id, func.count(LinkClick.id).label("clicks_count"))
        .group_by(LinkClick.link_id)
        .subquery()
    )
    clients_sq = (
        select(Client.link_id, func.count(Client.id).label("clients_count"))
        .where(Client.link_id.isnot(None))
        .group_by(Client.link_id)
        .subquery()
    )

    query = (
        select(
            PartnerLink.id,
            PartnerLink.title,
            PartnerLink.link_type,
            PartnerLink.link_code,
            func.coalesce(clicks_sq.c.clicks_count, 0).label("clicks_count"),
            func.coalesce(clients_sq.c.clients_count, 0).label("clients_count"),
        )
        .outerjoin(clicks_sq, PartnerLink.id == clicks_sq.c.link_id)
        .outerjoin(clients_sq, PartnerLink.id == clients_sq.c.link_id)
        .where(PartnerLink.partner_id == partner_id)
        .order_by(func.coalesce(clicks_sq.c.clicks_count, 0).desc())
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        LinkStatsResponse(
            link_id=row.id,
            title=row.title,
            link_type=row.link_type,
            link_code=row.link_code,
            clicks_count=row.clicks_count,
            clients_count=row.clients_count,
            conversion_rate=round(row.clients_count / row.clicks_count * 100, 2) if row.clicks_count > 0 else 0.0,
        )
        for row in rows
    ]


async def get_link_clicks_by_day(
    db: AsyncSession, partner_id: int, link_id: int, days: int = 30
) -> list[DailyClicksResponse]:
    link_q = select(PartnerLink).where(PartnerLink.id == link_id, PartnerLink.partner_id == partner_id)
    link = (await db.execute(link_q)).scalar_one_or_none()
    if not link:
        return []

    start_date = date.today() - timedelta(days=days - 1)

    query = (
        select(
            func.date(LinkClick.created_at).label("click_date"),
            func.count(LinkClick.id).label("clicks"),
        )
        .where(
            LinkClick.link_id == link_id,
            func.date(LinkClick.created_at) >= start_date,
        )
        .group_by(func.date(LinkClick.created_at))
    )
    result = await db.execute(query)
    rows = {str(row.click_date): row.clicks for row in result.all()}

    daily_data = []
    for i in range(days):
        d = start_date + timedelta(days=i)
        day_str = str(d)
        daily_data.append(DailyClicksResponse(date=day_str, clicks=rows.get(day_str, 0)))

    return daily_data


async def get_clients_stats_by_day(
    db: AsyncSession, partner_id: int, days: int = 30
) -> list[ClientStatsResponse]:
    start_date = date.today() - timedelta(days=days - 1)

    query = (
        select(
            func.date(Client.created_at).label("client_date"),
            Client.source,
            func.count(Client.id).label("cnt"),
        )
        .where(
            Client.partner_id == partner_id,
            func.date(Client.created_at) >= start_date,
        )
        .group_by(func.date(Client.created_at), Client.source)
    )
    result = await db.execute(query)
    rows = result.all()

    data_map: dict[str, dict[str, int]] = {}
    for row in rows:
        day_str = str(row.client_date)
        if day_str not in data_map:
            data_map[day_str] = {"form": 0, "manual": 0}
        data_map[day_str][row.source] = row.cnt

    daily_data = []
    for i in range(days):
        d = start_date + timedelta(days=i)
        day_str = str(d)
        counts = data_map.get(day_str, {"form": 0, "manual": 0})
        form_count = counts.get("form", 0)
        manual_count = counts.get("manual", 0)
        daily_data.append(ClientStatsResponse(
            date=day_str,
            form_count=form_count,
            manual_count=manual_count,
            total=form_count + manual_count,
        ))

    return daily_data


async def get_bitrix_stats(db: AsyncSession, partner_id: int) -> BitrixStatsResponse:
    partner_q = select(Partner).where(Partner.id == partner_id)
    partner = (await db.execute(partner_q)).scalar_one_or_none()
    if not partner:
        return BitrixStatsResponse(
            success=False, clients=[], total_amount=0, total_clients=0, error="Партнёр не найден"
        )

    if not partner.workflow_id:
        return BitrixStatsResponse(
            success=False, clients=[], total_amount=0, total_clients=0,
            error="Bitrix24 не настроен. Перейдите в настройки Bitrix24.",
        )

    raw = await ext_fetch_bitrix_stats(partner.partner_code, workflow_id=partner.workflow_id)

    if "error" in raw and not raw.get("success", True):
        return BitrixStatsResponse(
            success=False, clients=[], total_amount=0, total_clients=0, error=raw.get("error")
        )

    clients = [
        BitrixClientResponse(
            name=c.get("name", ""),
            external_id=c.get("external_id", ""),
            status=c.get("status", ""),
            stage=c.get("stage", ""),
            deal_amount=c.get("deal_amount", 0),
            currency=c.get("currency", "RUB"),
            created_at=c.get("created_at", ""),
            assigned_by_name=c.get("assigned_by_name"),
            status_semantic_id=c.get("status_semantic_id"),
        )
        for c in raw.get("clients", [])
    ]

    return BitrixStatsResponse(
        success=True,
        clients=clients,
        total_amount=raw.get("total_amount", 0),
        total_clients=raw.get("total_clients", len(clients)),
        conversion=raw.get("conversion"),
    )
