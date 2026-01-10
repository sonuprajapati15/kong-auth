set -euo pipefail

docker compose up --build -d

echo
echo "Auth Service:  http://localhost:5000/healthz"
echo "Kong Proxy:    http://localhost:8000"
echo "Kong Admin:    http://localhost:8001 (DEV ONLY; lock down in prod)"
echo "Redis:         localhost:6379"