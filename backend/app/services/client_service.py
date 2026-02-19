import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client
from app.models.link import PartnerLink
from app.models.partner import Partner
from app.schemas.client import ClientCreateRequest, PublicFormRequest
from app.services.external_api import send_client_webhook

logger = logging.getLogger(__name__)


async def _send_webhook_and_update(
    db: AsyncSession,
    client: Client,
    partner: Partner,
    link: PartnerLink | None,
) -> None:
    client_data = {
        "name": client.name,
        "phone": client.phone,
        "email": client.email,
        "company": client.company,
        "comment": client.comment,
    }
    response = await send_client_webhook(
        partner_code=partner.partner_code,
        source=client.source,
        link_code=link.link_code if link else None,
        client_data=client_data,
        workflow_id=partner.workflow_id,
    )
    if "error" not in response:
        client.webhook_sent = True
        # Save bitrix24 lead id
        bitrix_lead_id = response.get("bitrix24_lead_id") or response.get("id")
        if bitrix_lead_id:
            client.external_id = str(bitrix_lead_id)
    client.webhook_response = str(response)
    await db.commit()


async def create_client_manual(
    db: AsyncSession, partner_id: int, data: ClientCreateRequest
) -> Client:
    link = None
    if data.link_id is not None:
        result = await db.execute(
            select(PartnerLink).where(
                PartnerLink.id == data.link_id,
                PartnerLink.partner_id == partner_id,
            )
        )
        link = result.scalar_one_or_none()
        if link is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ссылка не найдена или не принадлежит вам",
            )

    client = Client(
        partner_id=partner_id,
        link_id=data.link_id,
        source="manual",
        name=data.name,
        phone=data.phone,
        email=data.email,
        company=data.company,
        comment=data.comment,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)

    partner = await db.get(Partner, partner_id)
    await _send_webhook_and_update(db, client, partner, link)
    await db.refresh(client)

    return client


async def create_client_from_form(
    db: AsyncSession, link: PartnerLink, data: PublicFormRequest
) -> Client:
    partner = await db.get(Partner, link.partner_id)

    client = Client(
        partner_id=link.partner_id,
        link_id=link.id,
        source="form",
        name=data.name,
        phone=data.phone,
        email=data.email,
        company=data.company,
        comment=data.comment,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)

    await _send_webhook_and_update(db, client, partner, link)
    await db.refresh(client)

    return client


async def get_clients(
    db: AsyncSession, partner_id: int, skip: int = 0, limit: int = 50
) -> list[Client]:
    result = await db.execute(
        select(Client)
        .options(selectinload(Client.link))
        .where(Client.partner_id == partner_id)
        .order_by(Client.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_client(
    db: AsyncSession, partner_id: int, client_id: int
) -> Client:
    result = await db.execute(
        select(Client)
        .options(selectinload(Client.link))
        .where(
            Client.id == client_id,
            Client.partner_id == partner_id,
        )
    )
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Клиент не найден",
        )
    return client
