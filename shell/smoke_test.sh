set -euo pipefail

# 1) signup
curl -sS -X POST http://localhost:5000/signup \
  -H 'Content-Type: application/json' \
  -d '{"userId":"alice","password":"password123"}' | jq .

# 2) login -> JWT
TOKEN="$(curl -sS -X POST http://localhost:5000/login \
  -H 'Content-Type: application/json' \
  -d '{"userId":"alice","password":"password123"}' | jq -r .access_token)"

echo "JWT: $TOKEN"

# Note: actually calling protected upstream through Kong requires you to create
# services/routes/plugins in Kong; this just validates auth-service flows.