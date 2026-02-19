from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_admin_user, get_current_user, get_db
from app.models.partner import Partner
from app.schemas.payment_request import (
    PaymentRequestAdminAction,
    PaymentRequestCreate,
    PaymentRequestResponse,
    PendingCountResponse,
)
from app.services.payment_request_service import (
    create_payment_request,
    get_all_requests,
    get_partner_requests,
    get_pending_count,
    get_request_detail,
    process_request,
)

router = APIRouter(tags=["Payment Requests"])


# Partner endpoints
@router.post("/payment-requests/", response_model=PaymentRequestResponse, status_code=201)
async def create_request(
    data: PaymentRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    return await create_payment_request(db, current_user.id, data)


@router.get("/payment-requests/", response_model=list[PaymentRequestResponse])
async def list_partner_requests(
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    return await get_partner_requests(db, current_user.id)


@router.get("/payment-requests/{request_id}", response_model=PaymentRequestResponse)
async def get_partner_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    detail = await get_request_detail(db, request_id)
    if detail.partner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа")
    return detail


# Admin endpoints
@router.get("/admin/payment-requests/pending-count", response_model=PendingCountResponse)
async def pending_count(
    db: AsyncSession = Depends(get_db),
    admin: Partner = Depends(get_admin_user),
):
    count = await get_pending_count(db)
    return PendingCountResponse(count=count)


@router.get("/admin/payment-requests", response_model=list[PaymentRequestResponse])
async def list_all_requests(
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    admin: Partner = Depends(get_admin_user),
):
    return await get_all_requests(db, status_filter)


@router.get("/admin/payment-requests/{request_id}", response_model=PaymentRequestResponse)
async def get_admin_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Partner = Depends(get_admin_user),
):
    return await get_request_detail(db, request_id)


@router.put("/admin/payment-requests/{request_id}", response_model=PaymentRequestResponse)
async def process_admin_request(
    request_id: int,
    action: PaymentRequestAdminAction,
    db: AsyncSession = Depends(get_db),
    admin: Partner = Depends(get_admin_user),
):
    return await process_request(db, request_id, admin.id, action)
