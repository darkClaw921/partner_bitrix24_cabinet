from fastapi import APIRouter, Depends, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.partner import Partner
from app.schemas.landing import (
    LandingCreateRequest,
    LandingImageResponse,
    LandingResponse,
    LandingUpdateRequest,
)
from app.services.landing_service import (
    create_landing,
    delete_image,
    delete_landing,
    get_landing,
    get_landings,
    update_landing,
    upload_image,
)

router = APIRouter(prefix="/landings", tags=["Landings"])


@router.get("/", response_model=list[LandingResponse])
async def list_landings(
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    landings = await get_landings(db, current_user.id)
    return [LandingResponse.from_model(l) for l in landings]


@router.post("/", response_model=LandingResponse, status_code=status.HTTP_201_CREATED)
async def create(
    data: LandingCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    landing = await create_landing(db, current_user.id, data)
    return LandingResponse.from_model(landing)


@router.get("/{landing_id}", response_model=LandingResponse)
async def get_one(
    landing_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    landing = await get_landing(db, current_user.id, landing_id)
    return LandingResponse.from_model(landing)


@router.put("/{landing_id}", response_model=LandingResponse)
async def update(
    landing_id: int,
    data: LandingUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    landing = await update_landing(db, current_user.id, landing_id, data)
    return LandingResponse.from_model(landing)


@router.delete("/{landing_id}")
async def delete(
    landing_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    await delete_landing(db, current_user.id, landing_id)
    return {"message": "Landing deactivated"}


@router.post(
    "/{landing_id}/images",
    response_model=LandingImageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_image(
    landing_id: int,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    image = await upload_image(db, current_user.id, landing_id, file)
    return LandingImageResponse.from_model(image)


@router.delete("/{landing_id}/images/{image_id}")
async def remove_image(
    landing_id: int,
    image_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    await delete_image(db, current_user.id, landing_id, image_id)
    return {"message": "Image deleted"}
