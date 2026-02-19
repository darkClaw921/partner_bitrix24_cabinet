from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.partner import Partner
from app.schemas.analytics import (
    BitrixStatsResponse,
    ClientStatsResponse,
    DailyClicksResponse,
    LinkStatsResponse,
    SummaryResponse,
)
from app.services.analytics_service import (
    get_bitrix_stats,
    get_clients_stats_by_day,
    get_link_clicks_by_day,
    get_links_stats,
    get_summary,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary", response_model=SummaryResponse)
async def summary(
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    return await get_summary(db, current_user.id)


@router.get("/links", response_model=list[LinkStatsResponse])
async def links_stats(
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    return await get_links_stats(db, current_user.id)


@router.get("/links/{link_id}/clicks", response_model=list[DailyClicksResponse])
async def link_clicks(
    link_id: int,
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    return await get_link_clicks_by_day(db, current_user.id, link_id, days)


@router.get("/clients/stats", response_model=list[ClientStatsResponse])
async def clients_stats(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    return await get_clients_stats_by_day(db, current_user.id, days)


@router.post("/bitrix/fetch", response_model=BitrixStatsResponse)
async def bitrix_fetch(
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    return await get_bitrix_stats(db, current_user.id)
