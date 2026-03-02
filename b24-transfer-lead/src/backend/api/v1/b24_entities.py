"""B24 CRM entity endpoints for contacts, companies, and deals."""
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.backend.api.v1.dependencies import get_current_user
from src.backend.core.database import get_main_db
from src.backend.models.user import User
from src.backend.models.workflow import Workflow
from src.backend.services.bitrix24 import Bitrix24Service

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Request/Response schemas ---


class ContactSearchResult(BaseModel):
    """Contact search result item."""

    id: int
    name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    email: str | None = None


class CompanySearchResult(BaseModel):
    """Company search result item."""

    id: int
    title: str | None = None
    phone: str | None = None
    email: str | None = None


class CreateContactRequest(BaseModel):
    """Request body for creating a contact."""

    name: str
    last_name: str | None = None
    phone: str | None = None
    email: str | None = None


class CreateContactResponse(BaseModel):
    """Response for created contact."""

    id: int
    name: str
    last_name: str | None = None


class CreateCompanyRequest(BaseModel):
    """Request body for creating a company."""

    title: str
    phone: str | None = None
    email: str | None = None


class CreateCompanyResponse(BaseModel):
    """Response for created company."""

    id: int
    title: str


class DealResult(BaseModel):
    """Deal result item."""

    id: int
    title: str | None = None
    stage_id: str | None = None
    opportunity: str | None = None
    currency: str | None = None
    date_create: str | None = None


# --- Helper ---


def _get_b24_service(workflow: Workflow) -> Bitrix24Service:
    """Create Bitrix24Service instance from workflow's webhook URL.

    Args:
        workflow: Workflow model instance

    Returns:
        Bitrix24Service configured with the workflow's webhook URL

    Raises:
        HTTPException: If workflow has no webhook URL configured
    """
    if not workflow.bitrix24_webhook_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Workflow has no Bitrix24 webhook URL configured",
        )
    return Bitrix24Service(workflow.bitrix24_webhook_url)


def _get_workflow(db: Session, workflow_id: int) -> Workflow:
    """Get workflow by ID or raise 404.

    Args:
        db: Database session
        workflow_id: Workflow ID

    Returns:
        Workflow model instance

    Raises:
        HTTPException: If workflow not found
    """
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )
    return workflow


def _extract_phone(phones: list[dict] | None) -> str | None:
    """Extract first phone value from B24 phone list.

    Args:
        phones: B24 PHONE field value (list of dicts with VALUE key)

    Returns:
        First phone value or None
    """
    if not phones:
        return None
    for phone in phones:
        if isinstance(phone, dict) and phone.get("VALUE"):
            return phone["VALUE"]
    return None


def _extract_email(emails: list[dict] | None) -> str | None:
    """Extract first email value from B24 email list.

    Args:
        emails: B24 EMAIL field value (list of dicts with VALUE key)

    Returns:
        First email value or None
    """
    if not emails:
        return None
    for email in emails:
        if isinstance(email, dict) and email.get("VALUE"):
            return email["VALUE"]
    return None


# --- Endpoints ---


@router.get(
    "/{workflow_id}/b24/contacts/search",
    response_model=list[ContactSearchResult],
)
async def search_contacts(
    workflow_id: int,
    query: str = Query(..., min_length=1, description="Search query for contact name"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_main_db),
):
    """Search contacts in Bitrix24 by name.

    Uses crm.contact.list with FULL_NAME filter using %QUERY% pattern.
    """
    workflow = _get_workflow(db, workflow_id)
    b24 = _get_b24_service(workflow)
    client = b24._get_client()

    try:
        result = await client.get_all(
            "crm.contact.list",
            {
                "filter": {"%FULL_NAME": query},
                "select": ["ID", "NAME", "LAST_NAME", "PHONE", "EMAIL"],
            },
        )
    except Exception as e:
        logger.error(f"Failed to search contacts: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Bitrix24 API error: {str(e)}",
        )

    contacts = []
    if isinstance(result, list):
        for item in result:
            contacts.append(
                ContactSearchResult(
                    id=int(item.get("ID", 0)),
                    name=item.get("NAME"),
                    last_name=item.get("LAST_NAME"),
                    phone=_extract_phone(item.get("PHONE")),
                    email=_extract_email(item.get("EMAIL")),
                )
            )

    logger.info(f"Contact search for '{query}' returned {len(contacts)} results")
    return contacts


@router.get(
    "/{workflow_id}/b24/companies/search",
    response_model=list[CompanySearchResult],
)
async def search_companies(
    workflow_id: int,
    query: str = Query(..., min_length=1, description="Search query for company title"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_main_db),
):
    """Search companies in Bitrix24 by title.

    Uses crm.company.list with TITLE filter using %QUERY% pattern.
    """
    workflow = _get_workflow(db, workflow_id)
    b24 = _get_b24_service(workflow)
    client = b24._get_client()

    try:
        result = await client.get_all(
            "crm.company.list",
            {
                "filter": {"%TITLE": query},
                "select": ["ID", "TITLE", "PHONE", "EMAIL"],
            },
        )
    except Exception as e:
        logger.error(f"Failed to search companies: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Bitrix24 API error: {str(e)}",
        )

    companies = []
    if isinstance(result, list):
        for item in result:
            companies.append(
                CompanySearchResult(
                    id=int(item.get("ID", 0)),
                    title=item.get("TITLE"),
                    phone=_extract_phone(item.get("PHONE")),
                    email=_extract_email(item.get("EMAIL")),
                )
            )

    logger.info(f"Company search for '{query}' returned {len(companies)} results")
    return companies


