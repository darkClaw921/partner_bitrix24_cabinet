import json
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.notification import Notification
from app.models.partner import Partner
from app.models.payment_request import PaymentRequest
from app.schemas.payment_request import (
    PaymentRequestAdminAction,
    PaymentRequestCreate,
    PaymentRequestResponse,
)


def _parse_client_ids(raw: str) -> list[int]:
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []


async def _build_response(
    db: AsyncSession, pr: PaymentRequest, include_clients: bool = False
) -> PaymentRequestResponse:
    partner_result = await db.execute(
        select(Partner.name).where(Partner.id == pr.partner_id)
    )
    partner_name = partner_result.scalar_one_or_none()

    client_ids = _parse_client_ids(pr.client_ids)
    clients_summary: list[dict] = []

    if include_clients and client_ids:
        result = await db.execute(
            select(Client).where(Client.id.in_(client_ids))
        )
        clients = result.scalars().all()
        clients_summary = [
            {
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "phone": c.phone,
                "deal_amount": c.deal_amount,
                "partner_reward": c.partner_reward,
            }
            for c in clients
        ]

    return PaymentRequestResponse(
        id=pr.id,
        partner_id=pr.partner_id,
        partner_name=partner_name,
        status=pr.status,
        total_amount=pr.total_amount,
        client_ids=client_ids,
        clients_summary=clients_summary,
        comment=pr.comment,
        admin_comment=pr.admin_comment,
        created_at=pr.created_at,
        processed_at=pr.processed_at,
        processed_by=pr.processed_by,
    )


async def create_payment_request(
    db: AsyncSession, partner_id: int, data: PaymentRequestCreate
) -> PaymentRequestResponse:
    # Validate: clients belong to partner and have partner_reward
    result = await db.execute(
        select(Client).where(
            Client.id.in_(data.client_ids),
            Client.partner_id == partner_id,
        )
    )
    clients = result.scalars().all()
    found_ids = {c.id for c in clients}
    missing = set(data.client_ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Клиенты не найдены или не принадлежат вам: {sorted(missing)}",
        )

    for c in clients:
        if c.partner_reward is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Вознаграждение не рассчитано для клиента: {c.name} (ID {c.id})",
            )

    # Check no client is in another pending request
    existing_result = await db.execute(
        select(PaymentRequest).where(PaymentRequest.status == "pending")
    )
    existing_requests = existing_result.scalars().all()
    for er in existing_requests:
        er_ids = set(_parse_client_ids(er.client_ids))
        overlap = found_ids & er_ids
        if overlap:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Клиенты уже в другом запросе на выплату (ID запроса {er.id}): {sorted(overlap)}",
            )

    total_amount = sum(c.partner_reward for c in clients)

    pr = PaymentRequest(
        partner_id=partner_id,
        status="pending",
        total_amount=total_amount,
        client_ids=json.dumps(data.client_ids),
        comment=data.comment,
    )
    db.add(pr)
    await db.commit()
    await db.refresh(pr)

    return await _build_response(db, pr, include_clients=True)


async def get_pending_count(db: AsyncSession) -> int:
    count = (await db.execute(
        select(func.count(PaymentRequest.id)).where(PaymentRequest.status == "pending")
    )).scalar() or 0
    return count


async def get_partner_requests(
    db: AsyncSession, partner_id: int
) -> list[PaymentRequestResponse]:
    result = await db.execute(
        select(PaymentRequest)
        .where(PaymentRequest.partner_id == partner_id)
        .order_by(PaymentRequest.created_at.desc())
    )
    requests = result.scalars().all()
    return [await _build_response(db, pr) for pr in requests]


async def get_all_requests(
    db: AsyncSession, status_filter: str | None = None
) -> list[PaymentRequestResponse]:
    query = select(PaymentRequest).order_by(PaymentRequest.created_at.desc())
    if status_filter:
        query = query.where(PaymentRequest.status == status_filter)
    result = await db.execute(query)
    requests = result.scalars().all()
    return [await _build_response(db, pr) for pr in requests]


async def get_request_detail(
    db: AsyncSession, request_id: int
) -> PaymentRequestResponse:
    result = await db.execute(
        select(PaymentRequest).where(PaymentRequest.id == request_id)
    )
    pr = result.scalar_one_or_none()
    if not pr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запрос на выплату не найден",
        )
    return await _build_response(db, pr, include_clients=True)


async def process_request(
    db: AsyncSession,
    request_id: int,
    admin_id: int,
    action: PaymentRequestAdminAction,
) -> PaymentRequestResponse:
    result = await db.execute(
        select(PaymentRequest).where(PaymentRequest.id == request_id)
    )
    pr = result.scalar_one_or_none()
    if not pr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запрос на выплату не найден",
        )
    if pr.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Запрос уже обработан",
        )

    pr.status = action.status
    pr.processed_at = datetime.utcnow()
    pr.processed_by = admin_id
    pr.admin_comment = action.admin_comment

    # Mark clients as paid when approved
    if action.status == "approved":
        client_ids = _parse_client_ids(pr.client_ids)
        if client_ids:
            clients_result = await db.execute(
                select(Client).where(Client.id.in_(client_ids))
            )
            for client in clients_result.scalars().all():
                client.is_paid = True
                client.paid_at = datetime.utcnow()

    # Create targeted notification for the partner
    status_text = "одобрен" if action.status == "approved" else "отклонён"
    message = f"Ваш запрос на выплату #{pr.id} на сумму {pr.total_amount:.2f} {status_text}."
    if action.admin_comment:
        message += f" Комментарий: {action.admin_comment}"

    notification = Notification(
        title=f"Запрос на выплату {status_text}",
        message=message,
        created_by=admin_id,
        target_partner_id=pr.partner_id,
    )
    db.add(notification)

    await db.commit()
    await db.refresh(pr)
    return await _build_response(db, pr, include_clients=True)
