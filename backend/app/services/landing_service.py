import os
import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.landing import LandingImage, LandingPage
from app.schemas.landing import LandingCreateRequest, LandingUpdateRequest

ALLOWED_EXTENSIONS = {"jpeg", "jpg", "png", "webp", "gif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


async def create_landing(
    db: AsyncSession, partner_id: int, data: LandingCreateRequest
) -> LandingPage:
    landing = LandingPage(
        partner_id=partner_id,
        title=data.title,
        description=data.description,
        header_text=data.header_text,
        button_text=data.button_text,
        theme_color=data.theme_color,
    )
    db.add(landing)
    await db.commit()
    await db.refresh(landing)
    return landing


async def get_landings(db: AsyncSession, partner_id: int) -> list[LandingPage]:
    result = await db.execute(
        select(LandingPage)
        .where(LandingPage.partner_id == partner_id)
        .order_by(LandingPage.created_at.desc())
    )
    return list(result.scalars().all())


async def get_landing(
    db: AsyncSession, partner_id: int, landing_id: int
) -> LandingPage:
    result = await db.execute(
        select(LandingPage).where(
            LandingPage.id == landing_id,
            LandingPage.partner_id == partner_id,
        )
    )
    landing = result.scalar_one_or_none()
    if landing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Лендинг не найден",
        )
    return landing


async def update_landing(
    db: AsyncSession, partner_id: int, landing_id: int, data: LandingUpdateRequest
) -> LandingPage:
    landing = await get_landing(db, partner_id, landing_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(landing, field, value)

    await db.commit()
    await db.refresh(landing)
    return landing


async def delete_landing(
    db: AsyncSession, partner_id: int, landing_id: int
) -> None:
    landing = await get_landing(db, partner_id, landing_id)
    landing.is_active = False
    await db.commit()


async def upload_image(
    db: AsyncSession, partner_id: int, landing_id: int, file: UploadFile
) -> LandingImage:
    landing = await get_landing(db, partner_id, landing_id)

    # Validate file type
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя файла не указано",
        )
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Допустимые форматы: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Validate file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Максимальный размер файла: 5MB",
        )

    # Save file
    settings = get_settings()
    relative_path = f"{landing.id}/{uuid.uuid4().hex}.{ext}"
    full_path = os.path.join(settings.UPLOAD_DIR, relative_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    with open(full_path, "wb") as f:
        f.write(content)

    # Get next sort_order
    max_order = await db.scalar(
        select(func.max(LandingImage.sort_order)).where(
            LandingImage.landing_id == landing.id
        )
    )
    next_order = (max_order or 0) + 1

    image = LandingImage(
        landing_id=landing.id,
        file_path=relative_path,
        sort_order=next_order,
    )
    db.add(image)
    await db.commit()
    await db.refresh(image)
    return image


async def delete_image(
    db: AsyncSession, partner_id: int, landing_id: int, image_id: int
) -> None:
    landing = await get_landing(db, partner_id, landing_id)

    result = await db.execute(
        select(LandingImage).where(
            LandingImage.id == image_id,
            LandingImage.landing_id == landing.id,
        )
    )
    image = result.scalar_one_or_none()
    if image is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Изображение не найдено",
        )

    # Delete file from disk
    settings = get_settings()
    full_path = os.path.join(settings.UPLOAD_DIR, image.file_path)
    if os.path.exists(full_path):
        os.remove(full_path)

    await db.delete(image)
    await db.commit()
