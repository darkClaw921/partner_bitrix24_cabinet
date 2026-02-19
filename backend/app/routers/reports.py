from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_admin_user, get_current_user, get_db
from app.models.partner import Partner
from app.schemas.report import AllPartnersReportResponse, PartnerReportResponse
from app.services.pdf_service import generate_all_partners_report_pdf, generate_partner_report_pdf
from app.services.report_service import generate_all_partners_report, generate_partner_report

router = APIRouter(tags=["reports"])


# --- Partner endpoints ---

@router.get("/reports", response_model=PartnerReportResponse)
async def get_partner_report(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    report = await generate_partner_report(db, current_user.id, date_from, date_to)
    if not report:
        raise HTTPException(status_code=404, detail="Партнёр не найден")
    return report


@router.get("/reports/pdf")
async def get_partner_report_pdf(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    report = await generate_partner_report(db, current_user.id, date_from, date_to)
    if not report:
        raise HTTPException(status_code=404, detail="Партнёр не найден")

    pdf_bytes = generate_partner_report_pdf(report)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=report.pdf"},
    )


# --- Admin endpoints ---

@router.get("/admin/reports", response_model=AllPartnersReportResponse)
async def get_admin_report(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    partner_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    return await generate_all_partners_report(db, date_from, date_to, partner_id)


@router.get("/admin/reports/pdf")
async def get_admin_report_pdf(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    partner_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    if partner_id:
        # Single partner PDF
        report = await generate_partner_report(db, partner_id, date_from, date_to)
        if not report:
            raise HTTPException(status_code=404, detail="Партнёр не найден")
        pdf_bytes = generate_partner_report_pdf(report)
    else:
        # All partners PDF
        report = await generate_all_partners_report(db, date_from, date_to)
        pdf_bytes = generate_all_partners_report_pdf(report)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=report.pdf"},
    )
