# Security foundation — 1–2 October 2026

This implements the confirmed cleanup race and the bounded security work from [the full audit](full-audit-20261001.md). The audited baseline was `35fd0d3`. This document records source changes and isolated verification; it does not claim production approval, external-provider delivery, or measured large-scale capacity.

## Private media lifecycle

Orphan selection and deletion now run inside the existing social `tx()` advisory lock. A concurrent attachment commits before cleanup takes its orphan snapshot. Cleanup therefore cannot cascade a newly committed attachment using a stale snapshot. The existing ownership, purpose, current-match, discovery, block, suspension, and visibility checks remain in place.

Finishing upload metadata also takes this lock, while decoding/transcoding remains outside it. This closes the account-deletion gap between selecting that owner's file paths and the user/media cascade. A finishing upload waits for deletion to commit, then its failed ownership insert queues and discards the processed file.

Migration `009_security_foundation.sql` adds a private `media_deletion_jobs` ledger. Orphan cleanup and account deletion queue primary media and video-poster paths in the same transaction that removes database records. A rollback retains the account/media records and files; a commit retains the deletion work even if the process stops. Files are removed after commit. Account deletion returns success after the account and ledger commit, with immediate draining as a best effort.

Workers claim at most 20 due files per default drain, using `FOR UPDATE SKIP LOCKED` and a 30-second lease. Successful removal or an already missing file clears the job. Other filesystem failures retain a safe error code and retry with exponential delays of 10 seconds up to one hour. Retry attempts remain bounded numerically but the deletion obligation is retained until it succeeds; operators must investigate persistent failures. Paths are validated as children of `UPLOAD_DIR`; paths and file content are absent from public responses and aggregate metrics. Video posters are separate jobs so a failed primary-file removal does not lose poster cleanup work.

Rejected image/video processing, temporary video inputs, and failed media inserts also queue discarded files. A failed immediate drain does not replace the original upload error. If the database is unavailable before a job can be recorded, direct removal is attempted and failures surface. A simultaneous database and filesystem outage still requires operator storage reconciliation; no distributed-storage guarantee is claimed.

Authorized media delivery opens a file descriptor before sending headers and uses `pipeline()` for error and disconnect handling. It preserves authenticated access, private no-store caching, byte ranges, thumbnails, and revoked-access checks. A missing file returns a generic 404; an unavailable file returns a generic 503. An in-flight stream that has already opened can finish even if the pathname is subsequently removed, subject to operating-system semantics.

The original availability evidence was an isolated reproduction of the previous unhandled stream pattern, not a forced stat/unlink race against the complete live API. The new integration test exercises the actual authenticated API, range requests, missing-file 404, and a successful subsequent health request.

## Shared quotas and bounded uploads

`rate-limit.ts` replaces per-process IP maps with atomic PostgreSQL counters. Separate API processes sharing the same database consume the same counter. Counter keys contain hashes of scoped identifiers, not raw IP addresses or account IDs. The server uses HMAC with its existing server-only OTP/admin secret when present, otherwise SHA-256. This is pseudonymization, not a claim that hashes anonymize IP addresses. Expired counters are removed by maintenance.

The credential bucket applies to POST login, register, Google sign-in, forgot-password, and password-reset requests. Read-only auth configuration and fictional demo traffic remain in the general API bucket. Existing OTP account issuance, cooldown, attempt, and consumption protections are unchanged. Paths are normalized consistently with the existing case-insensitive Express routes. Rejected requests send HTTP 429 and a positive `Retry-After` value.

The following are provisional configurable beta guardrails, not priced benefits or capacity estimates:

| Environment variable          | Default | Scope                                          |
| ----------------------------- | ------: | ---------------------------------------------- |
| `RATE_API_PER_MINUTE`         |     600 | IP, general API                                |
| `RATE_AUTH_PER_MINUTE`        |      40 | IP, credential mutations                       |
| `RATE_OTP_SEND_PER_MINUTE`    |      10 | IP, verification send                          |
| `RATE_OTP_VERIFY_PER_MINUTE`  |      30 | IP, verification confirm                       |
| `RATE_UPLOAD_PER_MINUTE`      |      10 | Account, uploads                               |
| `RATE_PROFILE_PER_MINUTE`     |      30 | Account, profile/onboarding/settings mutations |
| `RATE_MESSAGE_PER_MINUTE`     |     120 | Account, messages/snaps/post shares            |
| `RATE_DISCOVERY_PER_MINUTE`   |     120 | Account, swipe/undo                            |
| `RATE_GAME_INVITE_PER_MINUTE` |      20 | Account, legacy and v2 invitations             |
| `RATE_POST_PER_MINUTE`        |      10 | Account, posts/stories                         |
| `RATE_COMMENT_PER_MINUTE`     |      60 | Account, comments                              |
| `RATE_REACTION_PER_MINUTE`    |     120 | Account, reactions                             |
| `RATE_REPORT_PER_HOUR`        |       5 | Account, reports                               |

