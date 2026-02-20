import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.partner import Partner
from app.schemas.auth import (
    AddPaymentMethodRequest,
    LoginRequest,
    PartnerResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.services.auth_service import login_partner, refresh_tokens, register_partner

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=PartnerResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    partner = await register_partner(db, data)
    return partner


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await login_partner(db, data)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await refresh_tokens(db, data.refresh_token)


@router.get("/me", response_model=PartnerResponse)
async def me(current_user: Partner = Depends(get_current_user)):
    return current_user


@router.post("/payment-methods", response_model=PartnerResponse)
async def add_payment_method(
    data: AddPaymentMethodRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    methods = current_user.saved_payment_methods
    new_method = {"id": uuid.uuid4().hex[:8], "label": data.label, "value": data.value}
    methods.append(new_method)
    current_user.saved_payment_methods = methods
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.delete("/payment-methods/{method_id}", response_model=PartnerResponse)
async def delete_payment_method(
    method_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    methods = current_user.saved_payment_methods
    updated = [m for m in methods if m.get("id") != method_id]
    if len(updated) == len(methods):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Способ оплаты не найден")
    current_user.saved_payment_methods = updated
    await db.commit()
    await db.refresh(current_user)
    return current_user
