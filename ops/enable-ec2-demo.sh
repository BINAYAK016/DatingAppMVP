#!/usr/bin/env bash
# Operator-run activation for the existing sangaidev EC2 test deployment.
# Does not invoke seed/reset or delete database/media volumes.
set -euo pipefail
umask 077

task_repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$task_repo"
task_host="sangaidev.duckdns.org"
task_stamp="$(date -u +%Y%m%d-%H%M%S)-$$"
task_backup_dir="$HOME/sangai-backups/demo-enable-$task_stamp"
task_release="/srv/sangai/releases/web-demo-$task_stamp"
task_config="$(mktemp)"
trap 'rm -f -- "$task_config"' EXIT
trap 'task_exit=$?; printf "Activation stopped at line %s (exit %s). Backup directory: %s\n" "$LINENO" "$task_exit" "$task_backup_dir" >&2; exit "$task_exit"' ERR

test -f .env
test -L /srv/sangai/web
test -f /srv/sangai/web/index.html
mkdir -p "$task_backup_dir"
cp -p .env "$task_backup_dir/.env"
sudo cp -p /etc/caddy/Caddyfile "$task_backup_dir/Caddyfile"
sudo chmod 600 "$task_backup_dir/Caddyfile"
readlink -f /srv/sangai/web > "$task_backup_dir/previous-web.txt"
git rev-parse HEAD > "$task_backup_dir/source-commit.txt"
docker compose exec -T db pg_dump -U sangai -d sangai -Fc \
  > "$task_backup_dir/database.dump"
test -s "$task_backup_dir/database.dump"

python3 - "$task_config" "$task_host" <<'PY'
from pathlib import Path
import sys

config = Path("ops/Caddyfile.web-demo-beta.example").read_text()
Path(sys.argv[1]).write_text(config.replace("{$BETA_HOST}", sys.argv[2]))
PY
sudo caddy validate --config "$task_config" --adapter caddyfile

printf 'Building web entry with demo and ordinary-account choices...\n'
docker run --rm --init --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -e CI=1 -e EXPO_NO_DOTENV=1 -e EXPO_NO_TELEMETRY=1 \
  -e EXPO_PUBLIC_API_URL= -e NODE_OPTIONS=--max-old-space-size=1024 \
  -v "$task_repo:/workspace" -w /workspace \
  node:24.16.0-bookworm sh -c '
    set -e
    npm ci --prefix apps/mobile --no-audit --no-fund
    npm run typecheck --prefix apps/mobile
    npm run lint --prefix apps/mobile
    npm run web:build:remote
  '
test -f apps/mobile/dist/index.html
sudo install -d -m 755 "$task_release"
sudo cp -a apps/mobile/dist/. "$task_release/"
sudo chmod -R a+rX "$task_release"
sudo -u caddy test -r "$task_release/index.html"

# Use the installed catalog, not a blanket update of all demo-marked accounts.
# Reject an absent/mismatched world so startup cannot silently reseed activity.
docker compose exec -T api node <<'JS'
const assert = require("node:assert/strict");
const { pool } = require("./dist/db");
const { demoIds } = require("./dist/demoPersonas");
const { DEMO_WORLD_VERSION } = require("./dist/demoWorld");
(async () => {
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const metadata = await client.query("SELECT version FROM demo_world_metadata WHERE singleton");
    assert.equal(metadata.rows[0]?.version, DEMO_WORLD_VERSION);
    const users = await client.query("SELECT id,demo FROM users WHERE id=ANY($1::uuid[]) FOR UPDATE", [demoIds]);
    assert.equal(demoIds.length, 30);
    assert.equal(users.rows.length, demoIds.length);
    assert.ok(users.rows.every(user => user.demo === true));
    await client.query("DELETE FROM sessions USING users WHERE sessions.user_id=users.id AND users.id=ANY($1::uuid[]) AND users.demo AND users.suspended", [demoIds]);
    const result = await client.query("UPDATE users SET suspended=false WHERE demo AND id=ANY($1::uuid[])", [demoIds]);
    await client.query("COMMIT");
    console.log("Existing fictional accounts enabled:", result.rowCount);
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Demo activation failed:", error.code || "catalog scope check");
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
})();
JS

python3 - "$task_host" <<'PY'
from pathlib import Path
import re
import sys

path = Path(".env")
lines = path.read_text().splitlines()
updates = {
    "ENABLE_DEMO": "true",
    "DEMO_MODE": "true",
    "WEB_COOKIE_SECURE": "true",
    "CORS_ORIGINS": "https://" + sys.argv[1],
}
for key, value in updates.items():
    pattern = re.compile(r"^\s*(?:export\s+)?" + re.escape(key) + r"\s*=")
    lines = [line for line in lines if not pattern.match(line)]
    lines.append(f"{key}={value}")
path.write_text("\n".join(lines) + "\n")
path.chmod(0o600)
PY
unset ENABLE_DEMO DEMO_MODE WEB_COOKIE_SECURE CORS_ORIGINS
docker compose -f compose.yaml -f ops/compose.ec2.yaml \
  up -d --force-recreate --no-deps --wait --wait-timeout 120 api

sudo ln -sfn "$task_release" /srv/sangai/web
sudo install -m 644 "$task_config" /etc/caddy/Caddyfile
sudo systemctl reload caddy

task_curl=(curl --silent --show-error --connect-timeout 5 --max-time 20 \
  --resolve "$task_host:443:127.0.0.1")
"${task_curl[@]}" --fail "https://$task_host/v1/demo/config" | python3 -c '
import json, sys
result = json.load(sys.stdin)
assert result["enabled"] is True
print("Demo mode: enabled")
'
for task_group in men women lgbtq; do
  "${task_curl[@]}" --fail "https://$task_host/v1/demo/users?group=$task_group&limit=10" | python3 -c '
import json, sys
result = json.load(sys.stdin)
assert len(result["items"]) == 10
print(sys.argv[1] + ": 10 fictional profiles")
' "$task_group"
done
task_session_status="$("${task_curl[@]}" -o /dev/null -w '%{http_code}' \
  -H 'X-Sangai-Client: web' -H "Origin: https://$task_host" \
  -H "Referer: https://$task_host/" "https://$task_host/v1/auth/session")"
printf 'Unsigned browser session: %s (expected 401)\n' "$task_session_status"
test "$task_session_status" = 401
task_admin_status="$("${task_curl[@]}" -o /dev/null -w '%{http_code}' "https://$task_host/admin")"
printf 'Administration: %s (expected 404)\n' "$task_admin_status"
test "$task_admin_status" = 404
printf 'Backup: %s\nOpen https://%s/ to choose a fictional account or use your own account.\n' "$task_backup_dir" "$task_host"
