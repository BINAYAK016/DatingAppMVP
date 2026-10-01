# Full application audit and Games 2.0

**1 October 2026. Baseline: `35fd0d3`, branch `feat/sangai-redesign`.** Initial Stage 1–2 findings below were recorded before implementation. Status/evidence will be updated as fixes are verified. Existing uncommitted Meet Me audit/design documents are preserved; their proposed features are not installed capabilities.

## A. Executive summary

Sangai is a functioning native cross-platform private beta built with Expo/React Native, NestJS and PostgreSQL. It already has real email OTP, mutual matching, match-only chat/feed/stories/snaps, three consented games and date invitations. The implementation is a modular single deployment. There is no deployed Redis, object-storage CDN, WebSocket service, durable job queue, live-selfie service or paid checkout.

The most urgent confirmed defect is a **media cleanup race that can delete a newly attached post image**. An isolated database reproduction used the actual cleanup/claim functions and observed loss of both the media and attachment rows. The next priorities are story eligibility before limits, asynchronous/retry-safe games, bounded batched data reads and request/lifecycle recovery. Current global locking, local media processing, in-memory rate limits and polling prevent a credible horizontal-scaling claim.

Preserve the working consent/privacy boundaries while making focused changes. There is no evidence that this laptop beta can serve one million or ten million users. Registered users are not concurrent users; [capacity planning](capacity-plan.md) must distinguish measured results from hypothetical traffic. Live verification and real Google/SMTP delivery remain external-configuration gaps, not working features to preserve.

## Complete system inventory

“Works” below means source implementation plus the scoped evidence described later, not full native parity or a security guarantee.

| Component | Current implementation | What works | Broken / fragile | What fails at scale | Keep | Refactor | Eventually replace / add |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Frontend | Expo57/RN0.86/React19, native Router screens; supplementary browser export | Four tabs, keyboard-aware compose, virtualized feed/chat list, private media components | Conversation timeline uses ScrollView; transient reload can clear history; overlapping requests | Long mounted histories and frequent full-state refresh | Native shared UI and four tabs | Focused, deduplicated requests; virtualized long timelines; narrow state queries | Add specialised list/state tooling only if measured |
| Backend/API | NestJS12/Express5, TypeScript, REST `/v1`, module files in one service | Validated auth/social/media/game operations; server audience checks | Single global mutation lock also covers reads; broad controller | Unrelated requests serialize; high query fanout | Modular monolith and server ownership | Separate read snapshots from mutations, explicit service boundaries | Per-pair locks before replicas; extraction only from measured workload |
| Database | PostgreSQL17.7, pool10, checksum-checked immutable migrations | Relational references, canonical pairs, idempotent messages/swipes, upgrade checks | Several missing access-path indexes, N+1 projections | Large scans, hot lock, unbounded matches/reactions/report reads | PostgreSQL and additive migrations | Measured indexes, batching, bounded cursor APIs | Read replicas/partitioning only after evidence |
| Authentication | scrypt password, hashed seven-day sessions; native SecureStore; real OTP | Issuance/attempt/expiry/single-use limits, recovery, secure Google-token validation | No restricted Change email; secure-storage bootstrap has no catch | General in-memory limiter is per process; synchronous auth workload | Existing identity/session architecture | Recovery and destination-safe email correction | Shared limiter/observability; credentials for actual external delivery |
| Profile/verification | Five saved steps, private DOB/adult declaration, reciprocal preferences, gallery | Existing profile edit and current adult/email checks | Form-heavy flow, photo order collisions, no orientation controls or real liveness | Rich unbounded payloads if extended carelessly | Canonical identities/preferences and private media | Separate Meet Me increment; display projection and atomic ordering | Approved real liveness provider; no invented result |
| Storage/media | Private Docker volume, authenticated streaming, Sharp/FFmpeg in API | Image/video validation, EXIF removal, purpose/ownership/audience checks | Confirmed orphan cleanup race; streaming error window; processing concurrency not bounded | API memory/CPU/disk; local files prevent arbitrary replica routing | Private authorization and validators | Cleanup synchronization, bounded processing and stream failure handling | Private object store, processing workers, audience-aware CDN delivery |
| Realtime | Foreground HTTP polling; pair-scoped temporary game readiness | Durable messages survive disconnection; no unsafe socket rooms exist | Full state every12s, chat/game every3s; overlapping polls | Request fanout and repeated expensive hydration | Durable REST reconciliation | Lightweight focused polling and backoff | Authenticated socket/pubsub only when real need is measured |
| Notifications | PostgreSQL in-app notifications; optional Expo push off by default | Generic private payloads and match/preference checks | Push claims are not multi-worker-safe; game notices lack deep-link resource | Duplicate/lost work and polling costs | Durable notification rows and privacy checks | Idempotent resource-aware notification/outbox contracts | Shared queue, retries and multi-worker-safe claims |
| Background jobs | Interval cleanup and optional push inside API; SMTP outside auth lock | OTP delivery failure semantics and pending-code security | No durable queue or separated worker lifecycle | Restart loses scheduling; CPU work blocks API capacity | Current idempotent business boundaries | Explicit workers, outbox, bounded retries and cleanup | Shared queue with measured backlog/SLAs |
| External services | Mailpit locally; Google adapter without credentials; optional Expo push | Local mail demonstrates actual OTP validation | Real inbox/OAuth/push/liveness unverified | Provider quotas/outages/retention require operations | Configuration-based adapters | Truthful availability, retries and secrets configuration | Approved providers only; no automatic paid account creation |
| Docker | API/Postgres/Mailpit Compose, healthchecks, loopback ports, persistent volumes | Reproducible local services and data preservation | Beta refuses production; no resource budgets or independent workers | One host and local media, shared failure domain | Development Compose and volumes | Explicit production deployment plan and limits | Managed storage/database and multiple instances after prerequisites |
| CI/CD | GitHub Actions: API tests, mobile type/lint, all-platform export | Repeatable source checks with isolated PostgreSQL | No browser/native/device/deployment/load gates | Bundles alone cannot catch runtime/signing/migration rollout issues | Existing checks | Add tested server regressions, browser export QA, container checks | Staged deploy, health/rollback, signing and physical-device matrix |
| Monitoring/logging | Nest logs and health route; basic error console output | Simple startup/health visibility | No structured request metrics/traces or dashboards | Diagnosis of slow queries/queues/provider failures | Health/readiness distinction | Redacted structured logs and measured metrics | Aggregation/alerts/tracing as deployment grows |
| Testing/build | API integration/migration suites, Playwright journeys, native Android mirror | Existing consent, media, OTP and journey regressions | Cold test startup transient; iOS runtime and real providers pending | No representative high-cardinality/load proof | Existing tests and native build | Add races, retry/reconnect, game rules, query budgets, load harness | Device CI/capacity environments when available |

