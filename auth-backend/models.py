from dataclasses import dataclass
from typing import Optional


@dataclass
class User:
    user_id: str
    password_hash: str
    kong_consumer_id: str
    jwt_credential_id: str


@dataclass
class ApiKey:
    key: str
    consumer_id: str
    usage_scope: str  # e.g. "partner_api", "internal_reports"