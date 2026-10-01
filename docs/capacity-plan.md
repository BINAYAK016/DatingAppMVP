# Sangai capacity plan

Status: measured local baseline, implemented query foundation and one bounded read smoke run, not a capacity certification. Source baseline: `35fd0d3`; implemented API checkpoint: `a4d5193`. Audit dates: 1–2 October 2026. Read alongside [scalability-audit.md](scalability-audit.md) and [verification](verification.md). The measurements used an owned disposable database/API. The later coordinated local beta upgrade preserved persistent volumes; no cloud service or purchase was introduced.

## Current measured baseline

| Component                   | Actual observation                                                                                                                                            | Capacity status / next measurement                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Host                        | Windows; Intel Core i5-1235U; 12 logical processors; 16,890,978,304 bytes physical memory (about 15.73 GiB)                                                   | Development laptop; not a production benchmark machine                                                                              |
| Docker runtime              | Linux VM; 12 CPUs; 8,188,522,496 bytes memory (about 7.626 GiB)                                                                                               | Record allocation and competing workloads for every later run                                                                       |
| API                         | One healthy Node/NestJS container; approximately 96.97 MiB memory and 0.03% CPU in one idle snapshot; container CPU/memory limits unset                       | Sustained requests/second and latency capacity unmeasured                                                                           |
| PostgreSQL                  | One healthy PostgreSQL 17.7 container; approximately 61.36 MiB memory and 3.24% CPU in one snapshot; container limits unset                                   | Throughput, contention, vacuum pressure and storage growth unmeasured                                                               |
| DB configuration            | `max_connections=100`; shared buffers 128 MiB; work memory 4 MiB; statement, lock and idle-transaction timeouts disabled                                      | API pool maximum is 10 connections per process; future replicas need a shared connection budget with administrative/worker reserves |
| Dataset                     | 6 users; 5 connections; 25 messages; 3 stories; 20 posts; 0 comments; 2 reactions; 41 media; 23 games; 73 notifications                                       | Too small to extrapolate to 10K, 100K, 1M or 10M accounts                                                                           |
| Schema                      | 30 public tables; 46 indexes including primary/unique indexes                                                                                                 | Query coverage is incomplete; see the query audit                                                                                   |
| Storage sizes               | Sessions approximately 160 KiB total; games/auth challenges/discovery actions/notifications about 80 KiB each; posts/messages about 64 KiB each at inspection | Catalog sizes include indexes; these are local storage observations, not future growth rates                                        |
| Media                       | API-streamed private filesystem volume; synchronous image/video processing                                                                                    | Delivery bandwidth, processing throughput, orphan cleanup and disk capacity unmeasured                                              |
| Cache / queue / realtime    | No shared cache, durable worker queue or websocket server; periodic API polling and process timers                                                            | These must be designed/measured before claiming horizontal readiness                                                                |
| Email / push / verification | Mailpit local email; optional Expo push adapter disabled by default; liveness provider not introduced                                                         | Real provider delivery, quotas, costs and failure behavior are not measured                                                         |

Idle snapshots and sub-millisecond component SELECTs on six users cannot certify throughput or concurrent-user capacity. Browser/native journey evidence in [verification.md](verification.md) proves specific behavior, not load capacity. The API deliberately refuses `NODE_ENV=production`; removing that guard is not part of this plan.

## Workload model: registered users are not concurrent users

The user requested dataset stages of 10K, 100K, 1M and 10M registered accounts. These are data-size scenarios. No daily-active percentage, concurrency ratio, geographic split, message rate or upload rate has yet been measured or agreed.

Keep the following inputs in every run manifest and label each as observed or an explicit test assumption:

| Input                                                               | How it is obtained / used                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Registered, monthly-active and daily-active accounts                | Actual beta counters first; later product analytics with minimal personal data                   |
| Foreground seconds per active person; chat/game/story screen shares | Measure consented beta sessions; screen time determines polling demand                           |
| Match-degree distribution                                           | Use median and tail accounts separately; a population total does not describe per-account fanout |
| Messages, swipes, feed views, posts and game invites per active day | Measure each product-loop action, including retries and bursts                                   |
| Media count/size/duration distributions                             | Record sanitized histograms, thumbnails, range requests and bytes transferred                    |
| Peak multiplier and correlated events                               | Observed peaks or a labeled stress assumption; include return-from-background bursts             |
| Block/unmatch/suspension rate and moderation/cleanup activity       | Safety mutations must be mixed into read and delivery tests                                      |