Sources: [mobile package](../apps/mobile/package.json), [API package](../apps/api/package.json), [state](../apps/mobile/src/lib/store.tsx), [database](../apps/api/src/db.ts), [social/state](../apps/api/src/social.ts), [media](../apps/api/src/media.ts), [games](../apps/api/src/games.ts), [Compose](../compose.yaml), [CI](../.github/workflows/checks.yml), [current verification](verification.md).

## B. Application health

| Area | Baseline status | Practical limit |
| --- | --- | --- |
| Authentication | Working locally; needs configuration/recovery improvement | Mailpit verified; configured Google/external SMTP not verified |
| Profile | Working existing flow; needs improvement | Meet Me, identity display, atomic reorder and liveness not implemented |
| Discover / matching | Working; scalability risk | Reciprocal preference and hidden-Like rules exist; candidate scanning/global state need bounded evolution |
| Chat | Working; needs recovery/performance improvement | Cursor history exists; mounted timeline and polling are expensive |
| Stories | Working privacy checks; confirmed availability bug | Global limit precedes eligibility |
| Games | Three working games; needs major improvement | Readiness and short expiry prevent requested async use; retry outcomes weak |
| Sangai | Working; scalability risk | Virtualized/keyset feed; comment/reaction projection is expensive |
| Notifications | In-app working; push unverified/scalability risk | No durable multi-worker queue guarantee |
| Media | Working validation/access; confirmed data-loss defect | Cleanup race and unbounded processing must be fixed |
| Plan a Date | Working local invitations | Existing proposal/accept/decline/cancel consent should remain |

## C–F. Prioritised problems

### F01 — P0 / CRITICAL: newly attached media can be deleted

