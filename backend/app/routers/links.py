from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.partner import Partner
from app.schemas.link import (
    EmbedCodeResponse,
    LinkCreateRequest,
    LinkResponse,
    LinkUpdateRequest,
)
from app.services.link_service import (
    create_link,
    delete_link,
    get_embed_code,
    get_link_with_counts,
    get_links,
    update_link,
)

router = APIRouter(prefix="/links", tags=["Links"])


@router.get("/", response_model=list[LinkResponse])
async def list_links(
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    return await get_links(db, current_user.id)


@router.post("/", response_model=LinkResponse, status_code=status.HTTP_201_CREATED)
async def create(
    data: LinkCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    link = await create_link(db, current_user.id, data)
    return await get_link_with_counts(db, current_user.id, link.id)


@router.get("/{link_id}", response_model=LinkResponse)
async def get_one(
    link_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    return await get_link_with_counts(db, current_user.id, link_id)


@router.put("/{link_id}", response_model=LinkResponse)
async def update(
    link_id: int,
    data: LinkUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    await update_link(db, current_user.id, link_id, data)
    return await get_link_with_counts(db, current_user.id, link_id)


@router.delete("/{link_id}")
async def delete(
    link_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    await delete_link(db, current_user.id, link_id)
    return {"message": "Link deactivated"}


@router.get("/{link_id}/embed-code", response_model=EmbedCodeResponse)
async def embed_code(
    link_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    return await get_embed_code(db, current_user.id, link_id)
