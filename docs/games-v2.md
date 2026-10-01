# Games 2.0: contracts and rollout

This is an additive beta implementation for two mutually matched adults. It uses the existing API, PostgreSQL transactions and mobile polling. It adds no AI, compatibility prediction, public game feed or presence provider. An optional Ready status is advisory; it never gates a Games 2.0 invitation, acceptance or answer.

## Seven implemented rules

| ID                        | Actual play                                                                                                                          | Completion                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `this-or-that`            | Each player locks five binary choices independently.                                                                                 | Both finish five choices.                                                                                    |
| `would-you-rather`        | Each player locks five playful binary choices independently.                                                                         | Both finish five choices.                                                                                    |
| `two-truths`              | First the host writes three distinct statements and privately identifies the invented one; the guest locks a guess. Roles then swap. | Two author/guess turns.                                                                                      |
| `guess-my-answer`         | Six alternating turns: the author locks a private choice from four options, then the other player guesses.                           | Six locked guesses.                                                                                          |
| `rapid-fire`              | Each player explicitly starts their own 90-second server timer and answers up to ten binary questions. They can finish early.        | Both finish or their started timers expire. An unstarted player can return later, within the session expiry. |
| `compatibility-challenge` | Each player answers six lifestyle and communication choices independently.                                                           | Both finish six choices.                                                                                     |
| `20-questions`            | Players alternate asking a custom or suggested question and answering it. Questions allow 180 characters; answers allow 500.         | Twenty actual ask/answer exchanges.                                                                          |

Locked answers are immutable. The mobile screen allows changing the current choice before tapping its lock button. Rapid Fire comparisons use only questions answered by both people, so an incomplete round cannot fabricate ten comparisons. Results describe actual shared/different choices or revealed turns. They do not assign a compatibility percentage or infer safety.

Definitions live in `apps/api/src/game-definitions.ts`, including immutable nested questions/options and explicit `definitionVersion`. Published content must receive a new version rather than editing the existing version. Retain the old registry entries for existing sessions. New sessions currently use definition version 1.

## Authorized routes

All four endpoints require the existing authenticated session. A targeted catalog requires a current mutual match; session reads/actions require participation and a current mutual match. A third party cannot read a session by guessing its UUID. Blocking or unmatching revokes subsequent reads and actions.