- **PROBLEM:** cleanup can remove a media object after a legitimate attachment commits.
- **WHY IT HAPPENS:** orphan selection/deletion runs outside the transaction lock used by claim and attachment mutations; a deletion waiting on a row can use the earlier reference snapshot.
- **USER IMPACT:** a successfully published image disappears.
- **BUSINESS IMPACT:** loss of user content and trust.
- **TECHNICAL IMPACT:** media deletion cascades post-media rows and clears the legacy post attachment.
- **RECOMMENDED FIX:** serialize orphan selection/deletion with attachment mutation, then remove files after commit; test the exact concurrent sequence. Preserve this invariant when replacing global locks with ordered narrower locks.
- **STATUS:** confirmed in an isolated owned database; implementation pending at this initial report.

### F02 — P1 / HIGH: matched stories can be crowded out

- **PROBLEM:** newest200 global stories are selected before current-match checks.
- **WHY IT HAPPENS:** the SQL limit precedes authorization filtering in JavaScript.
- **USER IMPACT:** active matched stories may be missing even when access is permitted.
- **BUSINESS IMPACT:** social activity looks empty as unrelated usage grows.
- **TECHNICAL IMPACT:** unnecessary reads and per-story match/profile queries.
- **RECOMMENDED FIX:** authorise eligible stories in SQL before limiting; batch projections; test more than200 unrelated stories plus one eligible older story.
- **STATUS:** confirmed source defect; implementation pending.

### F03 — P1 / HIGH: global read/write serialization and N+1 payloads

- **PROBLEM:** state/feed/media/conversation paths acquire the same global lock as mutations; state expands every match and many posts with repeated queries.
- **WHY IT HAPPENS:** auditable beta correctness was prioritised with one transaction helper.
- **USER IMPACT:** one slow request delays unrelated conversations and actions.
- **BUSINESS IMPACT:** infrastructure spend rises before traffic grows substantially.
- **TECHNICAL IMPACT:** low effective concurrency and query fanout; unlimited match/reaction reads.
- **RECOMMENDED FIX:** consistent read-only snapshots for genuinely read-only paths, batched projections and reasoned indexes; keep mutation/privacy locks until per-pair semantics have regression proof. Add paginated replacement contracts without quietly truncating an older caller's usable data.
- **STATUS:** confirmed architecture bottleneck; no current capacity claim.

### F04 — P1 / HIGH: game invites and retries do not fit async play

- **PROBLEM:** both must repeatedly mark Ready; invites expire after2min, active games after10min; requests lack durable invitation replay identifiers.
- **WHY IT HAPPENS:** current three games were built around previously agreed paired availability.
- **USER IMPACT:** people in different schedules cannot reliably play; a lost acknowledgement can be mistaken for a failed action.
- **BUSINESS IMPACT:** games add friction instead of starting conversation.
- **TECHNICAL IMPACT:** full-chat polling to find one game and poor versioned-history/rule contracts.
- **RECOMMENDED FIX:** Chat Quick Play, durable invitations, explicit acceptance, dedicated session reads, versioned rules, retry-safe actions, meaningful recovery and Game→Chat bridge. Readiness remains optional advisory information, not proof of online presence or blanket permission.
- **STATUS:** source-confirmed; latest brief supersedes simultaneous readiness for async games.

### F05 — P1 / HIGH: media streaming/processing availability risks

- **PROBLEM:** files are opened lazily after a stat; stream errors/aborts lack complete handling; simultaneous uploads can allocate large buffers and multiple FFmpeg processes.
- **WHY IT HAPPENS:** the API owns local file delivery and synchronous processing.
- **USER IMPACT:** missing-file races or upload bursts can interrupt otherwise unrelated use.
- **BUSINESS IMPACT:** avoidable outages and failed uploads.
- **TECHNICAL IMPACT:** potential unhandled stream errors plus unconstrained memory/CPU.
- **RECOMMENDED FIX:** handle stream/client aborts and test disappeared-file behaviour; reject excess processing before buffering when possible. Later move validated work to bounded workers and private object storage.
- **STATUS:** stream error risk identified; classify reproduction/evidence separately from the confirmed cleanup race.

### F06 — P1 / HIGH: horizontal safety prerequisites are missing

