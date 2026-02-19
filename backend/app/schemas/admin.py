from datetime import datetime

from pydantic import BaseModel


class ClientPaymentUpdateRequest(BaseModel):
    deal_amount: float | None = None
    partner_reward: float | None = None
    is_paid: bool | None = None
    payment_comment: str | None = None


class BulkClientPaymentUpdateRequest(BaseModel):
    client_ids: list[int]
    deal_amount: float | None = None
    partner_reward: float | None = None
    is_paid: bool | None = None
    payment_comment: str | None = None


class PartnerPaymentSummaryResponse(BaseModel):
    partner_id: int
    partner_name: str
    total_deal_amount: float = 0
    total_reward: float = 0
    paid_amount: float = 0
    unpaid_amount: float = 0
    clients: list[dict] = []


class PartnerStatsResponse(BaseModel):
    id: int
    email: str
    name: str
    company: str | None
    partner_code: str
    created_at: datetime
    is_active: bool
    links_count: int = 0
    clicks_count: int = 0
    clients_count: int = 0
    landings_count: int = 0
    paid_amount: float = 0
    unpaid_amount: float = 0
    reward_percentage: float | None = None

    model_config = {"from_attributes": True}


class AdminOverviewResponse(BaseModel):
    total_partners: int = 0
    total_links: int = 0
    total_clicks: int = 0
    total_clients: int = 0
    total_landings: int = 0
    total_paid_amount: float = 0
    total_unpaid_amount: float = 0
    partners: list[PartnerStatsResponse] = []


class AdminPartnerDetailResponse(BaseModel):
    id: int
    email: str
    name: str
    company: str | None
    partner_code: str
    role: str
    created_at: datetime
    is_active: bool
    workflow_id: int | None
    reward_percentage: float | None = None
    effective_reward_percentage: float = 0
    links_count: int = 0
    clicks_count: int = 0
    clients_count: int = 0
    landings_count: int = 0
    links: list[dict] = []
    clients: list[dict] = []

    model_config = {"from_attributes": True}


class AdminConfigResponse(BaseModel):
    b24_service_frontend_url: str
    default_reward_percentage: float


class PartnerRewardPercentageUpdateRequest(BaseModel):
    reward_percentage: float | None = None


class GlobalRewardPercentageResponse(BaseModel):
    default_reward_percentage: float


class GlobalRewardPercentageUpdateRequest(BaseModel):
    default_reward_percentage: float
