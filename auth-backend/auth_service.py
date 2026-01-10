import base64
import re

from gevent.time import sleep

from kong_client import (
    create_consumer,
    delete_consumer,
    create_jwt_credential,
    delete_jwt_credential,
    create_api_key,
    KongError,
)
from token_service import create_access_token
from user_store import create_user, get_user, verify_password, update_user_id

EMAIL_RE = r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
PASSWORD_RE = r"^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$"


class ValidationError(ValueError):
    """Input validation errors (400)."""


class ConflictError(RuntimeError):
    """Resource conflict errors (409)."""


class NotFoundError(RuntimeError):
    """Not found errors (404)."""


class PersistenceError(RuntimeError):
    """Local persistence failed (500)."""


def _decode_password(b64_password: str) -> str:
    return base64.b64decode(b64_password).decode()


def _validate_email(email: str) -> None:
    if not re.match(EMAIL_RE, email or ""):
        raise ValidationError("Invalid email format")


def _validate_password(password: str) -> None:
    if not re.match(PASSWORD_RE, password or ""):
        raise ValidationError(
            "Password must be at least 8 characters long, contain letters, numbers, and a special symbol."
        )


def signup_user(email: str, password_b64: str, role: str = "user") -> dict:
    _validate_email(email)
    password = _decode_password(password_b64)
    _validate_password(password)

    if get_user(email):
        raise ConflictError("User already exists")
    try:
        create_user(
            email=email,
            role=role,
            password=password,
            kong_consumer_id=None,
            jwt_credential_id=None,
        )
    except Exception as e:
        raise PersistenceError(f"Failed to persist user: {e}") from e

    return {
        "userId": email,
        "note": "JWT secret is generated and stored by Kong; Auth Service stores only IDs.",
    }


def login_user(email: str, password_b64: str) -> dict:
    _validate_email(email)
    password = _decode_password(password_b64)
    _validate_password(password)

    user = get_user(email)
    if not user or not verify_password(user, password):
        # Keep message same as your original behavior
        raise ValidationError("Invalid credentials Or User Not Exist")
    try:
        try:
            delete_consumer(user.email)
            delete_jwt_credential(user.email, user.jwt_credential_id)
            sleep(1)
        except:
            print("No existing session to logout.")
        create_consumer(email)
        jwt_cred = create_jwt_credential(email)
        token = create_access_token(user_id=user.email, role=user.role, secret=jwt_cred['secret'])
        update_user_id(email, jwt_cred['consumer']['id'], jwt_cred['id'])
        return {"access_token": token, "token_type": "Bearer"}
    except KongError as e:
        raise e


def logout_user(email: str) -> dict:
    _validate_email(email)

    user = get_user(email)
    if not user:
        raise NotFoundError("User not found")

    # If these raise KongError, caller maps to 502
    delete_consumer(user.email)
    delete_jwt_credential(user.email, user.jwt_credential_id)

    return {"message": "Logout successful. Please delete your token on the client."}


def generate_apikey_for_user(user_id: str, usage_scope: str = "partner_api") -> dict:
    user = get_user(user_id)
    if not user:
        raise NotFoundError("User not found")

    try:
        cred = create_api_key(user_id)
    except KongError as e:
        raise

    return {
        "userId": user_id,
        "api_key": cred["key"],
        "consumer_id": cred["consumer"]["id"] if isinstance(cred.get("consumer"), dict) else user.kong_consumer_id,
        "usage_scope": usage_scope,
    }
