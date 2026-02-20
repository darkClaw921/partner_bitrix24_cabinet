from aiogram.filters.callback_data import CallbackData
from typing import Optional


class MenuCB(CallbackData, prefix="menu"):
    action: str


class PaginationCB(CallbackData, prefix="page"):
    section: str
    page: int


class LinkCB(CallbackData, prefix="link"):
    action: str
    id: int = 0


class ClientCB(CallbackData, prefix="client"):
    action: str
    id: int = 0


class PaymentCB(CallbackData, prefix="pay"):
    action: str
    id: int = 0


class ReportCB(CallbackData, prefix="report"):
    action: str
    period: str = ""


class ChatCB(CallbackData, prefix="chat"):
    action: str
    page: int = -1  # -1 = last page


class NotifCB(CallbackData, prefix="notif"):
    action: str
    id: int = 0


class ProfileCB(CallbackData, prefix="prof"):
    action: str
    id: int = 0


class ClientSelectCB(CallbackData, prefix="csel"):
    id: int
    selected: bool = False


class PayMethodCB(CallbackData, prefix="pmeth"):
    action: str
    index: int = 0


class ConfirmCB(CallbackData, prefix="confirm"):
    action: str
    value: str = ""
