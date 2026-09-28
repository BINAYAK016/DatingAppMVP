# Implemented beta — 29 September 2026

The user authorized implementation after discovery, expanding the earlier P0 to include social posts, short videos, stories, snaps, games, circles, events and date planning. This document supersedes the scope limits in the September 28 proposals. Working brand: **Sangai** (together). City selection is manual; there is no precise location collection or AI.

## Product rules

Discovery shows selected profile fields and the chosen profile photo. Social posts/stories become visible only after a mutual match. Requests require recipient acceptance, with reciprocal city/gender/age preferences enforced server-side for discovery and new requests. Existing matches survive discovery pause and preference changes.

The Together feed contains your own content and your current matches' content. Comments and reactions from people you have not matched with are hidden, including when you share a match. Following is a private preference among matches. Videos have a Load video button, with no autoplay. Short videos are a filtered private feed, not a public recommendation network.

Stories last 24 hours. A direct snap grants its recipient one opening of up to 30 seconds; closing/backgrounding ends it early. Unopened snaps expire after 24 hours. Every media request, including byte ranges, checks current authorization. Screenshots, recordings and bytes already delivered cannot be revoked. An owner can independently publish their own media as a post; that post then follows post visibility. Expired items become inaccessible immediately; unreferenced files are swept after 24 hours.

Circles have 2–10 people and require **every pair to be mutually matched**, checked on creation and each read/write. One broken pair pauses the whole group's access until its remaining membership again satisfies the rule. Owners can close circles and members can leave. Adding members after creation is not implemented. A departed member's old posts/events are hidden from users no longer matched with that author. RSVP identities are limited to current members.

Three games—This-or-that, Would you rather, and Build a date—contain five choices each. Choices remain private until both players lock them, then cannot be rewritten. Shared-choice counts are playful prompts, not scientific compatibility scores. Date proposals require the invited person's acceptance; circle events have RSVP.

## Architecture shipped

| Area | Implementation |
|---|---|
| Mobile | Expo 57 / React Native 0.86 / TypeScript / Expo Router, shared Android and iOS screens |
| API | NestJS modular monolith, REST, server-side authorization |
| Database | PostgreSQL 17; relational `apps/api/src/schema.sql`; idempotent startup migration |
| Media | Private Docker volume behind authenticated endpoint; images re-encoded/metadata stripped; FFmpeg MP4 video, maximum 30 seconds and 20 MB input |
| Authentication | Scrypt hashes, random sessions stored hashed server-side; native SecureStore |
| Updates | Chat foreground polling every 3 seconds; social state every 12 seconds plus pull-to-refresh; 30-post cursor pages |
| Jobs | In-process expiry sweep and optional push dispatcher |
| Admin | Small same-origin HTML/JS console; operator key; resolve/dismiss/suspend and audit |
| Notifications | Persistent in-app inbox; optional Expo push adapter |
| Infrastructure | Multi-stage non-root API container, PostgreSQL, persistent volumes, health checks, dev container, CI |

The original proposal included Redis, S3 and separate workers. Private local storage and polling reduce emulator-beta setup. Social transactions use one PostgreSQL advisory lock for auditable privacy transitions, intentionally sacrificing throughput. Before growth, use ordered pair/community locks, durable jobs and scalable private media storage while preserving privacy tests. This is not a demonstrated million-user deployment.

## Optional remote push

In-app updates work without credentials. Device push is **off by default and unverified end-to-end**. Supply `EXPO_PUBLIC_EAS_PROJECT_ID`, configure FCM/APNs credentials and signed builds using [Expo's setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), then set API `ENABLE_PUSH=true`. Users opt in under You. Push content is generic and opens the inbox after sign-in.

The adapter stores one token per account, revokes on logout, rechecks match/block state, and retries at most three times. Provider acceptance is not device delivery. Multi-device endpoints, receipt polling, delivery-race hardening and durable retries remain release work.

## Safety and limitations

The 18+ birth-date gate is self-declaration, not verified identity. Other users never receive contact details, birthday or password hashes. Block/unmatch revokes new social/chat/media/game/group access. Reports are private to the reporter and operator; suspension revokes sessions. No AI, advertising, analytics or biometric provider is integrated.

The convenience export includes profile, authored post text, sent message text and reports. It is not yet a complete legal portability export of every media/game/RSVP. Account deletion removes live account data and owned files; minimal report/audit records can remain. Operator-created backups need a separate retention/deletion policy.

Compose ports bind to loopback and credentials are local-only examples. The server refuses `NODE_ENV=production`. Mobile HTTP exceptions exist for the local emulator and must be removed in a reviewed HTTPS release. Do not expose this beta publicly with default credentials.

Not shipped: AI, billing/boosts, paid events, referral campaigns, identity/email verification, password recovery, voice/video calling, voice introductions, public community discovery, algorithmic reels, automated scam/content classification, live location, offline sending, resumable uploads, full chat-history pagination, production observability, app-store submission or hosted production deployment. Recent chat/circle history is bounded. These are not represented by fake working buttons.

The senior developer should review session/authorization logic, migrations, edge cases and the native Android/iOS test matrix. DevOps should provision HTTPS, secrets, backups/restore, storage, durable jobs, monitoring, signing and rollback. The operator needs moderation staffing and final policies before external release. See [test plan](test-plan.md).
