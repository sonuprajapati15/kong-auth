import os
from datetime import datetime, timedelta, timezone
import jwt

JWT_EXP_SECONDS = int(os.getenv("JWT_EXP_SECONDS", "86400"))  # default 24 hours
JWT_AUD = os.getenv("JWT_AUD", "")  # optional; keep empty to omit


def create_access_token(user_id: str, role:str, secret: str) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "iss": user_id,  # REQUIRED: Kong maps iss -> jwt credential key
        "sub": user_id,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=JWT_EXP_SECONDS)).timestamp()),
    }
    if JWT_AUD:
        payload["aud"] = JWT_AUD

    return jwt.encode(payload, secret, algorithm="HS256")