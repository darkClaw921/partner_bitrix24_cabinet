from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.partner import Partner
from app.schemas.auth import (
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
