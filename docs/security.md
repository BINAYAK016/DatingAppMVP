# Security, privacy and safety operating model

Status: design, not an implemented or audited control set. Public beta must have a named safety owner, escalation coverage and tested moderation tools. Codex-generated controls require senior security review; DevOps handles deployment controls but does not replace moderation staff.

## Trust boundaries and threats

Protect identity/contact details, birth dates, relationship preferences, messages, profile/media visibility, verification evidence and administrator powers. Threat actors include scrapers, scammers, stalkers using legitimate accounts, account thieves, malicious uploaders, abusive users and privileged insiders. Main boundaries: device/API, API/storage, worker/providers, and admin/private data.

| Threat | Required mitigation and verification |
| --- | --- |
| Object ID enumeration / broken authorization | Resource-level authorization on every read/write and socket operation; cross-user negative tests for profiles, media, matches and reports |
| Phone OTP abuse / takeover | Per-contact/device/IP throttles, bounded retries, hashed expiring codes, generic responses, provider spend caps; test code reuse and concurrent verification |
| SIM swap / recycled number | Phone control is not identity; notify existing sessions of recovery, apply cooldown and step-up/manual review for suspicious recovery, revoke old sessions; do not restore intimate history solely on a new OTP after risk signals |
| Refresh-token theft | Platform secure storage, short-lived access tokens, rotating hashed refresh tokens, reuse revocation, session list/logout-all and reauthentication for sensitive account actions |
| Abuse through block races | Canonical pair transaction locking; invalidate sockets/requests; recheck on queued work and resource delivery; concurrency tests |
| Location stalking | Manually chosen city/metro only in P0, no precise coordinates/distance or background tracking; no live “nearby” map; inspect API and EXIF outputs |
| Scraping / unwanted outing | Authenticated limited discovery, bounded page/rate limits, no contact search, private sharing defaults, no public indexing or named dating invitations |
| Malicious uploads | Quarantine, strict type/byte/pixel limits, safe decoding/re-encoding, EXIF removal, malware/content checks, no serving originals before approval |
| Spam / romance scams | Rate limits, repeated-text/link and velocity signals, money-transfer guidance, friction for risk cases, human escalation; no claim detection catches all fraud |
| Moderator abuse | Separate admin login/MFA, least privilege, case-scoped evidence, audit trails and review of privileged actions; no unrestricted chat browsing |
| Leaked secrets / telemetry | Secrets manager and CI masking, redacted logs, no message text/session replay, dependency/secret scans, protected production access |
| Dependency/provider failure | Pin versions, review permissions/licenses, patch cadence, data-processing agreements, failure-is-hidden upload state and provider outage drills |

## Authentication and authorization

Proposed initial consumer authentication is phone OTP, subject to delivery/cost tests across Nepal and Australia. An optional verified recovery channel and manual recovery policy must exist before public launch. Never treat an SMS check as proof of legal age or a trustworthy identity. Neutral date-of-birth gate requires at least 18; suspected minors need immediate restriction and trained review. Select an age-assurance process after jurisdiction/provider review, without collecting government IDs by default.

Use TLS throughout. Refresh tokens are high-entropy, hashed server-side, rotated and stored in native secure storage. Sensitive account changes require recent authentication. Admin uses separate MFA-backed identity and narrow roles. If third-party social login is added, recheck store rules and implement equivalent platform options; it is not part of the default P0 scope.

Authorization is deny-by-default: identity owns editing; target visibility permits reading; current pair state permits contact; scoped admin role permits case actions. API serializers explicitly allow public fields. Neither client-hidden fields nor unguessable UUIDs satisfy this requirement. Test role escalation, bulk queries, exports, signed URLs and webhooks separately.

## Media and communication privacy

Use private buckets and quarantine/approved prefixes with separate service permissions. Presigned upload permissions are short-lived and bind an owner, key and permitted content size/type. For P0 reads, use an authenticated media gateway that checks current viewer/owner/pair visibility per request before streaming an approved derivative. This avoids reusable bearer download URLs that outlive a block. Later edge authorization can replace the gateway only with equivalent current-policy checks; an expiring URL alone is not instantaneous revocation.

Use private cache controls, purge app caches when block/deletion events arrive, and avoid broad CDN caches of private dating media. Data already delivered or captured cannot be reliably recalled; clearly explain that limitation in the product privacy guidance. Rate limits and watermarking, if ever tested, are not screenshot prevention.

Messages are encrypted in transit and at rest, with application envelope encryption for sensitive message/evidence fields where practical and keys managed separately. This is **not end-to-end encryption**. The initial model permits tightly authorized access to reported evidence and requires honest disclosure. Do not claim E2EE, and do not silently scan all chats with an LLM. A future E2EE design would need separate key management, multi-device and user-initiated evidence reporting work.

Default push content is generic. Jobs recheck blocks and notification settings before dispatch. Already accepted external push requests cannot be guaranteed recalled, which is another reason not to include sender/message details.

## Safety policies and operations

Publish rules prohibiting harassment, hate, threats, scams, sexual exploitation, impersonation and underage participation. Prohibit explicit sexual uploads in P0 to keep the content policy clear; allow ordinary consensual relationship discussion within rules. Support reports on profiles, posts, messages and accounts, including from a restricted historical conversation after unmatch/block. Provide an immediate block option without requiring a report narrative.

