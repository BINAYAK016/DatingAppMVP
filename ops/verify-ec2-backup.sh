#!/usr/bin/env bash
# Restore the cold EC2 snapshot and exercise its saved API in an isolated network.
set -euo pipefail
umask 077

if [[ "$(uname -s)" != Linux ]]; then
  printf 'Run this check on the Ubuntu EC2 instance.\n' >&2
  exit 1
fi

backup_root="$(realpath -e "$HOME/sangai-backups")"
backup_dir="$(realpath -e "$(cat "$backup_root/LATEST")")"
case "$backup_dir" in
  "$backup_root/"*) ;;
  *) printf 'Backup path is outside sangai-backups.\n' >&2; exit 1 ;;
esac
for required in database.tar.gz media.tar.gz containers.json; do
  test -s "$backup_dir/$required"
done
gzip -t "$backup_dir/database.tar.gz" "$backup_dir/media.tar.gz"

check_name="sangai-restore-$(cat /proc/sys/kernel/random/uuid)"
db_container="$check_name-db"
api_container="$check_name-api"
db_volume="$check_name-db"
media_volume="$check_name-media"
check_dir="$(mktemp -d "$backup_root/.restore-check.XXXXXXXX")"

cleanup() {
  local status=$?
  trap - EXIT
  docker rm -f "$api_container" "$db_container" >/dev/null 2>&1 || true
  docker volume rm "$db_volume" "$media_volume" >/dev/null 2>&1 || true
  docker network rm "$check_name" >/dev/null 2>&1 || true
  rm -f -- "$check_dir/api.env" "$check_dir/api.image" "$check_dir/db.image"
  rmdir -- "$check_dir" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

python3 - "$backup_dir/containers.json" "$check_dir" <<'PY'
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

saved = json.loads(Path(sys.argv[1]).read_text())
target = Path(sys.argv[2])
api = next(item for item in saved if item["Name"] == "/sangai-beta-api-1")
db = next(item for item in saved if item["Name"] == "/sangai-beta-db-1")
env = dict(value.split("=", 1) for value in api["Config"]["Env"])
url = urlsplit(env["DATABASE_URL"])
if "@" not in url.netloc:
    raise ValueError("Saved database configuration has no user credentials.")
authority = url.netloc.rsplit("@", 1)[0] + "@restore-db:5432"
env.update(
    DATABASE_URL=urlunsplit(url._replace(netloc=authority)),
    NODE_ENV="development", PORT="4100", UPLOAD_DIR="/data/media",
    ENABLE_DEMO="false", DEMO_MODE="false", ENABLE_PUSH="false",
    SMTP_HOST="", TRUSTED_PROXY_IPS="",
)
if any("\n" in value or "\r" in value for value in env.values()):
    raise ValueError("Saved environment contains unsupported multiline values.")
for filename, content in [
    ("api.env", "".join(f"{key}={value}\n" for key, value in env.items())),
    ("api.image", api["Image"]), ("db.image", db["Image"]),
]:
    path = target / filename
    path.write_text(content)
    os.chmod(path, 0o600)
PY

api_image="$(cat "$check_dir/api.image")"
db_image="$(cat "$check_dir/db.image")"
docker image inspect "$api_image" "$db_image" >/dev/null
docker network create --internal "$check_name" >/dev/null
docker volume create "$db_volume" >/dev/null
docker volume create "$media_volume" >/dev/null

docker run --rm --network none \
  -v "$db_volume:/restore" -v "$backup_dir:/backup:ro" \
  alpine:3.22 tar -xzf /backup/database.tar.gz -C /restore
docker run --rm --network none \
  -v "$media_volume:/restore" -v "$backup_dir:/backup:ro" \
  alpine:3.22 tar -xzf /backup/media.tar.gz -C /restore

docker run -d --name "$db_container" --network "$check_name" \
  --network-alias restore-db \
  -v "$db_volume:/var/lib/postgresql/data" "$db_image" >/dev/null
for attempt in {1..30}; do
  if docker exec "$db_container" pg_isready -U sangai -d sangai >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$db_container" pg_isready -U sangai -d sangai >/dev/null
docker exec "$db_container" psql -U sangai -d sangai \
  -v ON_ERROR_STOP=1 -c 'SELECT count(*) AS restored_users FROM users;'

docker run -d --name "$api_container" --network "$check_name" \
  --env-file "$check_dir/api.env" \
  -v "$media_volume:/data/media" "$api_image" >/dev/null

api_ready=false
for attempt in {1..30}; do
  if docker exec "$api_container" node -e \
    'Promise.all(["health","ready"].map(path=>fetch("http://127.0.0.1:4100/"+path))).then(results=>process.exit(results.every(r=>r.ok)?0:1)).catch(()=>process.exit(1))' \
    >/dev/null 2>&1; then
    api_ready=true
    break
  fi
  sleep 1
done
if [[ "$api_ready" != true ]]; then
  printf 'FAIL: the saved API did not become healthy against the restored data.\n' >&2
  exit 1
fi

docker run --rm --network none -v "$media_volume:/restore:ro" \
  alpine:3.22 sh -c 'test -n "$(find /restore -type f -print -quit)"'
printf 'PASS: database and media restored; saved API health and readiness passed.\n'
printf 'Temporary check containers, network and volumes will now be removed.\n'
