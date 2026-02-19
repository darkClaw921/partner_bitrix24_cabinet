from pydantic import BaseModel


class SummaryResponse(BaseModel):
    total_clicks: int
    total_clients: int
    conversion_rate: float
    clicks_today: int
    clients_today: int


class LinkStatsResponse(BaseModel):
    link_id: int
    title: str
    link_type: str
    link_code: str
    clicks_count: int
    clients_count: int
    conversion_rate: float


class DailyClicksResponse(BaseModel):
    date: str
    clicks: int


class ClientStatsResponse(BaseModel):
    date: str
    form_count: int
    manual_count: int
    total: int


class BitrixClientResponse(BaseModel):
    name: str
    external_id: str
    status: str
    stage: str
    deal_amount: float
    currency: str
    created_at: str
    assigned_by_name: str | None = None
    status_semantic_id: str | None = None


class BitrixStatsResponse(BaseModel):
    success: bool
    clients: list[BitrixClientResponse]
    total_amount: float
    total_clients: int
    error: str | None = None
    conversion: dict | None = None