Moderation workflow: receive case → acknowledge → categorize severity → restrict/quarantine when warranted → human review with minimum evidence → action and reason → notify affected user/reporter appropriately → appeal → close or reopen. Actions include content removal, warning, temporary contact restriction, verification request, suspension and account removal. Report volume alone never establishes guilt; handle malicious reporting and keep a reversal path.

Proposed pilot operational targets, conditional on staffing: urgent exploitation/credible-threat cases page the on-call owner immediately and seek first human action within one hour; ordinary abuse within 24 hours; appeals within seven days. These are internal targets, not promised emergency response. Publish actual staffed coverage; cap admissions or suspend acquisition if coverage/backlog is unsafe. Automated acknowledgment is not resolution.

Assign a child-safety contact and a restricted legal-escalation procedure. Suspected illegal material requires trained handling, controlled evidence retention and legally appropriate reporting; do not have developers circulate or download it casually. Give moderators training, bounded shifts and access support. Nepal/Australia time zones make a single unstaffed inbox particularly risky.

Verification badges must state their scope: phone checked, photo checked, or another explicit procedure and date. None means “safe person.” Liveness/photo providers require consent, accessibility alternatives, false-rejection review, retention limits and breach assessment. Manual beta review does not justify claiming universal identity verification. Do not use public numerical trust scores.

Date safety P0 consists of accessible practical guidance: meet in a public place, arrange independent transport, avoid money requests and share plans with someone trusted if desired. Future plan-sharing must be a user-initiated action and must not disclose a partner's profile or live whereabouts automatically. The platform does not monitor emergencies or guarantee safe dates.

## Data minimization and retention proposal

These are engineering defaults to review with counsel and operations, not statutory periods. Document exceptions and ensure deletions cover processors and derived data.

| Data | Proposed retention/erasure |
| --- | --- |
| OTP challenges | Five-minute validity; purge expired records within 24 hours; retain only minimal fraud aggregates as justified |
| Active sessions | Thirty-day refresh lifetime as starting policy; immediate revocation on logout/delete; purge expired/revoked token material within 30 days |
| Orphan uploads / rejected non-illegal media | Remove after 24 hours / seven days unless tied to a documented appeal or preservation need |
| Profile, preferences, posts and media | Keep while account requires them; hide immediately on deletion; active-store removal within 30 days |
| Ordinary messages | Keep for active conversation need; proposed 12-month age limit; remove from ordinary access on closure and erase closed history within 30 days unless reported/preserved |
| Reports and restricted evidence | Proposed 180 days after case closure, shorter where possible; legal hold has a stated basis, owner and periodic review |
| Raw verification images/video | Prefer provider ephemeral processing; delete within 24 hours after decision where supported; no indefinite biometric templates without separately justified consent/legal review |
| Logs / analytics | Redacted service logs 30 days; pseudonymous raw events 90 days; retain only privacy-reviewed aggregates longer |
| Backups | Rolling 35-day policy; isolate access; deletions recorded in a replay ledger so a restore does not reactivate deleted accounts |
| Financial records, future | Retain only fields/time required by reviewed accounting and jurisdiction rules, separately from dating data |

An account-deletion job revokes access immediately and tracks each store: relational data, objects/derivatives, cache, pending jobs, search if added, notification endpoints and processors. Show status, exceptions and completion. Export requires reauthentication and a short-lived authorized download, not email attachments with intimate data. Maintain recovery drills that replay tombstones before restored services accept traffic.

## AI and analytics controls

P0 needs no external generative AI. Later profile assistance requires explicit purpose-specific consent and minimum fields; do not send another person's content merely because the requester can view it. Never send verification evidence or whole private chats by default. Set provider retention/training terms contractually; log costs and metadata, not sensitive prompts. Users approve every generated edit/message. Safety models assist human decisions and need false-positive monitoring.

Avoid third-party ad tracking, session recordings and screenshots of private screens. Analytics uses minimal event metadata. Sensitive demographic/relationship data are not an advertising asset. Access to per-user analytics needs a legitimate operational purpose and auditability.

## Launch policy review

[Apple guidelines](https://developer.apple.com/app-store/review/guidelines/) require attention to UGC controls, in-app deletion, personal-data/AI sharing and differentiation in dating apps. [Google UGC](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en-GB), [child safety](https://support.google.com/googleplay/android-developer/answer/14747720) and [deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111) also affect release. Build in-app deletion plus a public deletion-request page, published contacts/policies and a child-safety response process; verify exact submission requirements at release.

Counsel should assess Nepal's [Privacy Act](https://lawcommission.gov.np/content/12261/the-privacy-act-2075/), other applicable Nepal requirements, Australia's [Privacy Act coverage](https://www.oaic.gov.au/privacy/privacy-legislation/the-privacy-act), and [eSafety expectations](https://www.esafety.gov.au/industry/basic-online-safety-expectations) for the actual service and entity. Resolve cross-border processing, sensitive information, breach handling, age assurance, consumer/billing obligations and any registration duties. This document is a design worklist, not a legal compliance certification.

## Security acceptance before beta

Senior review of threat model and authorization matrix; integration tests for cross-user access and pair races; secure token/storage inspection on both OSes; upload bypass tests; OTP/recovery abuse simulation; report-to-action and appeal drills; deletion/export verification; secrets/dependency scans; staging restore and incident exercise. Findings must have owners and severity; critical unresolved privacy/safety issues block admission. Recheck after materially changing media, messaging, payments or AI.
