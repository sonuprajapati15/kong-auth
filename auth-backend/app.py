import os

from flask import Flask, request, jsonify
from flask_cors import CORS

from kong_client import KongError
from auth_service import (
    signup_user,
    login_user,
    logout_user,
    generate_apikey_for_user,
    ValidationError,
    ConflictError,
    NotFoundError,
    PersistenceError,
)

app = Flask(__name__)
CORS(app)


def _json(required_fields):
    data = request.get_json(silent=True) or {}
    missing = [f for f in required_fields if f not in data or data[f] in (None, "")]
    if missing:
        return None, jsonify({"error": f"Missing fields: {missing}"}), 400
    return data, None, None


@app.post("/auth/signup")
def signup():
    data, err, code = _json(["email", "password"])
    if err:
        return err, code
    try:
        resp = signup_user(email=data["email"], password_b64=data["password"], role="user")
        return jsonify(resp), 201
    except ConflictError as e:
        return jsonify({"error": str(e)}), 409
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
    except PersistenceError as e:
        return jsonify({"error": str(e)}), 500
    except KongError as e:
        return jsonify({"error": str(e)}), 502


@app.post("/auth/login")
def login():
    data, err, code = _json(["email", "password"])
    if err:
        return err, code

    try:
        resp = login_user(email=data["email"], password_b64=data["password"])
        return jsonify(resp), 200
    except ValidationError as e:
        msg = str(e)
        if msg == "Invalid credentials Or User Not Exist":
            return jsonify({"error": msg}), 401
        return jsonify({"error": msg}), 400
    except KongError as e:
        return jsonify({"error": str(e)}), 502


@app.post("/auth/logout")
def logout():
    data, err, code = _json(["email"])  # keeping your existing payload requirement
    if err:
        return err, code
    try:
        resp = logout_user(email=data["email"])
        return jsonify(resp), 200
    except NotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
    except KongError as e:
        return jsonify({"error": str(e)}), 502


@app.post("/auth/apikey")
def generate_apikey():
    data, err, code = _json(["userId"])
    if err:
        return err, code
    usage_scope = (request.get_json(silent=True) or {}).get("usageScope", "partner_api")
    try:
        resp = generate_apikey_for_user(user_id=data["userId"], usage_scope=usage_scope)
        return jsonify(resp), 201
    except NotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except KongError as e:
        return jsonify({"error": str(e)}), 502


@app.get("/auth/healthz")
def healthz():
    return jsonify({"ok": True}), 200


if __name__ == "__main__":
    app.run(host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", "9000")))