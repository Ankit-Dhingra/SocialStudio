#!/usr/bin/env bash
set -euo pipefail

suffix="studio-release-${BASHPID}"
network="${suffix}-net"
mongo="${suffix}-mongo"
redis="${suffix}-redis"
api="${suffix}-api"
generation="${suffix}-generation"
renderer="${suffix}-renderer"
fixtures="$(mktemp -d)"

cleanup() {
  local exit_code=$?
  for container in "$api" "$generation" "$renderer"; do
    if docker inspect "$container" >/dev/null 2>&1; then
      printf '\nContainer log for %s\n' "$container"
      docker logs "$container" || true
    fi
  done
  docker rm -f "$api" "$generation" "$renderer" "$mongo" "$redis" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  find "$fixtures" -maxdepth 1 -type f -delete
  rmdir "$fixtures"
  exit "$exit_code"
}
trap cleanup EXIT

for target in api generation renderer; do
  docker build --target "$target" --tag "${suffix}:${target}" .
done

openssl req -x509 -newkey rsa:2048 -nodes -days 1 -sha256 -subj '/CN=SocialStudio Container Test CA' \
  -keyout "$fixtures/ca.key" -out "$fixtures/ca.pem" 2>/dev/null
openssl req -new -newkey rsa:2048 -nodes -subj '/CN=studio-mongo' -keyout "$fixtures/mongo.key" \
  -out "$fixtures/mongo.csr" 2>/dev/null
printf '%s\n' 'subjectAltName=DNS:studio-mongo' 'extendedKeyUsage=serverAuth' >"$fixtures/mongo.ext"
openssl x509 -req -in "$fixtures/mongo.csr" -CA "$fixtures/ca.pem" -CAkey "$fixtures/ca.key" -set_serial 1 \
  -out "$fixtures/mongo.crt" -days 1 -sha256 -extfile "$fixtures/mongo.ext" 2>/dev/null
cat "$fixtures/mongo.key" "$fixtures/mongo.crt" >"$fixtures/mongo.pem"
chmod 0755 "$fixtures"
chmod 0644 "$fixtures/mongo.pem" "$fixtures/ca.pem"

docker network create --internal "$network" >/dev/null
docker run -d --name "$mongo" --network "$network" --network-alias studio-mongo \
  --mount "type=bind,src=$fixtures/mongo.pem,dst=/fixtures/mongo.pem,readonly" \
  --mount "type=bind,src=$fixtures/ca.pem,dst=/fixtures/ca.pem,readonly" mongo:8 \
  --tlsMode requireTLS --tlsCertificateKeyFile /fixtures/mongo.pem --tlsCAFile /fixtures/ca.pem \
  --tlsAllowConnectionsWithoutCertificates >/dev/null
docker run -d --name "$redis" --network "$network" --network-alias red-releasecheck redis:7-alpine \
  redis-server --save '' --appendonly no --maxmemory-policy noeviction >/dev/null

retry() {
  for _ in $(seq 1 40); do
    if "$@"; then return 0; fi
    sleep 1
  done
  return 1
}

retry docker exec "$mongo" mongosh --quiet 'mongodb://studio-mongo/test?tls=true' \
  --tlsCAFile /fixtures/ca.pem --eval 'quit(db.adminCommand({ping: 1}).ok === 1 ? 0 : 1)' >/dev/null
retry docker exec "$redis" redis-cli ping >/dev/null

common=(
  --network "$network"
  --mount "type=bind,src=$fixtures/ca.pem,dst=/fixtures/ca.pem,readonly"
  -e NODE_EXTRA_CA_CERTS=/fixtures/ca.pem
  -e 'MONGODB_URI=mongodb://studio-mongo/socialstudio_release?tls=true'
  -e REDIS_URL=redis://red-releasecheck:6379
)
publishable="pk_live_$(printf '%s' 'clerk.example.invalid$' | base64 -w0)"
docker run -d --name "$api" --memory 512m "${common[@]}" \
  -e "CLERK_PUBLISHABLE_KEY=$publishable" -e CLERK_SECRET_KEY=sk_live_release_fixture \
  -e FRONTEND_URL=https://studio.example.invalid -e OWNER_EMAIL=owner@example.invalid \
  -e STUDIO_GENERATION_ENABLED=false -e REDIS_HEALTH_CHECK=true "${suffix}:api" >/dev/null

retry docker exec "$api" node -e '
  const assert = require("node:assert/strict");
  (async () => {
    const base = "http://127.0.0.1:4000";
    assert.equal((await fetch(base + "/health")).status, 200);
    const response = await fetch(base + "/ready");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {status: "ready", database: "ok", redis: "ok"});
    assert.equal((await fetch(base + "/api/account")).status, 401);
    console.log("API health, MongoDB TLS, Redis readiness and anonymous authorization verified.");
  })().catch(() => process.exit(1));'

worker_config='{"caps":{"dailyMicros":100,"monthlyMicros":100,"userDailyMicros":100,"providerDailyMicros":100},"operations":{"render":{"credits":1,"computeMicros":1,"providers":{}},"refine":{"credits":1,"computeMicros":0,"providers":{"groq":{"attempts":1,"microsPerCall":1}}}}}'
worker=(
  -e STUDIO_GENERATION_ENABLED=true -e "STUDIO_GENERATION_CONFIG=$worker_config"
  -e PRIVATE_MEDIA_DRIVER=cloudinary -e CLOUDINARY_CLOUD_NAME=release-fixture
  -e CLOUDINARY_API_KEY=123456789012345 -e CLOUDINARY_API_SECRET=release-fixture
)
docker run -d --name "$generation" "${common[@]}" "${worker[@]}" "${suffix}:generation" >/dev/null
docker run -d --name "$renderer" "${common[@]}" "${worker[@]}" "${suffix}:renderer" >/dev/null

ready_worker() {
  docker logs "$1" 2>&1 | grep -F "Ready ($2)." >/dev/null
}
retry ready_worker "$generation" generation
retry ready_worker "$renderer" render
stats="$(docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.CPUPerc}}' "$api" "$generation" "$renderer")"
while IFS= read -r line; do
  printf '::notice title=Container memory and CPU::%s\n' "$line"
done <<<"$stats"

docker stop -t 20 "$api" "$generation" "$renderer" >/dev/null
for container in "$api" "$generation" "$renderer"; do
  test "$(docker inspect --format '{{.State.ExitCode}}' "$container")" = 0
done
docker logs "$api" 2>&1 | grep -F '[API] Shutdown complete.'
printf '%s\n' '::notice title=Release readiness::API health and readiness, anonymous rejection, worker startup, and SIGTERM shutdown verified.'
