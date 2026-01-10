import os
from typing import Dict, Optional
from werkzeug.security import generate_password_hash, check_password_hash
from models import User

# Minimal store for demo; replace with real DB (Postgres, etc).
_USERS: Dict[str, User] = {}


def create_user(
    user_id: str,
    password: str,
    kong_consumer_id: str,
    jwt_credential_id: str,
) -> User:
    if user_id in _USERS:
        raise ValueError("User already exists")

    u = User(
        user_id=user_id,
        password_hash=generate_password_hash(password),
        kong_consumer_id=kong_consumer_id,
        jwt_credential_id=jwt_credential_id,
    )
    _USERS[user_id] = u
    return u


def get_user(user_id: str) -> Optional[User]:
    return _USERS.get(user_id)


def verify_password(user: User, password: str) -> bool:
    return check_password_hash(user.password_hash, password)