import uuid
from urllib.parse import urlencode, urlparse, urlunparse, parse_qs

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.click import LinkClick
from app.models.client import Client
from app.models.landing import LandingPage
from app.models.link import PartnerLink
from app.schemas.link import EmbedCodeResponse, LinkCreateRequest, LinkUpdateRequest


def _build_url_with_utm(base_url: str, link: PartnerLink) -> str:
    params = {}
    if link.utm_source:
        params["utm_source"] = link.utm_source
    if link.utm_medium:
        params["utm_medium"] = link.utm_medium
    if link.utm_campaign:
        params["utm_campaign"] = link.utm_campaign
    if link.utm_content:
        params["utm_content"] = link.utm_content
    if link.utm_term:
        params["utm_term"] = link.utm_term
    if not params:
        return base_url
    parsed = urlparse(base_url)
    existing = parse_qs(parsed.query)
    existing.update({k: [v] for k, v in params.items()})
    new_query = urlencode({k: v[0] for k, v in existing.items()})
    return urlunparse(parsed._replace(query=new_query))


async def create_link(
    db: AsyncSession, partner_id: int, data: LinkCreateRequest
) -> PartnerLink:
    if data.link_type == "landing":
        result = await db.execute(
            select(LandingPage).where(
                LandingPage.id == data.landing_id,
                LandingPage.partner_id == partner_id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Лендинг не найден или не принадлежит вам",
            )

    link_code = uuid.uuid4().hex[:10]
    while True:
        exists = await db.execute(
            select(PartnerLink).where(PartnerLink.link_code == link_code)
        )
        if exists.scalar_one_or_none() is None:
            break
        link_code = uuid.uuid4().hex[:10]

    link = PartnerLink(
        partner_id=partner_id,
        title=data.title,
        link_type=data.link_type,
        link_code=link_code,
        target_url=str(data.target_url) if data.target_url else None,
        landing_id=data.landing_id,
        utm_source=data.utm_source,
        utm_medium=data.utm_medium,
        utm_campaign=data.utm_campaign,
        utm_content=data.utm_content,
        utm_term=data.utm_term,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return link


async def get_links(db: AsyncSession, partner_id: int) -> list[dict]:
    result = await db.execute(
        select(PartnerLink)
        .where(PartnerLink.partner_id == partner_id)
        .order_by(PartnerLink.created_at.desc())
    )
    links = result.scalars().all()

    enriched = []
    for link in links:
        clicks_count = await db.scalar(
            select(func.count(LinkClick.id)).where(LinkClick.link_id == link.id)
        )
        clients_count = await db.scalar(
            select(func.count(Client.id)).where(Client.link_id == link.id)
        )
        enriched.append(
            {
                "id": link.id,
                "partner_id": link.partner_id,
                "title": link.title,
                "link_type": link.link_type,
                "link_code": link.link_code,
                "target_url": link.target_url,
                "landing_id": link.landing_id,
                "is_active": link.is_active,
                "created_at": link.created_at,
                "clicks_count": clicks_count or 0,
                "clients_count": clients_count or 0,
                "utm_source": link.utm_source,
                "utm_medium": link.utm_medium,
                "utm_campaign": link.utm_campaign,
                "utm_content": link.utm_content,
                "utm_term": link.utm_term,
            }
        )
    return enriched


async def get_link(db: AsyncSession, partner_id: int, link_id: int) -> PartnerLink:
    result = await db.execute(
        select(PartnerLink).where(
            PartnerLink.id == link_id,
            PartnerLink.partner_id == partner_id,
        )
    )
    link = result.scalar_one_or_none()
    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ссылка не найдена",
        )
    return link


async def get_link_with_counts(
    db: AsyncSession, partner_id: int, link_id: int
) -> dict:
    link = await get_link(db, partner_id, link_id)
    clicks_count = await db.scalar(
        select(func.count(LinkClick.id)).where(LinkClick.link_id == link.id)
    )
    clients_count = await db.scalar(
        select(func.count(Client.id)).where(Client.link_id == link.id)
    )
    return {
        "id": link.id,
        "partner_id": link.partner_id,
        "title": link.title,
        "link_type": link.link_type,
        "link_code": link.link_code,
        "target_url": link.target_url,
        "landing_id": link.landing_id,
        "is_active": link.is_active,
        "created_at": link.created_at,
        "clicks_count": clicks_count or 0,
        "clients_count": clients_count or 0,
        "utm_source": link.utm_source,
        "utm_medium": link.utm_medium,
        "utm_campaign": link.utm_campaign,
        "utm_content": link.utm_content,
        "utm_term": link.utm_term,
    }


async def update_link(
    db: AsyncSession, partner_id: int, link_id: int, data: LinkUpdateRequest
) -> PartnerLink:
    link = await get_link(db, partner_id, link_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(link, field, value)

    await db.commit()
    await db.refresh(link)
    return link


async def delete_link(db: AsyncSession, partner_id: int, link_id: int) -> None:
    link = await get_link(db, partner_id, link_id)
    link.is_active = False
    await db.commit()


async def get_embed_code(
    db: AsyncSession, partner_id: int, link_id: int
) -> EmbedCodeResponse:
    link = await get_link(db, partner_id, link_id)

    direct_url = f"/api/public/r/{link.link_code}"
    redirect_url_with_utm = _build_url_with_utm(direct_url, link)

    iframe_code = None
    landing_url = None

    if link.link_type == "iframe":
        iframe_code = (
            f'<iframe src="/api/public/landing/{link.link_code}" '
            f'width="100%" height="600" frameborder="0"></iframe>'
        )
    elif link.link_type == "landing":
        landing_url = f"/api/public/landing/{link.link_code}"

    return EmbedCodeResponse(
        link_type=link.link_type,
        link_code=link.link_code,
        direct_url=direct_url,
        redirect_url_with_utm=redirect_url_with_utm if redirect_url_with_utm != direct_url else None,
        iframe_code=iframe_code,
        landing_url=landing_url,
    )