For a fixed scenario, average action rate is `DAU × actions per active day / 86,400`; peak rate is that average times the explicitly chosen peak multiplier. Current polling adds approximately `foreground clients / 12` state requests/second, `open chat or legacy game clients / 3` conversation requests/second and `legacy ready-screen clients / 10` readiness operations/second, before refresh-on-focus, manual refreshes and stories. The coordinated Games 2.0 hook instead reads one session approximately every four seconds while playing or ten seconds while invited, with failure backoff up to 30 seconds. State/GET coalescing reduces overlaps, but the complete legacy state payload remains. These are formulas from inspected intervals, not traffic predictions. Count repeated requests separately to detect overlap.

## Realistic progressive load tests

### Executed bounded local read baseline

Run from `apps/api` after building the current API:

```powershell
npm run build
node node_modules/tsx/dist/cli.mjs test/read-load.ts --seconds=10 --concurrency=4 --requests=100 --rps=10
```

The harness creates an owned disposable database, separate API port and bounded temporary media directory, records sanitized source/configuration/fixture metrics, and cleans up its own resources. It enforces ceilings of 60 seconds, 50 workers, 500 requests and 100 offered requests/second. It measures only authenticated GET state/feed/matches/stories/notifications; chat and game reads are omitted because they may update read state or expiry. It does not modify the shared beta database or send external notifications.

The run recorded at `2026-10-01T17:31:20.115Z` used baseline commit `35fd0d3cf49795b29c49b67325160d261a2e22ec` with a dirty working tree containing the approved fixes. Four paced closed-loop workers completed 100 requests over 9.933 seconds (10.067 completed requests/second at an offered 10 requests/second). All responses were HTTP 200; there were zero errors.

| Endpoint                  | Requests | p50 ms | p95 ms | p99 ms | Response bytes total |
| ------------------------- | -------: | -----: | -----: | -----: | -------------------: |
| `/state`                  |       20 | 48.640 | 79.935 | 79.954 |              143,380 |
| `/feed`                   |       20 | 27.334 | 40.832 | 50.305 |               45,460 |
| `/matches?limit=10`       |       20 | 21.261 | 31.469 | 35.885 |               22,100 |
| `/stories?limit=10`       |       20 | 19.057 | 32.582 | 32.836 |               14,560 |
| `/notifications?limit=10` |       20 | 17.807 | 28.155 | 28.375 |                  920 |

Raw report: `C:\Users\Dell\Documents\Codex\2026-09-28\u\outputs\load-qa\read-load-1790875866648.json` (outside Git). Fixture: five synthetic users, three connections, one message, three posts, one story and zero games. The API ran on the Windows host and PostgreSQL in the existing Docker VM; competing resource usage was not controlled. Auth setup, warm-up and cleanup are outside measured latency. Twenty observations per endpoint give a weak tail estimate; the paced closed-loop driver can hide saturation latency. Google, live verification, uploads, authenticated media delivery, chat/game actions, external delivery, soak/restart recovery and high-volume data were not load-tested. This smoke run establishes a reproducible local baseline only and supports no 1M/10M account or concurrent-user claim.

The initial 11 isolated query-foundation regressions passed in 28.8 seconds; the expanded 13-test suite, including exact feed and mixed chat cursor precision, passed in 7.94 seconds. Actual client query instrumentation stayed at 18 state calls when growing the fixture from one to 41 matches and one to 30 posts with 41 visible comments/reactors. This tests query amplification, privacy and cursors, not scan cost or load capacity. Mobile Activity now uses 30-item cursor pages and an older-updates action, while bootstrap still includes its legacy unbounded match collection and capped stories. All three focused Activity browser checks passed in installed Chrome in 11.8 seconds with intercepted notification fixtures, no failures/skips (`artifacts/ui-activity-pagination`). The final combined API/browser suites passed 56/56 and 52/52; exact native scope is recorded in [verification](verification.md).

### Proposed growth tests

Use an explicitly owned disposable database and media directory, a separate API port and unmistakably synthetic fixtures. Verify the resolved database name and filesystem paths before seeding or cleanup. Never generate public fake activity or run destructive fixtures against the shared demo/tester database. Do not send load-test email or push to real recipients; use local adapters or controlled provider stubs. No new load-test tool needs installation merely to start the plan; the existing Node HTTP and PostgreSQL tooling can drive the first measured harness.