Rates accept integer values from 1 to 1,000,000. Fixed windows start on their first request. Authentication, readiness, and the upload adult/email gate run before account admission. Proxy trust remains disabled: a deployment behind an approved proxy needs an explicit, tested trust policy before IP quotas can identify individual clients safely.

| Environment variable               | Default | Purpose                                                    |
| ---------------------------------- | ------: | ---------------------------------------------------------- |
| `MAX_UPLOAD_REQUESTS`              |       4 | Active admitted upload requests per API process            |
| `MAX_UPLOAD_REQUESTS_PER_ACCOUNT`  |       2 | Active admitted upload requests per account/process        |
| `MAX_MEDIA_PROCESSING`             |       2 | Active decoding/transcoding operations per process         |
| `MAX_MEDIA_PROCESSING_PER_ACCOUNT` |       1 | Active decoding/transcoding operations per account/process |

Concurrency values accept integers from 1 to 32. Middleware reserves capacity before Multer buffers the multipart upload, then releases it on response finish/close. Processing has an independent reservation held through completion, even if the client disconnects. Saturation rejects with 429 and a five-second retry hint; it does not enqueue work. The existing 20 MB file, 40-megapixel image, self-contained video-container, 30-second duration, and encoder timeout bounds remain. Operators should set both kinds of caps from measured memory/CPU budgets rather than raising them to their maximum.

## Push claims

The optional push adapter now claims notification delivery atomically in PostgreSQL. A separate private `push_delivery_claims` table keeps worker metadata out of the existing public notification projection. A dispatch handles at most 20 notifications and claims one at a time, with a 30-second lease and an eight-second provider timeout. Network/provider failures retry after 15 and 30 seconds; the third unsuccessful attempt becomes failed. Pending notifications expire after one hour. A crashed worker's lease expires and another worker can retry.

Before delivery the worker rechecks recipient notification consent, suspension, the current match, blocks, and the endpoint. A provider rejection only clears the endpoint if it is still the token that was sent. Push payloads remain generic and exclude names, messages, game answers, and media paths. Provider acceptance is not device-delivery confirmation. An ambiguous network failure or crash after provider acceptance can cause a duplicate on retry; the adapter provides bounded at-least-once attempts, not exactly-once delivery or receipts. There remains a small race between a consent change and an already initiated external request.

Push remains disabled by default. Tests replace the provider call with a synthetic local response; no real endpoint was contacted. Real SMTP, Google, and push delivery remain unverified without the deployment credentials/devices the user deferred. Liveness is unimplemented and no new verification provider was installed.

## Client session binding and recovery

Native credentials now use [the dependency-injected session helper](../apps/mobile/src/lib/sessionCredentials.ts). A single SecureStore item, `sangai-session-v2`, contains `{server, token}` together. A failed write cannot independently change the server binding while retaining another server's bearer token. Restoration validates the record and returns a token only for an exact server match; malformed v2 records fail closed rather than falling back to legacy credentials. This is a single-record storage design, not a claim of transactional guarantees across multiple native storage calls.

Legacy tokens migrate only when their saved binding matches the selected server. An unbound legacy token is eligible only at the configured default server. The atomic v2 write must succeed before restoration returns the token; optional legacy cleanup then deletes the legacy token before its binding. Clearing follows the same safety order: if legacy-token deletion fails, it retains both the legacy binding and the v2 record and reports failure. Once the legacy token is gone, clearing attempts both remaining deletions. A failed v2 deletion retains the original bound record, which cannot become a credential for a different server.

[The store](../apps/mobile/src/lib/store.tsx) serializes credential writes and clears local account/token state even if logout cannot reach the API or persistent credential deletion fails. [The application shell](../apps/mobile/src/app/_layout.tsx) retains a visible incomplete-clear warning with a **Clear saved sign-in** retry. Wholly unavailable storage cannot guarantee persistent logout: saved credentials may remain and must not be described as deleted. The warning asks the user to retry before closing the app.

Requests capture the session epoch, API server, and token at dispatch. Successful responses must still match all three before they are returned; a late 401 clears credentials only when it belongs to the current session. State refresh also checks its epoch and request sequence before replacing account data. This prevents a delayed response from an earlier account or server from populating the current session or signing it out. It does not cancel server mutations that have already been received.

