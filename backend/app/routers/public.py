import logging
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from jinja2 import Environment, FileSystemLoader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.dependencies import get_db
from app.models.click import LinkClick
from app.models.client import Client
from app.models.landing import LandingPage
from app.models.link import PartnerLink
from app.models.notification import Notification
from app.models.partner import Partner
from app.schemas.client import PublicFormRequest
from app.services.client_service import create_client_from_form
from app.services.link_service import _build_url_with_utm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["Public"])

_jinja_env = Environment(
    loader=FileSystemLoader(
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "landing_template")
    ),
    autoescape=True,
)


async def _find_active_link(db: AsyncSession, link_code: str) -> PartnerLink:
    result = await db.execute(
        select(PartnerLink).where(
            PartnerLink.link_code == link_code,
            PartnerLink.is_active == True,  # noqa: E712
        )
    )
    link = result.scalar_one_or_none()
    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ссылка не найдена или деактивирована",
        )
    return link


async def _record_click(
    db: AsyncSession,
    link_id: int,
    request: Request,
) -> None:
    click = LinkClick(
        link_id=link_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", ""),
        referer=request.headers.get("referer"),
    )
    db.add(click)
    await db.commit()


@router.get("/r/{link_code}")
async def redirect_link(
    link_code: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    link = await _find_active_link(db, link_code)
    await _record_click(db, link.id, request)

    if link.link_type == "direct":
        target = _build_url_with_utm(link.target_url, link)
        return RedirectResponse(url=target, status_code=302)

    if link.link_type == "landing":
        return RedirectResponse(
            url=f"/api/public/landing/{link.link_code}", status_code=302
        )

    # iframe type — return minimal HTML with CRM form
    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Партнёрская форма</title>
    <style>
        body {{ font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }}
        .form-container {{ background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 480px; width: 100%; }}
        h2 {{ margin-bottom: 24px; color: #202124; }}
        .field {{ margin-bottom: 16px; }}
        label {{ display: block; margin-bottom: 4px; font-size: 14px; color: #5f6368; }}
        input, textarea {{ width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 6px; font-size: 16px; font-family: inherit; }}
        button {{ width: 100%; padding: 12px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; }}
        button:hover {{ background: #1557b0; }}
        .msg {{ text-align: center; padding: 10px; border-radius: 6px; margin-top: 12px; display: none; font-size: 14px; }}
        .msg.success {{ background: #e6f4ea; color: #1e8e3e; }}
        .msg.error {{ background: #fce8e6; color: #d93025; }}
    </style>
</head>
<body>
    <div class="form-container">
        <h2>Оставить заявку</h2>
        <form id="f">
            <div class="field"><label>Имя *</label><input name="name" required></div>
            <div class="field"><label>Телефон</label><input name="phone" type="tel"></div>
            <div class="field"><label>Email</label><input name="email" type="email"></div>
            <div class="field"><label>Компания</label><input name="company"></div>
            <div class="field"><label>Комментарий</label><textarea name="comment"></textarea></div>
            <button type="submit">Отправить</button>
            <div id="msg" class="msg"></div>
        </form>
    </div>
    <script>
        document.getElementById('f').addEventListener('submit',function(e){{
            e.preventDefault();
            var fd=new FormData(this);
            var d={{}};fd.forEach(function(v,k){{d[k]=v}});
            if(!d.name)return;
            if(!d.phone&&!d.email){{show('Укажите телефон или email','error');return;}}
            fetch('/api/public/form/{link.link_code}',{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify(d)}})
            .then(function(r){{if(!r.ok)throw 0;return r.json()}})
            .then(function(){{show('Заявка отправлена!','success');document.getElementById('f').reset()}})
            .catch(function(){{show('Ошибка отправки','error')}});
        }});
        function show(t,c){{var m=document.getElementById('msg');m.textContent=t;m.className='msg '+c;m.style.display='block';setTimeout(function(){{m.style.display='none'}},5000);}}
    </script>
</body>
</html>"""
    return HTMLResponse(content=html)


@router.get("/landing/{link_code}")
async def landing_page(
    link_code: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    link = await _find_active_link(db, link_code)
    await _record_click(db, link.id, request)

    if link.link_type == "landing" and link.landing_id:
        result = await db.execute(
            select(LandingPage)
            .options(selectinload(LandingPage.images))
            .where(
                LandingPage.id == link.landing_id,
                LandingPage.is_active == True,  # noqa: E712
            )
        )
        landing = result.scalar_one_or_none()
        if landing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Лендинг не найден или деактивирован",
            )

        template = _jinja_env.get_template("index.html")
        html = template.render(
            landing=landing,
            images=sorted(landing.images, key=lambda img: img.sort_order),
            link_code=link.link_code,
        )
        return HTMLResponse(content=html)

    # iframe or other type — render minimal CRM form
    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Форма заявки</title>
    <style>
        body {{ font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; margin: 0; }}
        .fc {{ background: #fff; padding: 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 480px; width: 100%; }}
        h2 {{ margin-bottom: 20px; }}
        .f {{ margin-bottom: 14px; }}
        label {{ display: block; margin-bottom: 4px; font-size: 14px; color: #5f6368; }}
        input, textarea {{ width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 6px; font-size: 16px; font-family: inherit; }}
        button {{ width: 100%; padding: 12px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; }}
    </style>
</head>
<body>
    <div class="fc">
        <h2>Оставить заявку</h2>
        <form action="/api/public/form/{link.link_code}" method="POST">
            <div class="f"><label>Имя *</label><input name="name" required></div>
            <div class="f"><label>Телефон</label><input name="phone" type="tel"></div>
            <div class="f"><label>Email</label><input name="email" type="email"></div>
            <div class="f"><label>Компания</label><input name="company"></div>
            <div class="f"><label>Комментарий</label><textarea name="comment"></textarea></div>
            <button type="submit">Отправить</button>
        </form>
    </div>
</body>
</html>"""
    return HTMLResponse(content=html)


@router.post("/form/{link_code}")
async def form_submit(
    link_code: str,
    data: PublicFormRequest,
    db: AsyncSession = Depends(get_db),
):
    link = await _find_active_link(db, link_code)
    await create_client_from_form(db, link, data)
    return {"success": True, "message": "Заявка принята"}


@router.get("/uploads/{file_path:path}")
async def serve_upload(file_path: str):
    settings = get_settings()
    full_path = os.path.join(settings.UPLOAD_DIR, file_path)
    if not os.path.isfile(full_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден",
        )
    return FileResponse(full_path)


@router.post("/webhook/b24")
async def proxy_b24_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Proxy webhook requests from Bitrix24 to b24-transfer-lead service."""
    settings = get_settings()
    body = await request.body()
    content_type = request.headers.get("content-type", "")

    target_url = f"{settings.B24_SERVICE_URL}/api/v1/webhook"

    async with httpx.AsyncClient(timeout=120.0) as http_client:
        try:
            resp = await http_client.post(
                target_url,
                content=body,
                headers={"content-type": content_type},
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Не удалось связаться с b24-transfer-lead",
            )

    # Process extended response from b24-transfer-lead
    try:
        resp_data = resp.json()
        lead_update = resp_data.get("lead_update")
        if lead_update:
            bitrix24_lead_id = lead_update.get("bitrix24_lead_id")
            deal_status = lead_update.get("status")
            deal_status_name = lead_update.get("status_name")
            became_successful = lead_update.get("became_successful", False)

            if bitrix24_lead_id:
                # Find client by external_id
                result = await db.execute(
                    select(Client).where(Client.external_id == str(bitrix24_lead_id))
                )
                client_obj = result.scalar_one_or_none()

                if client_obj:
                    client_obj.deal_status = deal_status
                    client_obj.deal_status_name = deal_status_name

                    # Always update deal_amount when opportunity > 0
                    opportunity_raw = lead_update.get("opportunity")
                    deal_amount = None
                    if opportunity_raw is not None:
                        try:
                            deal_amount = float(opportunity_raw)
                        except (ValueError, TypeError):
                            logger.warning(f"Failed to parse opportunity: {opportunity_raw}")

                    if deal_amount is not None and deal_amount > 0:
                        client_obj.deal_amount = deal_amount

                    # Always auto-calculate partner_reward when deal_amount > 0
                    partner_reward = None
                    if client_obj.deal_amount and client_obj.deal_amount > 0:
                        partner_result = await db.execute(
                            select(Partner).where(Partner.id == client_obj.partner_id)
                        )
                        partner_obj = partner_result.scalar_one_or_none()
                        if partner_obj:
                            settings = get_settings()
                            pct = partner_obj.reward_percentage if partner_obj.reward_percentage is not None else settings.DEFAULT_REWARD_PERCENTAGE
                            partner_reward = round(client_obj.deal_amount * pct / 100, 2)
                            client_obj.partner_reward = partner_reward

                    # Send notification only once when deal becomes successful
                    if became_successful:
                        admin_result = await db.execute(
                            select(Partner).where(Partner.role == "admin").limit(1)
                        )
                        admin = admin_result.scalar_one_or_none()
                        if admin:
                            msg_parts = [f"Сделка по клиенту {client_obj.name} успешно закрыта!"]
                            if client_obj.deal_amount and client_obj.deal_amount > 0:
                                msg_parts.append(f"Сумма сделки: {client_obj.deal_amount:,.2f} руб.")
                            if partner_reward is not None and partner_reward > 0:
                                msg_parts.append(f"Ваше вознаграждение: {partner_reward:,.2f} руб.")
                            msg_parts.append("Вы можете запросить выплату.")

                            notification = Notification(
                                title="Сделка успешно закрыта",
                                message=" ".join(msg_parts),
                                created_by=admin.id,
                                target_partner_id=client_obj.partner_id,
                            )
                            db.add(notification)

                    await db.commit()
                    logger.info(f"Updated client {client_obj.id} deal_status={deal_status}, deal_amount={client_obj.deal_amount}, partner_reward={client_obj.partner_reward}, became_successful={became_successful}")
    except Exception as e:
        logger.warning(f"Failed to process webhook response for client update: {e}")

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )
