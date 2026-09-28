> Historical discovery proposal (28 September 2026). The later user-authorized beta is implemented; see [current scope](beta.md), [README](../README.md), and [verification](verification.md). Proposed services and future features below are not claims of delivered functionality.

# Product and architecture review

Prepared 28 September 2026. This is a proposed direction for review, not a built application or validated business. Repository inspection found an empty `main` with no existing source or commits. The detailed plan preserves that distinction throughout.

Confirmed inputs: Android and iOS; Kathmandu, Bhaktapur, Lalitpur, Pokhara, Sydney, Melbourne, Perth and Brisbane; a small team building with Codex, reviewed by a senior developer and deployed by a DevOps engineer.

## A. Product analysis

The biggest risk is not technical scale. It is getting enough mutually eligible people to trust the service and respond to each other. Combining social networking, dating, communities and AI creates several cold starts and moderation burdens at once.

Recommend relationship discovery with small amounts of personal context. One profile contains intentions, interests, prompts and optional everyday photo/text moments. The proposed magic moment is receiving a specific introduction that makes someone want to answer. Measure two-way connection outcomes rather than scrolling time.

Personality prompts, conversation assistance and Nepali matchmaking already exist: see [Hinge](https://hinge.co/newsroom/convo-starters), [Bumble](https://bumble.com/en/features/opening-moves/) and [BiheNepal](https://bihenepal.com/). The opportunity is a hypothesis about better local trust, privacy and usable supply, not a claim of novelty. See [product analysis](product.md) and [evidence limits](research.md).

## B. New feature recommendations

Combine post replies and dating likes into a private contextual connection request. Offer explicit local/cross-border discovery, truthful city waitlists, clear visibility previews and a relationship-related pause. Later test mutual readiness to meet, optional quiet introduction mode and private comfort feedback.

Represent all eight cities from the outset, but open cohorts gradually. Treat Kathmandu/Bhaktapur/Lalitpur as a Valley metro area. Let actual recruitment and reciprocal candidate supply determine the first Australian launch city. Do not automatically mix local dating with overseas candidates.

## C. Features removed or rejected

Defer reels, stories, games, video, full communities/events and an AI matchmaker. Omit public comments, following and popularity counts from the MVP. They increase content demand and can encourage performance rather than connection. Reject fake activity, unsolicited DMs, anonymous random chat, attractiveness/caste scoring and precise nearby maps. Safety and basic privacy stay free.

## D. MVP definition

Invite-controlled native Android/iOS apps with adult gating, verified contact and recovery, profile/intentions/interests, broad city preferences, prompts/photos, optional photo/text posting, eligible discovery, contextual requests, mutual matching, reliable text chat, controlled push notifications, reporting/blocking, moderator case handling, pause/delete and minimal outcome telemetry.

No P0 payments or generative AI. Public comments, video and advanced features remain deferred on both platforms; parity means every shipped feature works consistently on both. See the [feature classification table](product.md).

## E. Architecture

One modular backend serves mobile apps and a small moderator interface. Separate API and worker processes share code and releases. PostgreSQL owns durable state; Redis supports jobs/rate limits; private object storage holds media. REST handles durable reads/writes, sockets provide updates, and push brings users back to the authorized app.

Canonical pair transactions prevent duplicate matches and block/send races. A transactional outbox and idempotent consumers make retries safe. No microservices or Kubernetes until measured needs justify them. See [architecture](architecture.md).

## F. Technology stack

Recommend React Native with Expo development builds and TypeScript; NestJS; PostgreSQL with Prisma/reviewed SQL; Redis/BullMQ; S3-compatible storage; a React/Vite admin interface. Use generated API contracts and a small pnpm workspace.

Flutter is a credible alternative. React Native's shared TypeScript tooling fits the stated team model, but actual native performance, library compatibility and reviewer capability must be tested before committing deeply. Neither framework eliminates Swift/Kotlin maintenance or real-device testing. See [the comparison](architecture.md) and [mobile plan](mobile.md).

## G. Database design

Separate private identity/contact data from public profile projections. Model users, profiles/preferences, cities, interests, prompts/posts/media, requests/pair states/matches/messages, blocks/reports/cases, verification, sessions, notifications, consent, deletion/export jobs and durable outbox events.

Database constraints enforce unique pending pair requests, one match lifecycle per pair and deduplicated messages. Communities, events, comments, reactions, following and subscriptions have deferred logical designs; their tables should not be created just because they appeared in the original brainstorm. See [database design](database.md).

## H. Docker design

Plan containers for API, worker, PostgreSQL, Redis, local private object storage and admin, plus one-shot migration/init jobs and optional development tooling. Add health checks, named volumes, non-root production images, configuration examples and devcontainer support in foundation.

The requested clone/copy/compose workflow will start backend/admin dependencies once implemented. Native apps run on devices/emulators. iOS compilation needs macOS/Xcode or a hosted macOS builder; Docker on Windows cannot replace it. Current documentation is explicit that Compose is not yet available. See [Docker design](docker.md).

## I. Security model

Server-enforced authorization; secure device credentials; rotating sessions; OTP fraud controls; risk-aware recovery; city-only location; upload quarantine; current-permission media delivery; case-scoped admin access; redacted telemetry; and auditable deletion across storage and processors.

Blocks apply to discovery, requests, chat, media and queued notifications. Verification indicates a specific check, never guaranteed safety. Initial chat uses transport/storage encryption and is not claimed to be end-to-end encrypted. A named moderation owner, response coverage and Nepal/Australia legal review are release dependencies. See [security](security.md).

## J. User journeys

New user: register → age/contact checks → profile/city/visibility → useful discovery or honest waitlist.

Dating: personal context → request → acceptance/match → conversation → optional mutually planned meeting.

Social: optional moment → controlled audience/moderation → private connection request.

Community, later: opt-in circle → activity → private RSVP → voluntary connection.

Safety: report/block → receipt → triage/action → resolution/appeal without exposing reporter identity.

Relationship success: pause discovery, optionally keep chat, provide optional feedback, export/delete or return later without pressure.

## K. Development roadmap

Finish user research and review this architecture; build secure native foundation; complete the core connection loop; run a small staffed pilot; expand cities based on reciprocal supply; add retention features only from evidence; then test AI and monetization separately. See [roadmap and release gates](roadmap.md).

## L. Major risks

Eight-city fragmentation, weak differentiation, privacy/outing, harassment/scams/minors, insufficient moderation coverage, senior-review bottlenecks, iOS testing delayed until late, uncertain store acceptance and provider costs. Population size does not prove dating liquidity. No validated market sizing, conversion benchmark or revenue forecast was established in this phase.

The prospective moat is trusted local density plus effective operations and useful introductions. It is not the feature count, a generic LLM or accumulating intimate data.

## M. Recommended first implementation milestone

Build and verify Android/iOS development clients and reproducible Docker services, then a small registration/session/profile/photo/privacy slice in isolated staging. Include basic reporting/blocking, account deletion and moderation access so privacy is testable from the beginning. Require actual device evidence, cross-user authorization tests, container persistence, CI and backup restore before expanding.

This is narrower than the MVP. It proves the native toolchain, developer workflow and safety foundation before feed, matching and chat complexity. No application coding should start automatically after this planning task.