Changing the API destination clears the current local session before the token can follow the new address. Address validation accepts only HTTP/HTTPS origins without embedded credentials, path prefixes, query strings, or fragments; HTTP remains available for the local emulator beta. Native notification navigation accepts the known internal chat destination, not arbitrary URLs. A configured origin is not an assertion that the remote server is trusted or ready for production.

Bootstrap catches invalid/unavailable storage and always completes readiness, offering sign-in instead of permanent loading. A valid token whose initial account fetch fails is retained: [AuthRecovery](../apps/mobile/src/components/AuthRecovery.tsx) offers retry and explicit sign-out. Protected signed-out routes return to the unambiguous `/welcome` route, while welcome and password reset remain public.

Session changes clear account-specific conversation starters and [game drafts](../apps/mobile/src/lib/gameDrafts.ts); when the previous account is unknown, cleanup invalidates all indexed drafts. Account/global generations invalidate previously captured draft scopes before queued deletion, so stale component writes cannot recreate cleared drafts. Game completion and unavailable-access responses clear the game form and pending action. Native drafts use SecureStore; web drafts use sessionStorage and are not encrypted by this implementation. Storage failures remain visible and require retry rather than a guaranteed deletion claim.

[Chat](../apps/mobile/src/app/chat/[id].tsx) remounts on session generation changes. A 401, 403, 404, or session-change error invalidates its access generation and removes loaded conversation/history, snap state, the unsent text, and pending-send/attachment state. Main conversation, earlier-history and snap requests capture that generation and ignore delayed success/error responses after revocation. Definitive Send failures clear access immediately and do not claim that the draft remains. Transient connection failures retain the current conversation and draft so the user can retry. The final browser checks include delayed history plus a main GET released after Send receives 403; see [verification](verification.md). These client guards do not recall content already delivered.

On 2 October, the final command `node apps/api/node_modules/tsx/dist/cli.mjs --test tests/session-credentials.test.ts` passed **10/10 dependency-injected tests** in **0.429 seconds**. They cover atomic binding, cross-origin rejection, safe legacy migration, malformed records, failed writes/deletions, retained bindings, attempted remaining deletions, and clear retry. These are deterministic storage-adapter failure tests; they are **not native SecureStore failure-injection evidence** or provider end-to-end proof. The client response/revocation protections above describe the implemented guards; they are separate from those ten helper tests.

## Verification and operational boundary

`npm run build --prefix apps/api` passed after the final media changes. The focused command `npx tsx --test --test-concurrency=1 test/security-foundation.test.ts` passed **7/7** on 1 October 2026 (5.34 seconds). It created and removed its own temporary PostgreSQL database and synthetic upload directory, used an ephemeral HTTP port, and did not mutate the shared beta database.

The tests prove:

- Actual `cleanup()` waits for a held attachment transaction, then preserves both legacy and carousel references and the file after attachment commits.
- Ledger work rolls back with database deletion, retains failed filesystem jobs, retries them, rejects paths outside private storage, and preserves a discarded encoded upload after an injected permission failure. A concurrent finishing upload waits for account deletion and leaves no orphan file or media record.
- Orphan video and poster deletion drains idempotently.
- The actual media endpoint rejects unauthenticated access, serves full/ranged bytes, rejects invalid ranges, handles missing files, and leaves the API alive. The metrics endpoint rejects an unauthenticated uppercase/trailing-slash route and its authenticated response omits the synthetic token, account ID, and storage path.
- Sixty concurrent credential checks through two independent limiter instances permit forty requests total, return retry hints on rejection, and reset after expiry.
- Account report ceilings, upload admission release, actual pre-Multer HTTP rejection, successful multipart admission, and the processing fallback ceiling work.
- Two push workers make one mocked provider call for the same notification; retries stop at three attempts and a blocked pair is skipped.

Migration 009 adds tables/indexes and does not rewrite account data or remove existing schema. Database backup and migration-checksum rules remain applicable. These foundations use the current modular monolith, PostgreSQL, local private storage, Sharp/FFmpeg, and optional Expo push adapter. They add no Redis, S3, Kafka, broker, or deployed cloud service.

The current local filesystem and deletion workers require all processes sharing this database to see the same private storage and compatible paths. Do not add replicas with isolated disks: a worker on the wrong disk could observe a missing file while another disk retains it. Storage replacement, comprehensive reconciliation, narrower mutation locks, async media workers, staffed moderation, provider verification, load tests, and production operation remain separate work. The production guard is preserved.
