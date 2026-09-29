# SANGAI — incremental redesign plan

Status: first redesigned beta implemented on `feat/sangai-redesign`, following the completed audit of `96bd8f3`. Product and pricing choices are confirmed. Android builds and smoke checks, source checks, migrations and six browser journeys have executed evidence. Native iOS, configured Google sign-in and the remaining native device matrix still require validation. See `verification.md` for precise limits.

## Confirmed requirements

**Discover → Match → Chat → Sangai → Date.** Four tabs, Discover first, shared native Android/iOS codebase. Serious relationships, marriage and casual dating have equal emphasis. Social content stays match-only. Stories and the only camera/Snap flow belong in Chat. Circles and their events leave the product. Plan a Date belongs to a conversation. No AI in the beta.

The first release contains three live games; four more follow. Readiness is temporary and visible only to the selected match. A session starts only when both are available and the invitation is accepted.

Likes stay hidden until both people swipe positively, including in API responses and notifications. Real beta testers require verified email/Google email, a declared adult birth date and completed onboarding; identity verification is deferred.

The user approved Free + Sangai Plus, with planned extra undos, optional lifestyle filters and future bonus packs. Previews show NPR 299/month or NPR 2,870.40/year and AUD 7.99/month or AUD 76.70/year, with a 20% annual discount. There is no checkout or active paid entitlement.

## Decisions before finalizing contracts

| Decision | Recommendation sent to the user | Status |
| --- | --- | --- |
| Incoming likes | User selected hidden likes; reveal only after mutual swipe | Confirmed |
| Real-tester access | Verified email/Google email, declared 18+, completed profile; no identity-verification claim | Confirmed |
| Payments | Subscription/pricing previews only; no checkout API | Confirmed: Free + Plus; regional monthly/annual totals above |

Questions already answered in the briefs are not reopened. More detailed pricing, growth, voice notes, read receipts and future adult-mode decisions can wait until those increments are relevant. Do not implement optional features merely because their table or screen could be added.

## Milestones and acceptance gates

| Order | Deliverable | Acceptance gate |
| --- | --- | --- |
| 0. Baseline and contracts | Audit, decision register, new route map, schema transition plan, baseline tests and a redesign branch | Decisions resolved; scope distinguishes shipped behavior from proposed behavior. Local backup and restore procedure prepared before data changes. |
| 1. Product shell | Blush/peach/lavender/white/charcoal tokens; Discover, Chat, Sangai, Profile tabs; move inbox and story rail to Chat; remove circle and standalone Play entry points | Default signed-in destination is Discover. No circle navigation or dead links. Camera is reachable only from Chat; library access remains for post/profile media. Existing valid accounts and matches still work. |
| 2. Identity and onboarding | Google/email auth, reset flow, verified-account gate chosen by the user, five resumable profile steps, section-based Profile editing | Incomplete or underage profiles cannot reach protected product APIs. Progress survives restart. Provider linkage, reset replay/expiry and privacy projections are tested. Real OAuth/mail configuration is clearly distinguished from local test fixtures. |
| 3. Discovery and match | Persisted like/pass/Super Like, profile detail, filters, action retry handling, safe undo, elegant match screen and selected incoming-like model | Two likes make exactly one match. Block/undo/race cases preserve consent. Button alternatives work alongside gestures. Loading, failure, paused, empty and exhausted states are distinct. |
| 4. Conversation and media | Chat list with previews/unread state, mixed timeline, bottom camera, attachment menu, photo/video messages, snaps and story viewer | Text retry remains idempotent; media/notification access is revoked on block/unmatch. Only one video plays when appropriate. Keyboard, permission denial, backgrounding and history paging work on mobile. |
| 5. First live games | Selected-match readiness, invitation cards, accept/decline/expiry, versioned session engine, three rulesets | No game begins without fresh availability and acceptance. Answers remain server-hidden until the rules allow reveal. Reconnect, timeout, cancel and block are tested with two clients. |
| 6. Sangai and dates | Virtualized paginated feed, visible-video autoplay with data saver, comments/replies, private saves and authorized share references; simple Plan a Date | No public content or audience widening. No bulk video download. Saved/shared items recheck current access. A date is proposed, accepted/declined or cancelled, with UTC time plus clear local timezone. |
| 6a. Subscription preview | Profile → plans, comparison, selected-plan summary and no-active-subscription state using user-approved prices | Clearly labeled preview. No card collection, checkout calls, successful-purchase simulation, real entitlement changes or paid-only identity reveal. |
| 7. Retirement and delivery | Remove retired circle/event API code, types, fixtures, obsolete docs and tests; complete versioned data migration; refresh policies and notification routes | Upgrade and rollback rehearsed on a disposable database; no orphan routes or old-client privacy bypass. Tests/lint/build/Docker verification pass. Android native journey recorded; iOS evidence recorded separately. Logical commits pushed. |
| 8. Remaining games | Four further game rulesets using the same invitation/session engine | Core journey is usable first. Each ruleset has tested reveal, disconnect and time-limit behavior; no second game engine or new tab. |