| Endpoint                             | Request                                           | Response                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/game-catalog?target=<UUID>` | Optional target UUID.                             | `{ enabled, games, recommendedIds, current }`. Four Quick Play recommendations; category controls expose all seven. `current` is a safe v2 projection or minimal legacy summary. |
| `POST /v1/games/:target/invite`      | `{ kind, clientId }`                              | Safe session projection, HTTP 201. Both players do not need to be online.                                                                                                        |
| `GET /v1/game/:id`                   | Session UUID.                                     | Safe current session, HTTP 200; directly loads older sessions independently of the newest chat page.                                                                             |
| `POST /v1/game/:id/action`           | `{ clientId, expectedRevision, action, payload }` | Safe current session, HTTP 201.                                                                                                                                                  |

Shared mobile types are in `apps/mobile/src/lib/gameV2.ts`. The session includes `id`, `host`, `guest`, `kind`, `version: 2`, `definition_version`, `revision`, timestamps, safe `definition`, per-player `view`, and completed `results`. It never returns raw `state_data`, event payloads or the partner's unrevealed answers. A phase describes the currently allowed action; it does not claim that the partner is online.

Quick Play recommendations use whether the authorized chat has fewer than ten messages. The query reads at most ten message IDs. This is a simple deterministic recommendation, not a learned inference about the relationship.

### Action payloads

| Action                                                 | Payload                                       |
| ------------------------------------------------------ | --------------------------------------------- |
| `accept`, `decline`, `cancel`, `start-timer`, `finish` | `{}`                                          |
| `choice`                                               | `{ questionId, choiceId }`                    |
| `submit-truths`                                        | `{ round, statements: [a, b, c], lie: 0..2 }` |
| `guess` for Two Truths                                 | `{ round, value: 0..2 }`                      |
| `set-answer`, `guess` for Guess My Answer              | `{ round, choiceId }`                         |
| `ask`, `respond`                                       | `{ round, text }`                             |

The server enforces the definition, action, turn, question, choice, input limits, timer and immutable answer state. It validates generic actions with an empty strict object and stores only validated, bounded private event payloads. Client flags cannot grant consent or skip a turn.

## State, retries and time

An invitation starts as `invited` and expires 24 hours after creation. Only its guest can accept or decline. Acceptance changes it to `active` and starts a seven-day session expiry. Either participant can cancel an invited or active game. Successful rules change it to `complete`; `declined`, `cancelled`, `expired` and `complete` are terminal. Expiring an incomplete game does not publish its private answers as a completed result.

One open game is allowed per matched pair, including legacy games. A pair-row lock is additive to the beta's existing global transaction lock. A v2 partial unique index also prevents two open v2 sessions. This preserves race safety; it is not proof of high-throughput operation. The capacity plan documents the remaining shared transaction bottleneck.

The server generates a monotonic revision for every meaningful accepted event, including invitation, acceptance, answer, cancellation, expiry and timer completion. A new action with a stale `expectedRevision` returns HTTP 409. The app refreshes the session and keeps the editable draft rather than silently replacing the answer.

For retries, reuse the original `clientId` and identical action/payload. Canonical payload hashes ignore object key order. A repeated accepted request returns the latest authorized projection without inserting a duplicate event or notification. Changing the payload behind a reused ID returns HTTP 409. An invitation ID is scoped to its host; action IDs are scoped to session and actor. Two opposing invitations resolve to one open session and one conflict. Legacy mutation endpoints reject v2 UUIDs, preventing the old request shape from changing a v2 session without its event/revision checks.

Rapid Fire uses independent absolute server deadlines; leaving or backgrounding the app does not pause them. Reads and actions reconcile elapsed deadlines. A minute maintenance job also processes at most 50 indexed `next_tick_at` rows per batch. Timer and session expiry events are idempotent. A client countdown is display only.

## Private projections and notifications

Binary choices reveal question by question only after both players lock that question. A Guess My Answer choice stays private until the other player locks the guess. Two Truths shows statements to the guesser but withholds the lie index until the guess. Completed results are deterministic and materialized once; projections still orient “you” and “partner” for the requesting participant.

The existing account export includes only the requesting person's choices, authored statements/lie, own guesses, own authored questions and own responses. It excludes the partner's authored private content. The report route accepts a participating game's ID and validates the reported target. It records server-generated session metadata without hidden answer values; a client cannot inject arbitrary game evidence.

Invitation, acceptance and completion notifications use the existing notification table with `resource_type: "game"`, `resource_id` and a unique dedupe key. The body contains no secret answer. Activity and chat cards open the same authorized room. The room derives its partner from the returned host/guest pair when a notification supplies only a game ID. Notification content and optional push transport do not prove delivery or online presence.

## Mobile recovery

Game → Chat returns to the existing conversation when it is already in the navigation stack. An existing unsent Chat draft takes priority over the discussion prompt, which is consumed without overwriting that draft. Opening a game from a notification without that conversation in history still opens the correct partner's Chat. Neither path sends a message automatically.

The picker is a scrollable bottom sheet inside Chat. Selecting a game opens an explicit Send Invite confirmation. Replay preselects the previous game but still requires Send Invite. “Try another game” opens the full chooser. No result action sends a new invitation automatically.

The room polls while focused and active, at four seconds for an active game and ten for invitations, backing off to at most 30 seconds after errors. It stops periodic polling for terminal or unavailable sessions and refreshes on focus/resume. A transport failure retains the last authorized game and offers refresh/retry. HTTP 403/404 removes both in-memory and persisted local drafts and shows Game unavailable.

Local drafts use native SecureStore and web **sessionStorage**, not publicly projected server state. Web sessionStorage is not an encrypted vault. Drafts and pending action envelopes are scoped to account and game, have a seven-day TTL, are limited to 20 stored entries and 6,000 characters each, and are validated before restoration. Logout/account/server changes clear them. Per-mount scopes plus account/global generations prevent queued or stale-component writes from resurrecting cleared content. The numeric store session key remounts game screens across authentication/server transitions.

An uncertain action keeps its ID and original payload for explicit retry. A restored pending action is visibly labeled and blocks new choices until resolved. Server validation or stale revision restores editability; an unknown network outcome retains the pending request. Game results can prepare a conversation prompt through an account/server/target-scoped in-memory bridge. Chat consumes the starter once on focus and fills only an empty composer; an existing draft takes priority and the user must explicitly send their message. Private answer text is never placed in route URLs.

Revoked access clears in-memory game content immediately. Persistent draft deletion is attempted and can fail if storage is unavailable; failures remain visible and need retry. See the [security foundation](security-foundation.md#client-session-binding-and-recovery) for credential/draft storage boundaries. A storage outage is not a guarantee of physical deletion.

## Rollout and rollback

Apply additive migration `007_games_v2.sql` through normal API startup migrations. It adds game definition/revision/private-state/deadline columns, event/result tables, indexes and notification resource fields. Legacy rows remain version 0/1 and retain their existing routes, readiness rules and answer contracts.

Set `ENABLE_GAMES_V2=true` on the current server binary to expose the new catalog and mobile feature. With the flag disabled, the catalog reports disabled, creation and non-cancel game actions return HTTP 404, and existing authorized v2 **reads and cancellation still work**. Maintenance continues reconciling deadlines. This is the safe beta rollback: disable the flag while keeping the migrated schema and compatible binary. Do not drop game/event/result tables or deploy an old binary that cannot safely project v2 rows. Re-enabling resumes valid sessions with their original definition versions.

## Verification and limits

The focused `apps/api/test/games-v2.test.ts` suite passed **10/10** against a temporary isolated PostgreSQL database and port 4106. The latest full focused run took 31.84 seconds and covered all seven mechanics, async consent without Ready, hidden answers, own-only export, report ownership/context, locked-answer immutability, duplicate and conflicting retry IDs, stale revisions, opposing invites, expiry events, server timers, blocked access, preserved legacy play and rejection of legacy mutations against v2 sessions. API build, mobile typecheck and scoped games ESLint passed.

The extended flag-off case also passed separately: authorized reads and cancellation remained available while acceptance and new invitations were disabled (one focused test, 10.01 seconds including setup/cleanup). The combined API suite passed 56/56 and the final browser suite passed 52/52, including thirteen Games 2.0 cases. See [verification](verification.md) for exact source hashes, scoped Android checks and the distinction between native host/API guest play and browser fixtures. This document does not claim completed physical iOS testing, production capacity, real push-provider delivery or comprehensive native background parity.
