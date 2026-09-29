# SANGAI — incremental redesign plan

Status: proposed implementation sequence following the code audit of `96bd8f3`. Product round one is confirmed; round two is pending. No redesign source or database changes are claimed by this document.

## Confirmed requirements

**Discover → Match → Chat → Sangai → Date.** Four tabs, Discover first, shared native Android/iOS codebase. Serious relationships, marriage and casual dating have equal emphasis. Social content stays match-only. Stories and the only camera/Snap flow belong in Chat. Circles and their events leave the product. Plan a Date belongs to a conversation. No AI in the beta.

The first release contains three live games; four more follow. Readiness is temporary and visible only to the selected match. A session starts only when both are available and the invitation is accepted.

## Decisions before finalizing contracts

| Decision | Recommendation sent to the user | Status |
| --- | --- | --- |
| Incoming likes | Show who liked you free in Discover; chat still requires mutual choice | Awaiting answer |
| Real-tester access | Verified email/Google email, declared 18+, completed profile; no identity-verification claim | Awaiting answer |
| Payments | Free core and initial games, server abuse limits, pricing tests later | Awaiting answer |

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
| 7. Retirement and delivery | Remove retired circle/event API code, types, fixtures, obsolete docs and tests; complete versioned data migration; refresh policies and notification routes | Upgrade and rollback rehearsed on a disposable database; no orphan routes or old-client privacy bypass. Tests/lint/build/Docker verification pass. Android native journey recorded; iOS evidence recorded separately. Logical commits pushed. |
| 8. Remaining games | Four further game rulesets using the same invitation/session engine | Core journey is usable first. Each ruleset has tested reveal, disconnect and time-limit behavior; no second game engine or new tab. |

This sequence is milestone-based, not a deadline estimate. The senior developer reviews authentication, consent transitions, migration integrity and media authorization; the DevOps engineer reviews reproducible builds, secrets, backups, TLS, push credentials and deployment. Their review is part of the user's team plan, not something this document claims has already happened.

## Migration safeguards

1. Preserve the baseline branch/commit. Create a separate redesign branch from the verified source; do not force-push or overwrite unrelated work.
2. Before schema changes, create a local restricted PostgreSQL backup and media snapshot. Never commit account exports or media into Git. Do not use `docker compose down -v`.
3. Introduce an ordered migration ledger with checksums and transactional execution. Baseline existing databases deliberately; `CREATE TABLE IF NOT EXISTS` alone does not handle a redesign.
4. Expand additively: fields, identity links, profile media, discovery actions, invitation/session lifecycle and message types. Backfill without changing user IDs, match IDs or privacy scopes.
5. Existing matched pairs stay matched. Pending written requests may become one directed Like; declined/ended/blocked pairs remain closed. Do not derive a reciprocal Like from a follow, comment, story view or circle membership.
6. Preserve private media ownership and distinguish profile, post, story and chat permissions. Reusing an asset must not accidentally make a snap public to other matches. Review saved/shared references after unmatch/block.
7. Retire circle runtime access and old deep links safely. Keep circle rows in restricted backup during the rollback window; do not convert them into posts or chats with different audiences. Drop the five retired tables only in a later validated contract migration.
8. Convert legacy game records explicitly: completed games are history; unfinished asynchronous games cannot become accepted live sessions silently. Keep old display data separate from new playable state.
9. Verify row counts, identifiers, relationships and unauthorized reads in a restored test database. Expand account export/deletion for every new data category.
10. Roll back additive releases using the previous image and compatible schema. A later destructive migration requires the tested backup/restore path and a maintenance boundary; do not pretend a down migration can reconstruct deleted private content.

## Verification and next action

At this planning milestone, API/mobile type checks and mobile lint pass. The inspected branch matches origin. Both project Docker services are stopped; integration and native journeys have not been rerun during this audit.

After the pending choices are answered, update the decision register and the target requirements, then start milestone 1. Do not treat this document, the previous green wireframe or a successful type check as proof that the redesigned app has shipped.