@router.post(
    "/{workflow_id}/b24/contacts",
    response_model=CreateContactResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_contact(
    workflow_id: int,
    request: CreateContactRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_main_db),
):
    """Create a contact in Bitrix24.

    Uses crm.contact.add with provided name, last_name, phone, email.
    """
    workflow = _get_workflow(db, workflow_id)
    b24 = _get_b24_service(workflow)
    client = b24._get_client()

    fields: dict[str, Any] = {
        "NAME": request.name,
    }
    if request.last_name:
        fields["LAST_NAME"] = request.last_name
    if request.phone:
        fields["PHONE"] = [{"VALUE": request.phone, "VALUE_TYPE": "WORK"}]
    if request.email:
        fields["EMAIL"] = [{"VALUE": request.email, "VALUE_TYPE": "WORK"}]

    try:
        result = await client.call("crm.contact.add", {"fields": fields})
        contact_id = int(result) if isinstance(result, (int, str)) else result.get("id", result)
    except Exception as e:
        logger.error(f"Failed to create contact: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Bitrix24 API error: {str(e)}",
        )

    logger.info(f"Created contact {contact_id} in B24 for workflow {workflow_id}")
    return CreateContactResponse(
        id=contact_id,
        name=request.name,
        last_name=request.last_name,
    )


@router.post(
    "/{workflow_id}/b24/companies",
    response_model=CreateCompanyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_company(
    workflow_id: int,
    request: CreateCompanyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_main_db),
):
    """Create a company in Bitrix24.

    Uses crm.company.add with provided title, phone, email.
    """
    workflow = _get_workflow(db, workflow_id)
    b24 = _get_b24_service(workflow)
    client = b24._get_client()

    fields: dict[str, Any] = {
        "TITLE": request.title,
    }
    if request.phone:
        fields["PHONE"] = [{"VALUE": request.phone, "VALUE_TYPE": "WORK"}]
    if request.email:
        fields["EMAIL"] = [{"VALUE": request.email, "VALUE_TYPE": "WORK"}]

    try:
        result = await client.call("crm.company.add", {"fields": fields})
        company_id = int(result) if isinstance(result, (int, str)) else result.get("id", result)
    except Exception as e:
        logger.error(f"Failed to create company: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Bitrix24 API error: {str(e)}",
        )

    logger.info(f"Created company {company_id} in B24 for workflow {workflow_id}")
    return CreateCompanyResponse(
        id=company_id,
        title=request.title,
    )


@router.get(
    "/{workflow_id}/b24/deals",
    response_model=list[DealResult],
)
async def get_deals(
    workflow_id: int,
    entity_type: str | None = Query(None, pattern="^(contact|company)$", description="Entity type: contact or company"),
    entity_id: int | None = Query(None, description="B24 entity ID"),
    field_id: str | None = Query(None, description="Optional UF field ID for filtering"),
    field_value: str | None = Query(None, description="Optional UF field value for filtering"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_main_db),
):
    """Get deals from Bitrix24 filtered by contact/company and/or UF field.

    At least one filter must be provided (entity or UF field).
    Uses crm.deal.list with CONTACT_ID/COMPANY_ID and/or UF field filter.
    """
    if not (entity_type and entity_id) and not (field_id and field_value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least entity_type+entity_id or field_id+field_value must be provided",
        )

    workflow = _get_workflow(db, workflow_id)
    b24 = _get_b24_service(workflow)
    client = b24._get_client()

    # Build filter
    deal_filter: dict[str, Any] = {}
    if entity_type and entity_id:
        if entity_type == "contact":
            deal_filter["CONTACT_ID"] = entity_id
        elif entity_type == "company":
            deal_filter["COMPANY_ID"] = entity_id

    # Add UF field filter
    if field_id and field_value:
        deal_filter[field_id] = field_value

    try:
        result = await client.get_all(
            "crm.deal.list",
            {
                "filter": deal_filter,
                "select": [
                    "ID",
                    "TITLE",
                    "STAGE_ID",
                    "OPPORTUNITY",
                    "CURRENCY_ID",
                    "DATE_CREATE",
                ],
            },
        )
    except Exception as e:
        logger.error(f"Failed to get deals: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Bitrix24 API error: {str(e)}",
        )

    deals = []
    if isinstance(result, list):
        for item in result:
            deals.append(
                DealResult(
                    id=int(item.get("ID", 0)),
                    title=item.get("TITLE"),
                    stage_id=item.get("STAGE_ID"),
                    opportunity=item.get("OPPORTUNITY"),
                    currency=item.get("CURRENCY_ID"),
                    date_create=item.get("DATE_CREATE"),
                )
            )

    logger.info(
        f"Deal search for {entity_type}:{entity_id} returned {len(deals)} results"
        + (f" (filtered by {field_id}={field_value})" if field_id else "")
    )
    return deals