1. **Correctness baseline:** run API/privacy/migration tests and selected mobile journeys. Verify dataset, source commit, schema, resource limits and provider flags. All load tests assert data integrity and authorization as well as HTTP status.
2. **10K dataset:** populate realistic relationship/history distributions using disclosed assumptions. Run `ANALYZE`, capture `EXPLAIN (ANALYZE, BUFFERS)` for actual parameterized hot queries, then exercise state/bootstrap, Discover, feed pages, chat history, message retries, games and authenticated media. Begin with one client, warm caches and increase offered load gradually; record the rate actually reached.
3. **100K dataset:** retain the same manifest and scenario, increase data volume, and include sparse-match feed scans, heavily matched accounts, popular posts, long histories and simultaneous safety mutations. Change one optimization at a time and compare plans, query counts and tail latency.
4. **1M / 10M datasets:** proceed only on an environment with a recorded storage/memory budget and reviewed synthetic-data growth. Test data size independently of concurrency. Do not assume laptop throughput represents production; do not purchase resources without user approval. Abort and preserve evidence when resource or correctness limits are reached.
5. **Burst, soak and failure runs:** background/resume bursts, duplicate client IDs, connection resets, DB pool pressure, processing backlog, cleanup overlap and rolling/API restart. Later test two API instances, shared-worker claims and delivery privacy. Measure drains/recovery and duplicate notifications rather than assuming exactly-once external delivery.

Useful measurements: offered/completed requests and actions per second; p50/p95/p99 endpoint latency; error and timeout rate; query count and duration per request; pool wait/active count; advisory/row-lock wait; database CPU/I/O/buffers/temp files; Node event-loop lag and memory; upload/transcode latency; bytes/range requests; queue backlog; duplicate/retried actions; cleanup lag; reconnect recovery. Capture cold and warm runs separately and account for coordinated omission in a driver that waits for each response before scheduling more work.

The acceptance latency/error objectives are still a product/operations decision. Choose and record them before the run; do not select thresholds afterward to make a result pass. Stop immediately on any unauthorized media/content result, lost/duplicated committed action, answer-secrecy violation or destructive fixture-boundary failure. Report the first bottleneck and measured knee, not a guessed maximum-user count.

## Modular-monolith roadmap

| Stage                                               | Work triggered by evidence                                                                                                                                                                                                                                                             | What remains                                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Now / query foundation                              | Remove global lock use from pure reads only; batch projections; filter stories before limits; justify indexes; add bounded query/concurrency/privacy tests                                                                                                                             | NestJS, PostgreSQL, existing mutation lock and API contracts                                                       |
| Growth / measured 10K–100K datasets                 | Cursor collection APIs, lean bootstrap/deltas, request coalescing/backoff, module/controller boundaries, structured sanitized metrics, connection budgets and deadlines                                                                                                                | Server-authoritative matching, privacy checks and private media semantics                                          |
| Multi-instance operation                            | Shared private storage, upload authorization and bounded processing workers; deploy and failure-test the existing shared rate counters and deletion/push claims; establish connection budgets, graceful drain and compatible migrations                                                | One application repository and a modular monolith; workers may deploy independently without creating many services |
| Read growth / measured 100K–1M datasets             | Cache public-within-authorized-audience summaries/candidate sets with invalidation; always recheck current safety/access. Add read replicas only for reads that tolerate lag; current-match/media authorization and mutation checks stay authoritative                                 | PostgreSQL as the source of truth; coarse generation and exact filtering remain separate                           |
| Large measured history / 1M–10M registered datasets | Partition high-growth history/notification tables if plans, maintenance, retention and index sizes justify it. Improve candidate generation by explicit location/cohort indexes. Extract media processing, realtime or discovery only when its measured workload/ownership warrants it | No compulsory sharding, Kubernetes or microservice rewrite based on account count alone                            |

Do not cache a private feed globally or treat a signed media URL as indefinitely revocable. CDN/object delivery must retain private access and a defined block/expiry/revocation strategy; short-lived URLs have a revocation-window tradeoff that must be explicitly reviewed. Avoid media bytes through the API when a secure storage design is ready, while keeping current permission checks at authorization/delivery boundaries.

Typing/ordinary presence should eventually be ephemeral shared state, not permanent write amplification. Selected-match Ready to play is currently durable short-lived PostgreSQL state, not general online presence. Games 2.0 asynchronous invitations are implemented and Ready is advisory; broader presence remains future work.

## Gates and honest remaining work

- Stage 1 completed: code/schema/index inspection, bounded read-only component plans and local resource inventory. No high-volume test was executed.
- Query foundation: implemented at API checkpoint `a4d5193`; API build/typecheck and 13 isolated regressions passed, with 18 measured state query calls for both tested fixture sizes. The bounded 100-request read baseline completed without errors; Activity uses the additive page API with three focused browser checks passing. Combined API/browser verification passed 56/56 and 52/52; exact native scope is in [verification](verification.md). Production capacity remains unmeasured.
- Before multi-instance deployment: demonstrate privacy races, durable worker claims, shared storage, connection budget, graceful shutdown, migration/rollback and backup restore.
- Before claiming public readiness: finish the wider auth/security/moderation/ops review, real provider credentials and approved live-verification integration, actual Android/iOS and notification tests, operational ownership and production policy review.
- For every later result, attach commit, configuration, fixture manifest, raw metrics, errors, resource snapshots and recovery evidence. Mark capacity unknown when it was not measured.
