# JWT plugin on "user APIs" route/service (example)
# (Do not enable key-auth on the same route.)

# Enable JWT on a route:
# curl -sS -X POST http://localhost:8001/routes/<user-api-route-id>/plugins \
#   --data "name=jwt"

# Key-auth plugin on selective APIs route/service:
# curl -sS -X POST http://localhost:8001/routes/<public-api-route-id>/plugins \
#   --data "name=key-auth"

# Rate limiting (Redis policy) - can be global or per service/route:
# curl -sS -X POST http://localhost:8001/plugins \
#   --data "name=rate-limiting" \
#   --data "config.minute=60" \
#   --data "config.policy=redis" \
#   --data "config.redis_host=<redis-host>" \
#   --data "config.redis_port=6379"