> Historical discovery proposal (28 September 2026). The later user-authorized beta is implemented; see [current scope](beta.md), [README](../README.md), and [verification](verification.md). Proposed services and future features below are not claims of delivered functionality.

# Docker and deployment design

Status: specification only. Dockerfiles, Compose, `.env.example`, `.dockerignore` and devcontainer files are intentionally deferred to the foundation milestone. The documentation commit does not provide a runnable app or claim Docker checks passed.

## Required foundation artifacts

| File | Required behavior |
| --- | --- |
| `apps/api/Dockerfile` | Multi-stage dependencies/build/runtime; API and worker commands from one image; non-root production user |
| `apps/admin/Dockerfile` | Build static moderator UI; serve without source, build secrets or unnecessary development tools |
| `compose.yaml` | Reproducible local services, health checks, dependency ordering, named volumes and explicit environment inputs |
| `compose.dev.yaml` | Documented optional bind mounts/hot reload and dev-only ports; never production default |
| `.dockerignore` | Exclude Git, local secrets, node_modules, logs, private data and generated artifacts |
| `.env.example` | Document all variables with safe placeholders/local-only values; never usable production credentials |
| `.devcontainer/devcontainer.json` | Reuse workspace toolchain and Compose dependencies; no unnecessary production credentials or privileged Docker socket |
| `infra/` documentation/config | Migrations, backup/restore, health/readiness, deploy and rollback procedures |

No `latest` image tags for releases. Pin supported base versions/digests, lock JS dependencies and periodically update. Keep development and production stages distinct; do not carry source mounts or compilers into runtime images.

## Local services

| Component | Default/optional | Notes |
| --- | --- | --- |
| api | Default | Authenticated REST, sockets and authorized media gateway; container health/readiness endpoints |
| worker | Default | Same backend image, dedicated command; durable outbox dispatch, image processing, moderation and notification jobs |
| postgres | Default | Named data volume, health check, migration role separate from runtime privileges |
| redis | Default | Rate limits/jobs; named volume with appropriate persistence; recovery must use durable DB state |
| S3-compatible object store | Default | Single-node development service and persistent volume, not a production storage claim; implementation chooses a maintained, license-reviewed image |
| admin | Default | Moderator UI; development authentication explicitly isolated from production |
| migrate | One-shot | Wait for healthy database, apply versioned migrations once, exit successfully before API readiness |
| object-init | One-shot if needed | Idempotently create private quarantine/approved buckets and policies |
| devtools/Metro | Optional dev profile | Node tools and mobile bundler; not an emulator or mobile runtime |
| reverse proxy | Optional locally; required production edge | HTTPS/WSS termination and timeouts; one edge for admin/API, not a proxy per module |

No AI, Elasticsearch, Kafka, Kubernetes, dedicated notification microservice or separate socket service in P0. Local OTP/push providers use explicit development adapters that produce observable test results without external credentials. These adapters must refuse production startup and never silently fall back in production.

Default database/object-store ports bind only to loopback if exposed at all. Devices need a reachable API/Metro endpoint, not internal Compose DNS. Use a documented LAN address, safe tunnel or emulator-specific host mapping; `localhost` on a phone means the phone. Distinguish server-internal storage URL from the device-reachable upload URL. Scope Windows firewall access to the development network. Never work around connectivity by opening database or admin access to the public internet.

## Startup and developer workflow

The README's clone/copy/compose command is the target acceptance flow. On first startup: validate configuration → healthy DB/Redis/storage → create private buckets → run migrations → start API/worker/admin → expose readiness. Compose start order alone does not mean a dependency is ready; use health checks and application retries. See [Docker startup guidance](https://docs.docker.com/compose/how-tos/startup-order/).

Foundation documentation must state exact ports, health URLs, native app setup, fixture opt-in, log commands and recovery commands. Fixtures are deterministic, synthetic and unavailable in production. Default startup must not require paid provider credentials for local test operations. Never print OTP/provider secrets in production logs.

Named volumes survive normal container recreation. Clearly distinguish a normal stop from deleting volumes; never recommend destructive cleanup as routine troubleshooting. Migrations are reviewed and run as a job, not concurrently by every API replica. Local database reset requires explicit targeting of local data.

Environment groups: DB/Redis/object endpoints; signing/token configuration; public API/base URL; OTP and push mode; media limits; telemetry; admin identity; allowed origins; timezone/default locale; feature flags. Mobile public config must contain only intentionally public values. Production requires explicit secrets injected at runtime and rejects development defaults/adapters. Compose `.env` interpolation is not a secrets manager.

## Mobile boundary

Docker covers backend services, workers, admin, dependencies and portable development tooling. Android emulator/device interaction typically runs on the host; Android CI builds can use Linux build workers. iOS native builds/simulators require macOS/Xcode, or a hosted macOS build service. The user's Windows workstation can develop shared code and request hosted iOS builds but cannot locally replace Xcode with Linux Docker. [Expo documents its build environments](https://docs.expo.dev/build/introduction/).

## Production structure

Use immutable API/worker/admin images promoted from staging. Prefer managed PostgreSQL with tested recovery and private object storage when budget permits. Choose region/provider from measured Nepal/Australia latency, data obligations, support and cost; no provider has been selected or provisioned. A small managed container platform is sufficient initially; a single secured VM/Compose deployment may serve a limited pilot with an explicit single-host availability risk.

Production controls: private DB/cache networks, TLS edge, secrets service, least-privilege runtime identities, non-root/read-only filesystem where supported, writable temp directory quotas for media, CPU/memory limits, graceful shutdown, health/readiness separation, log rotation/redaction and resource/queue alerts. Keep signing credentials out of containers and repositories. Build provenance/image scans and dependency review precede promotion.

Run backup restore tests and document RPO/RTO actually achieved. Persistent volumes alone are not backups or high availability. Release sequence: backup/recovery check → compatible migration → new image health checks → controlled traffic → verify critical journey → observe metrics. Roll back app image first when compatible; database rollback needs reviewed recovery rather than blindly reversing destructive migrations.

## Foundation acceptance checks

From a clean checkout, validate Compose configuration, build images and start services. Verify health and migration completion; persist a synthetic record/object across restart; exercise API-to-worker outbox flow; inspect private bucket policy and network exposure; restart Redis and confirm committed work survives; verify production rejects dev adapters; test both native clients reach the documented API endpoint. Record exact commands and outputs in that implementation change. None of these checks can run against this docs-only commit.