This sequence is milestone-based, not a deadline estimate. The senior developer reviews authentication, consent transitions, migration integrity and media authorization; the DevOps engineer reviews reproducible builds, secrets, backups, TLS, push credentials and deployment. Their review is part of the user's team plan, not something this document claims has already happened.

## Migration safeguards

1. Preserve the baseline branch/commit. Create a separate redesign branch from the verified source; do not force-push or overwrite unrelated work.
2. Before schema changes, create a local restricted PostgreSQL backup and media snapshot. Never commit account exports or media into Git. Do not use `docker compose down -v`.
3. Introduce an ordered migration ledger with checksums and transactional execution. Baseline existing databases deliberately; `CREATE TABLE IF NOT EXISTS` alone does not handle a redesign.
4. Expand additively: fields, identity links, profile media, discovery actions, invitation/session lifecycle and message types. Backfill without changing user IDs, match IDs or privacy scopes.
5. Existing matched pairs stay matched. Pending written requests may become one directed Like; remove their incoming identity projections/notifications under the hidden-like rule. Declined/ended/blocked pairs remain closed. Never infer a reciprocal Like from social activity or circle membership.
6. Preserve private media ownership and distinguish profile, post, story and chat permissions. Reusing an asset must not accidentally make a snap public to other matches. Review saved/shared references after unmatch/block.
7. Retire circle runtime access and old deep links safely. Keep circle rows in restricted backup during the rollback window; do not convert them into posts or chats with different audiences. Drop the five retired tables only in a later validated contract migration.
8. Convert legacy game records explicitly: completed games are history; unfinished asynchronous games cannot become accepted live sessions silently. Keep old display data separate from new playable state.
9. Verify row counts, identifiers, relationships and unauthorized reads in a restored test database. Expand account export/deletion for every new data category.
10. Roll back additive releases using the previous image and compatible schema. A later destructive migration requires the tested backup/restore path and a maintenance boundary; do not pretend a down migration can reconstruct deleted private content.

## Current implementation status

Milestones 0 and 1 are implemented. Milestones 2–6 and 6a have working source: verified email/reset/onboarding, hidden swipes, mixed chat/media, the first three live games, private feed interactions/date planning, and the approved subscription previews. Google needs real client configuration. Separate circle/event/Follow routes are removed, while their stored rows remain restricted for rollback. Profile editing and profile gallery use the same media authorization pipeline.

Fresh PostgreSQL integration and migration checks pass (16 tests), as do six browser journeys including two-client live-game consent, full email onboarding through Mailpit and swipe/undo/tap regression coverage. Native Android compilation, installation and a limited smoke journey pass; final native gesture/scroll retesting remains incomplete. Do not equate browser or bundle checks with native iOS parity. The four further games remain the approved next increment.

Keep rollback/privacy checks and deployment review in milestone 7. Exact future undo quotas and paid-plan fulfillment remain unimplemented commercial decisions; they do not block this display-only preview. Global transaction locking, polling, private local media and a single API process are explicit small-beta tradeoffs, not claims of scalable live infrastructure.
