# Flask Auth Service + Kong (HS256 per-user JWT secret, API Keys, Redis rate limiting)

This repository implements one **unified**, consistent auth model:

- **User-facing APIs** use **JWT (HS256)** with a **per-user secret**
- JWT **issuer** is the public identifier: **`iss = userId`**
- The **JWT secret is generated and stored by Kong**
- The **Auth Service (Flask)** authenticates users and **signs** JWTs
- **Kong only verifies** JWTs and forwards traffic (stateless gateway)
- **Partner/Internal APIs** use **API Keys** (Kong Key-Auth plugin)
- **No mixing JWT + API Key on the same route**
- **Redis is used only for rate limiting** in Kong (distributed / multi-node safe)

> This is a Kong-native pattern for small/medium scale or internal systems. For large/public/compliance-heavy systems, prefer **OIDC** + **RS256**.

---

## Repo layout

- `app.py` – Flask app (`/signup`, `/login`, `/apikey`, `/healthz`)
- `kong_client.py` – Kong Admin API client (create consumer, create JWT cred, read secret, create API key)
- `token_service.py` – JWT creation (`iss=userId`, HS256)
- `user_store.py` – demo in-memory user store (replace with Postgres in real use)
- `docker-compose.yml` – Kong + Postgres (Kong DB) + Redis + Auth Service
- `Dockerfile` – container for Auth Service
- `kong_commands.sh` – example Kong plugin commands
- `run_local.sh` / `smoke_test.sh` – helper scripts

---

## Architecture (HLD)

**User JWT traffic:**
```
Browser  --JWT-->  Kong (N nodes)  ---->  Backend APIs
```

**Partner/Internal traffic:**
```
System  --API Key-->  Kong  ---->  Backend APIs
```

**Control plane:**
```
Flask Auth Service  --->  Kong Admin API  --->  Postgres (Kong DB)
Kong Rate Limiting  --->  Redis
```

---

## Core rules (contract)

### JWT (User APIs)
- `iss = userId` (public key / identifier)
- Kong stores a **per-user HS256 secret**
- Auth Service signs JWTs using that secret
- Kong verifies JWTs and forwards the request

### API Keys (Selective APIs)
- Only used on routes where JWT is not required
- Enforced at the route/service level in Kong
- Never enable Key-Auth and JWT plugins together on the same route

### Scalability
- Kong is stateless; secrets are cached per node
- Redis is used **only** for distributed rate limiting state

---

## Local quick start (Docker Compose)

### 1) Start everything
```bash
chmod +x run_local.sh smoke_test.sh
./run_local.sh
```

You’ll get:
- Auth Service: `http://localhost:5000`
- Kong Proxy: `http://localhost:8000`
- Kong Admin (DEV ONLY): `http://localhost:8001`
- Redis: `localhost:6379`

### 2) Run the smoke test
```bash
./smoke_test.sh
```

This will:
1. Create a user via `/signup` (also creates Kong consumer + JWT credential)
2. Login via `/login` and print a JWT
3. Create an API key via `/apikey`

---

## Auth Service endpoints

### `POST /signup` (public)
Creates:
- Kong consumer (`username = userId`)
- Kong JWT credential (`key = userId`, `algorithm = HS256`)

Request:
```json
{ "userId": "alice", "password": "password123" }
```

Response (example):
```json
{
  "userId": "alice",
  "kongConsumerId": "...",
  "jwtCredentialId": "..."
}
```

### `POST /login` (public)
Authenticates username/password, fetches the per-user secret from Kong, and returns a signed HS256 JWT.

Request:
```json
{ "userId": "alice", "password": "password123" }
```

Response:
```json
{ "access_token": "<jwt>", "token_type": "Bearer" }
```

JWT claims:
- `iss = userId`
- `sub = userId`
- `iat`, `exp`

### `POST /apikey` (public or admin-protected — your choice)
Creates a Key-Auth credential in Kong for the user (for routes that do **not** use JWT).

Request:
```json
{ "userId": "alice", "usageScope": "partner_api" }
```

Response:
```json
{ "api_key": "...", "usage_scope": "partner_api" }
```

---

## Kong configuration (what to enable where)

### 1) User APIs: JWT plugin
Enable **JWT** plugin on the route/service that fronts user APIs.

Example (route-level):
```bash
curl -sS -X POST http://localhost:8001/routes/<user-api-route-id>/plugins \
  --data "name=jwt"
```

### 2) Partner/Internal APIs: Key-Auth plugin
Enable **Key-Auth** plugin on routes/services where JWT is not required.

```bash
curl -sS -X POST http://localhost:8001/routes/<partner-route-id>/plugins \
  --data "name=key-auth"
```

### 3) Distributed rate limiting: Redis policy
```bash
curl -sS -X POST http://localhost:8001/plugins \
  --data "name=rate-limiting" \
  --data "config.minute=60" \
  --data "config.policy=redis" \
  --data "config.redis_host=redis" \
  --data "config.redis_port=6379"
```

> You can apply rate limiting globally, per service, or per route depending on your needs.

---

## Important operational note: HS256 secret retrieval

This repo currently signs JWTs by **fetching the per-user secret from Kong** via:

`GET /jwt-secrets/{credential_id}`

Depending on
