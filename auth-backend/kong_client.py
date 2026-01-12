import os
import random

import requests
from typing import Any, Dict, Optional

KONG_ADMIN_URL = os.getenv("KONG_ADMIN_URL", "http://localhost:8001")


class KongError(RuntimeError):
    pass


def _raise_for_status(r: requests.Response) -> None:
    try:
        r.raise_for_status()
    except requests.HTTPError as e:
        raise KongError(f"Kong Admin API error: {r.status_code} {r.text}") from e


def create_consumer(user_id: str) -> Dict[str, Any]:
    """
    Creates a Kong consumer with username=user_id.
    """
    r = requests.post(
        f"{KONG_ADMIN_URL}/consumers",
        json={"username": user_id},
        timeout=5,
    )
    _raise_for_status(r)
    return r.json()


def create_jwt_credential(user_id: str) -> Dict[str, Any]:
    """
    Creates JWT credential for a consumer.
    key=user_id so Kong can map JWT 'iss' to this credential.
    Kong generates the secret server-side.
    """
    r = requests.post(
        f"{KONG_ADMIN_URL}/consumers/{user_id}/jwt",
        json={"key": user_id, "algorithm": "HS256"},
        timeout=5,
    )
    _raise_for_status(r)
    # NOTE: Kong returns secret in this response (typically only time you see it).
    return r.json()


def get_jwt_credential(credential_id: str) -> Dict[str, Any]:
    """
    Fetches the JWT credential by id. Depending on Kong config/version,
    secret may be returned. Treat Kong as SoT for secrets regardless.
    """
    r = requests.get(
        f"{KONG_ADMIN_URL}/jwt-secrets/{credential_id}",
        timeout=5,
    )
    _raise_for_status(r)
    return r.json()


def get_jwt_secret(credential_id: str) -> str:
    cred = get_jwt_credential(credential_id)
    secret = cred.get("secret")
    if not secret:
        # Some deployments restrict secret visibility.
        # In that case, you must store the secret at creation time in your DB/vault.
        raise KongError(
            "JWT secret not returned by Kong. Store it at creation time or "
            "enable secret retrieval for Auth Service."
        )
    return secret


def create_api_key(user_id: str, key: Optional[str] = None) -> Dict[str, Any]:
    """
    Creates a Key-Auth credential (API key) for a consumer.
    If `key` is None, Kong generates one.
    """
    payload = {}
    payload["key"] = "".join(random.choices("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", k=32))

    r = requests.post(
        f"{KONG_ADMIN_URL}/consumers/{user_id}/key-auth",
        json=payload,
        timeout=5,
    )
    _raise_for_status(r)
    return r.json()


def delete_consumer(userId: str):
    return requests.delete(
        f"{KONG_ADMIN_URL}/consumers/{userId}",
        timeout=20,
    ).raise_for_status()


def delete_jwt_credential(userId: str, jwt_credential_id: str):
    return requests.delete(
        f"{KONG_ADMIN_URL}/consumers/{userId}/jwt/{jwt_credential_id}",
        timeout=20,
    ).raise_for_status()
