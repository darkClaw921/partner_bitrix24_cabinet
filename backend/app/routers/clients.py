from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.partner import Partner
from app.schemas.client import ClientCreateRequest, ClientResponse
from app.services.client_service import create_client_manual, get_client, get_clients

router = APIRouter(prefix="/clients", tags=["Clients"])


def _enrich_response(client) -> dict:
    data = {
        "id": client.id,
        "partner_id": client.partner_id,
        "link_id": client.link_id,
        "source": client.source,
        "name": client.name,
        "phone": client.phone,
        "email": client.email,
        "company": client.company,
        "comment": client.comment,
        "external_id": client.external_id,
        "webhook_sent": client.webhook_sent,
        "deal_amount": client.deal_amount,
        "partner_reward": client.partner_reward,
        "is_paid": client.is_paid,
        "deal_status": client.deal_status,
        "deal_status_name": client.deal_status_name,
        "created_at": client.created_at,
        "link_title": client.link.title if client.link else None,
    }
    return data


@router.get("/", response_model=list[ClientResponse])
async def list_clients(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    clients = await get_clients(db, current_user.id, skip, limit)
    return [_enrich_response(c) for c in clients]


@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create(
    data: ClientCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    client = await create_client_manual(db, current_user.id, data)
    client_full = await get_client(db, current_user.id, client.id)
    return _enrich_response(client_full)


@router.get("/{client_id}", response_model=ClientResponse)
async def get_one(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    client = await get_client(db, current_user.id, client_id)
    return _enrich_response(client)
