import os
from flask import Flask, request, jsonify

from kong_client import (
    create_consumer,
    create_jwt_credential,
    get_jwt_secret,
    create_api_key,
    KongError,
)
from token_service import create_access_token
from user_store import create_user, get_user, verify_password

app = Flask(__name__)


def _json(required_fields):
    data = request.get_json(silent=True) or {}
    missing = [f for f in required_fields if f not in data or data[f] in (None, "")]
    if missing:
        return None, jsonify({"error": f"Missing fields: {missing}"}), 400
    return data, None, None


@app.post("/auth/signup")
def signup():
    """
    Public endpoint.
    - Creates Kong consumer
    - Creates Kong JWT credential (secret generated & stored by Kong)
    - Stores mapping user <-> kong consumer id <-> jwt credential id
    """
    data, err, code = _json(["userId", "password"])
    if err:
        return err, code

    user_id = data["userId"]
    password = data["password"]

    if get_user(user_id):
        return jsonify({"error": "User already exists"}), 409

    try:
        consumer = create_consumer(user_id)
        jwt_cred = create_jwt_credential(user_id)
    except KongError as e:
        return jsonify({"error": str(e)}), 502

    try:
        create_user(
            user_id=user_id,
            password=password,
            kong_consumer_id=consumer["id"],
            jwt_credential_id=jwt_cred["id"],
        )
    except Exception as e:
        # In real system: consider compensating action (delete consumer/cred) or mark as pending.
        return jsonify({"error": f"Failed to persist user: {e}"}), 500

    return jsonify(
        {
            "userId": user_id,
            "kongConsumerId": consumer["id"],
            "jwtCredentialId": jwt_cred["id"],
            "note": "JWT secret is generated and stored by Kong; Auth Service stores only IDs.",
        }
    ), 201


@app.post("/auth/login")
def login():
    """
    Public endpoint.
    - Authenticates user
    - Fetches HS256 secret from Kong using jwt_credential_id
    - Issues JWT with iss=userId
    """
    data, err, code = _json(["userId", "password"])
    if err:
        return err, code

    user_id = data["userId"]
    password = data["password"]

    user = get_user(user_id)
    if not user or not verify_password(user, password):
        return jsonify({"error": "Invalid credentials"}), 401

    try:
        secret = get_jwt_secret(user.jwt_credential_id)
    except KongError as e:
        return jsonify({"error": str(e)}), 502

    token = create_access_token(user_id=user.user_id, secret=secret)
    return jsonify({"access_token": token, "token_type": "Bearer"}), 200


@app.post("/auth/apikey")
def generate_apikey():
    """
    Public OR admin-protected endpoint (your choice).
    Creates an API key in Kong for selective APIs that do NOT use JWT.
    """
    data, err, code = _json(["userId"])
    if err:
        return err, code

    user_id = data["userId"]
    user = get_user(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    usage_scope = (request.get_json(silent=True) or {}).get("usageScope", "partner_api")

    try:
        cred = create_api_key(user_id)
    except KongError as e:
        return jsonify({"error": str(e)}), 502

    return jsonify(
        {
            "userId": user_id,
            "api_key": cred["key"],
            "consumer_id": cred["consumer"]["id"] if isinstance(cred.get("consumer"), dict) else user.kong_consumer_id,
            "usage_scope": usage_scope,
        }
    ), 201


@app.get("/auth/healthz")
def healthz():
    return jsonify({"ok": True}), 200


if __name__ == "__main__":
    app.run(host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", "9000")))