- **PROBLEM:** general rate counters, job scheduling, push claims and local media are tied to one API instance.
- **WHY IT HAPPENS:** the project is explicitly a local beta with production mode blocked.
- **USER IMPACT:** naive replicas produce inconsistent throttles or job outcomes.
- **BUSINESS IMPACT:** a deployment change can weaken abuse controls or duplicate notifications.
- **TECHNICAL IMPACT:** replicas alone are not a scaling strategy.
- **RECOMMENDED FIX:** shared atomic limiter, transactional outbox/worker claims, storage abstraction and shared media; validate two-instance behaviour before deployment. Do not add20 services or remove the production guard to conceal these gaps.
- **STATUS:** known beta limitations, now prioritised as scaling prerequisites.

### F07 — P1 / MEDIUM: overlapping/stale requests and transient errors

- **PROBLEM:** polls overlap under slow networks; a failed chat poll clears loaded history; secure-token bootstrap has no failure recovery.
- **WHY IT HAPPENS:** timers issue requests independently and component loads clear data on every exception.
- **USER IMPACT:** flashing empty conversations, lost in-memory history, possible stuck loading and stale account responses.
- **BUSINESS IMPACT:** core interaction feels unreliable.
- **TECHNICAL IMPACT:** needless concurrent requests and account/lifecycle races.
- **RECOMMENDED FIX:** deduplicate GETs, invalidate late responses on account/server change, catch secure-storage startup errors, back off focused polling, retain loaded history on transient errors and clear it on definitive access revocation.
- **STATUS:** source-confirmed; implementation pending.

P2: improve game-card hierarchy, durations, short instructions, reactions/haptics/accessibility; add redacted metrics/feature flags/CI coverage. P3: realtime presence/typing, recommendation ranking, read replicas, partitioning and service extraction when measurement justifies them. Missing real liveness/Google/SMTP is explicitly tracked separately because provider/credential decisions remain pending.

## G. Games 2.0 proposal

Preserve Discover, Chat, Sangai and Profile. Games live in a Chat **Play together** entry and Quick Play sheet, with short explanation, duration and You+match label. Recommend deterministically using whether the conversation has messages and prior games—never private answer analysis or AI.

Implement the seven briefed rules with stable definitions/versioned sessions: This or That, Would You Rather, Two Truths & a Lie, Guess My Answer, Rapid Fire, Compatibility Challenge and20Questions. Asynchronous invitations permit return later; only explicit acceptance starts play. Avoid false “away” claims based on absence of a Ready flag. Per-player Rapid Fire can be paced without claiming simultaneous realtime.

Store durable meaningful actions/results and bounded typed state, not every animation or timer tick. Keep secret answers/lie indices private until their defined reveal. End with Talk about it, Play again and Try another game. A discussion prompt is chosen by the user; it is not automatically sent as their message. Report/block/unmatch remain available and revoke access consistently.

## H. Architecture roadmap

See [scalability findings](scalability-audit.md) and [capacity/load plan](capacity-plan.md). Sequence: fix correctness → bounded batched reads/indexes → shared abuse/job/media prerequisites → benchmark with high-cardinality fixtures → horizontal instances → measured read/realtime scaling → extraction only for a real bottleneck. No arbitrary registered-user milestone triggers sharding.

## I. Testing results at the initial report

Baseline API suite:19/25 passed; six authentication cases could not run because their isolated child server did not become healthy within its20s startup window and produced no logs. Focused rerun of those six passed6/6 in6.0s without source or timeout changes. Treat this as a startup/harness transient, not six demonstrated authentication defects. A combined final suite is still required after changes.

The cleanup race was proved with actual compiled functions in a uniquely named temporary database; temporary fixtures were removed and live data was untouched. Production-dependency audits for API and mobile reported0 known advisories on this date; that is not a security guarantee.

Existing native/browser evidence is historical in [verification](verification.md). No new full native journey, actual liveness, configured Google or native iOS evidence is claimed by this initial audit. Record actual checks for each implementation increment; do not turn planned tests into passed results.

## J. Remaining work

Implement and verify the prioritised defects and game redesign, then update this report with final source/build evidence. Measure a scoped load baseline and document limits; do not claim10M-user capacity. Meet Me implementation and real biometric/provider decisions remain a separate pending increment; this audit preserves its proposed plan and no-AI boundary. Native iOS, configured external auth/email/push, production operations, physical-device permissions and large-scale testing remain required before relevant readiness claims.
