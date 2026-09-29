# SANGAI redesign — product and architecture audit

Audit date: 29 September 2026. Inspected baseline: `96bd8f34ca1772be7fff29d60ed0ffb908d0c61d`, branch `feat/native-social-beta`. Local HEAD and the fetched remote branch match. The checkout was clean before this audit.

**Status: design and migration planning. The redesigned application is not implemented yet.** This document describes the existing code separately from the target. The new user briefs supersede the previous circle-based product direction and green wireframes. The existing beta documentation still describes the running code.

## Product direction and decisions

The core promise is to help Nepali adults discover someone, choose each other, become comfortable talking, and arrange a date. The journey is **Discover → Match → Chat → Sangai → Date**. It describes a possible journey, not a compulsory sequence: a pair may plan a date directly from Chat without posting, playing or visiting the feed.

### Confirmed by the user

- Four main areas: **Discover, Chat, Sangai, Profile**. Discover is the first screen after completed onboarding.
- Android and iOS remain native products with a shared React Native codebase.
- Remove separate private circles and their event system. The old every-pair-matched group rule belongs to the retired circle feature; it does not create groups inside the new Sangai feed.
- Social posts and stories remain limited to current mutual matches. Camera and Snap belong only inside Chat. Sangai supports media-library uploads, not a second camera experience.
- Live games require both matched people to be available and an explicit invitation acceptance. No automatic game start.
- **Serious relationships, marriage and casual dating receive equal emphasis.** Do not rank intentions morally or imply that a casual intention permits unsolicited sexual content.
- **Deliver the core journey with three live games first, then the remaining four.** Design all seven within one extensible engine.
- **Availability is a temporary Ready to play status shared only with the selected match.** It does not expose a general online or last-seen badge.
- **Likes remain hidden until a mutual swipe.** No incoming-likes list, actor-bearing notification or API payload may reveal a sender before matching. Super Likes respect the same boundary.
- **Real beta testers need verified email or verified Google email, an 18+ declaration and a completed profile.** Identity verification is deferred; local fictional demo accounts stay separate. Email verification does not prove identity or age.
- No AI in this beta. No explicit sexual game content. Future premium/adult mode is an architectural extension, not a current feature or monetization commitment.
- Supported cities remain Kathmandu, Bhaktapur, Lalitpur, Pokhara, Sydney, Melbourne, Perth and Brisbane. Support for a city is not a commitment to launch or spend on acquisition in all eight simultaneously.

### Pending product decisions

- The beta monetization decision remains unanswered in round two. Incoming likes are hidden; the real-tester gate is verified email/Google email, declared adulthood and completed onboarding.
- Fine details such as Super Like limits, unread/read-receipt policy, the follow filter, launch cohorts and premium pricing remain proposals. They are not silently approved features.

## 1. Current architecture

| Layer | Actual implementation | Consequence for redesign |
| --- | --- | --- |
| Mobile | Expo 57, React Native 0.86.3, React 19.2.3, TypeScript, Expo Router; 17 screen files plus 2 layout files | Keep the native foundation. Change navigation and domain screens incrementally. |
| Client data | One Context store fetching `/v1/state` every 12 seconds in foreground; chat polls every 3 seconds; game screen every 5 seconds | A small beta works, but all screens are coupled to one large payload. Split queries by screen before richer media and presence. |
| API | One NestJS application, one controller in `main.ts`, functional modules in `auth.ts`, `social.ts`, `interactions.ts`, `media.ts`, `push.ts` | It is a monolith with functional separation, not yet a fully separated set of Nest domain modules. Extract modules as their features change; avoid a rewrite. |
| Database | PostgreSQL 17.7; 22 tables; startup executes `schema.sql` using `CREATE TABLE IF NOT EXISTS` and a few `ALTER`s | There is no versioned migration ledger. Introduce it before destructive changes. |
| Concurrency | One transaction-scoped advisory lock serializes social reads and writes | Preserve privacy correctness, then narrow locking to pairs/sessions. Presence heartbeats must not serialize the whole application. |
| Auth | Email/password, scrypt hashes, hashed random session tokens, native SecureStore; optional fictional demo accounts | Reuse sessions; add provider identity linkage, email verification/reset and incomplete-onboarding gates. |
| Media | Authenticated API backed by private Docker volume; image re-encoding; short-video transcoding; authorization on range requests | Preserve authorization and decoding defenses. Add thumbnails and bounded loading rather than public URLs. |
| Background work | In-process media/session cleanup and optional push dispatcher | Adequate local topology; durable jobs and multi-instance delivery are later scale work. |
| Infrastructure | Docker Compose API + PostgreSQL; private DB/media volumes; CI and devcontainer | Keep reproducible local infrastructure. There is no deployed Redis, S3 or separate worker despite older proposal documents. |
| Admin | Same-origin HTML/JS moderator console, operator key, report resolution and suspension | Retain and expand content references as new interactions appear. |

The existing Android beta has a historical native verification record. iOS native behavior and real push delivery remain unverified. The web build is a supplementary test surface, not the mobile product.

## 2. Every current screen and its destination

Paths below are relative to `apps/mobile/src/app`. Modal states are noted separately; they are not counted as extra route files.

| Current route (17 total) | Current responsibility | Redesign disposition |
| --- | --- | --- |
| `index.tsx` | Welcome, email login, basic signup, demo accounts, local server settings | Split clean auth states and five-step onboarding. Keep demo/server controls in a beta-only area. |
| `(tabs)/index.tsx` | Together feed, stories, composer, following/video filters, older/newer pages | Rename Sangai; move stories to Chat; virtualize feed and simplify filters. |
| `(tabs)/discover.tsx` | Profile card, city chips, Next person, full-profile link | Make default tab; real like/pass/Super Like gestures and buttons, server action history, undo and separate empty states. |
| `(tabs)/circles.tsx` | Circle list and creation entry | Remove. |
| `(tabs)/play.tsx` | Match selection and three game choices | Merge catalog into the selected conversation's attachment menu. No fifth tab. |
| `(tabs)/you.tsx` | Own profile summary, counts, settings, export/delete/logout | Rename Profile; show full identity and own posts; nest preferences and settings. Remove circle count. |
| `inbox.tsx` | Incoming requests, match list, notifications | Promote conversations to Chat tab. Remove incoming-request identity display because likes stay hidden; use a compact activity entry for authorized notifications. |
| `profile/[id].tsx` | Another person's profile, written request, following, safety | One reusable full-profile presentation with viewer-specific actions. Discovery shows chosen profile fields; social posts require a match. |
| `chat/[id].tsx` | Text chat, snaps, game cards, date cards, safety | Retain core; chronological mixed timeline, profile shortcut, bottom camera and secondary attachment menu. |
| `compose.tsx` | One shared composer in post/story/snap/avatar modes | Reuse upload helpers; make post, story and chat-media entry contexts explicit. Camera only in Chat. Profile/Sangai use the library. |
| `story/[id].tsx` | Story viewer, delete own story, chat shortcut | Keep under Chat; group multiple stories by author and show expiry/progress. |
| `game/[id].tsx` | Five binary questions, answer lock, shared reveal | Replace screen logic with reusable invitation/lobby/round/reveal states. Retain server-hidden answers. |
| `plan.tsx` | Date proposal OR circle event form | Remove circle mode. Rename Plan a Date inside Chat; add type, date/time and optional venue. |
| `new-circle.tsx` | Select members and create circle | Remove. |
| `circle/[id].tsx` | Circle discussion, events, RSVP, leave | Remove. |
| `edit-profile.tsx` | Long form with identity and discovery preferences | Split into editable sections using the same fields as onboarding; retain existing answers. |
| `safety.tsx` | Report, block, unmatch, report history, blocked accounts | Keep; use focused action sheets from profiles/content/chat plus a Profile safety screen. |

The snap viewer is currently a modal inside Chat. The app also serves moderator and policy pages from the API; these are supporting operational surfaces, not mobile tabs.

## 3. Current features and actual gaps

| Area | Working foundation in source | Missing or materially different from the redesign |
| --- | --- | --- |
| Authentication | Signup, login, logout, adult birth-date validation, session restoration | Google login, password reset, verified email, multi-step onboarding and a complete-profile gate are absent. |
| Profile | One photo, name/age/city, bio, intent, interests, one prompt, gender and age/city/gender preferences | No photo gallery/video profile, structured prompts, languages/lifestyle, verification workflow or complete profile view with its own paginated posts. |
| Discovery | Reciprocal filters, selected profile fields, request/accept matching, paused discovery | No swipe recognizer, persisted passes, mutual directional likes, Super Likes, undo history or match animation. “Next person” can cycle back. |
| Chat | Persistent text, idempotent send, foreground refresh, one-open snaps, game and date cards | No ordinary persistent photo/video messages, voice notes, live availability, read-receipt model or unified mixed timeline. Messages are limited to the latest 100 without older-history paging. |
| Social | Match-only text/photo/video posts, likes, flat comments, private following, 30-post cursor pages | No saved posts, nested replies, sharing, continuous virtualized scroll or visibility-controlled autoplay. Filters currently apply after receiving each page. |
| Stories/snaps | 24-hour stories and unopened snap expiry; a snap gets one opening up to 30 seconds | Stories are on Together; camera is exposed in post/story/avatar composer contexts. Snap sending itself already originates from Chat. |
| Games | This or That, Would You Rather, Build our Date; five binary answers per player; hidden answers until both submit | “Invite to play” inserts a game immediately. No acceptance, availability, invitation expiry, session lifecycle, timed rounds or game-specific input models. |
| Dates | Proposal, accept/decline/cancel; invited guest controls acceptance | Venue is required, types are free text, time entry is manual, and circle events share the form. |
| Safety | Match checks, block/unmatch, reports, suspension, export/delete, authenticated media | No verification workflow, per-audience exclusions, content-specific moderation workflow or complete export of all feature data. |
| Notifications | In-app activity, optional Expo push adapter | Push credentials/device delivery unverified; current deep links point to the general inbox. |

## 4–7. What stays, leaves, merges and needs redesign

**Keep:** shared native codebase; session security; adult gating; manual broad locations; reciprocal eligibility; active-match authorization; block/unmatch semantics; private image/video pipeline; retry-safe text sends; story/snap expiry; date consent; report/admin controls; Docker, CI and privacy tests.

**Remove:** circle list/create/detail screens; circle-only routes/types/state/seed fixtures and event RSVP behavior; standalone Play tab; circle statistics; old group copy; circle branch in the planning form. Remove associated database tables only after migration validation and a restricted backup. Do not silently republish circle content into Sangai.

**Merge:** inbox conversations into Chat; stories and their creation into Chat; game catalog and date form into conversation actions; own identity and edit sections into Profile; shared media preparation into one internal service with context-specific screens. Reusing a service does not require showing every action in every composer.

**Redesign:** swipe matching; auth/onboarding; visual tokens and layouts; Chat timeline; live-game lifecycle; Sangai feed performance and interaction model; Profile content/privacy; date types/timezones; notification links.

**Recommendation requiring a product decision:** remove the separate Follow relationship/filter, because every feed author is already a match. A future mute control can manage noise without another social graph. Retain the old data during migration until this choice is resolved.

There is only one social feed in source; its “Short videos” view is a filter. There is also only one media composer. Avoid claiming or solving duplicates that do not exist. The real problem is overlapping responsibilities and too many entry points.

## 8. Updated database/domain design

Keep PostgreSQL and existing identifiers. Separate API domain responsibilities before unnecessarily splitting every entity into a new table. The following is a target design, not an executed migration.

| Existing entity | Target change and migration rule |
| --- | --- |
| `users`, `sessions` | Preserve accounts and session hashing. Add server-owned onboarding status/version, structured intent and validated optional profile fields. Allow a deliberately incomplete signup state without inventing an adult birth date; restrict it to account/onboarding APIs. Complete profiles must meet the adult and profile requirements. |
| New `auth_identities` | Unique provider + subject linked to a user; support email/Google and later providers. Google accounts must not receive fabricated passwords. Linking an existing account requires proof of ownership. |
| New `auth_challenges` | Hashed, expiring, single-use email verification/password-reset challenges with purpose and consumed state; rate-limit issuance/redemption. Never log or return real reset secrets as normal API responses. |
| New `profile_media` | Ordered owned-media references and a primary-photo designation. Backfill from `avatar_id`. Media visibility must distinguish chosen profile media from social/chat media. |
| `users.preferences` | Retain validated preferences initially, adding intention preferences and explicit cross-city/cross-country choices. Do not expose preferences or private birth dates through discovery projections. |
| New `discovery_actions`; existing `connections` | Store directed pass/like/Super Like actions with idempotency and undo history. Keep canonical pair matches and ended/declined history. Convert a legacy pending request only into its sender's like; never invent the recipient's consent. Preserve existing matches. |
| `messages`, `snaps` | Preserve text and snap records. Add typed timeline items and references for ordinary media, game invitations and date cards, plus participant read cursors for unread counts. Page by a stable server cursor. Keep snaps distinct so ordinary media does not inherit snap expiry accidentally. |
| `posts`, `media`, `reactions`, `comments` | Preserve author/media ownership and current-match access. Add reply parent linkage if enabled; validate it belongs to the same post. Add pagination on the server and media metadata/thumbnails. No separate short-video content table is needed. |
| New `saved_posts` | Private user/post references, never a copied public version. Recheck original access when displaying a saved item; unmatch/block can make it unavailable. |
| `stories` | Keep 24-hour expiry; group by author in Chat. Add audience exclusions only after privacy decisions. |
| `games` + new `game_invitations`, `game_moves` | Reuse `games` as sessions; add ruleset version, state, current round and server deadlines. Invitations have invited/accepted/declined/expired/cancelled states. Moves have participant/round/action idempotency and game-specific validation. Preserve completed legacy games as history; never present old asynchronous sessions as live accepted games. |
| New short-lived availability leases | Store freshness and selected-match scope, not an unrestricted last-seen history. Invitations and acceptance must recheck both participants and current match authorization. Readiness ends when the user leaves, backgrounds or the freshness lease expires. |
| `plans` | Keep identifiers and consent states; expose as dates. Add date type, optional venue and timezone identifier alongside UTC scheduled time. Do not create a duplicate dates table just to rename the UI. |
| `notifications`, `reports`, `audit`, `blocks` | Preserve; add validated resource references and new event kinds. Recheck access before sending notifications or following links. Expand export/deletion to all new entities. |
| Verification records | Add provider/reviewer, check type, status and timestamps when the gate is agreed. Email verification and self-declared adulthood are not proof of identity. Do not store identity documents by default. |
| `circles`, `circle_members`, `circle_posts`, `events`, `rsvps` | Retire from runtime and remove through a versioned contract migration after backup and rollback checks. Five tables belong exclusively to the removed feature. |
| `follows` | Retain only until the Follow decision and migration are settled. Do not add another follower system. |

Static game definitions stay in versioned code, with a common rules interface and validated per-game payloads. Do not add billing, boosts, an adult content library, AI tables or venue bookings for hypothetical future features.

### State transitions that need explicit contracts

- **Match:** two current, eligible directional likes create one canonical active match atomically. Racing likes and retries must not create duplicate notifications. Blocking wins over stale client actions.
- **Hidden likes:** directional Like/Super Like records are private to their actor until mutual matching. Remove legacy incoming-request projections and sender-bearing notifications from the new API. Hiding only the screen is insufficient.
- **Undo:** reverse only the actor's latest eligible discovery action before it has produced a match. A completed match uses the explicit unmatch flow. Never undo another person's decision or resurrect an ended pair.
- **Live game:** available → invite → recipient acceptance → validate both leases → active rounds → reveal → complete. Decline, timeout, disconnect, backgrounding, block and suspension have explicit transitions. The server owns timers and secret answers. A foreground screen alone is not reliable availability.
- **Date:** proposed → accepted/declined; either participant may cancel under the permitted state rules. Editing an accepted time/location must create a new proposal requiring acceptance.
- **Post sharing:** if enabled, share an in-app reference only when the receiving match can also view the original post. Never expand its audience or expose private media with a public link.

## 9. Navigation and screen architecture

```text
Account access
  Welcome → Google / Email → Sign in or Create account → Reset password
  Incomplete profile → 5-step onboarding → Discover

Discover                 Chat                   Sangai               Profile
  Swipe cards              Story rail             Match-only feed      Full identity
  Full profile             Conversations          Post composer        Own posts
  Like / Pass / Super      Conversation           Comments/replies     Edit sections
  Undo / filters             Camera / Snap        Saved posts          Preferences
                             Media library        Post options         Privacy/safety
                             Games                Vertical video       Settings
                             Plan a Date
                             Profile / Safety

Likes stay hidden until mutual matching. No Circles or separate Play tab.
```

Proposed onboarding: (1) identity and adult birth date; (2) city and who to meet; (3) intention; (4) at least one chosen profile photo and a short personality prompt; (5) interests, preferences and review. Languages, work/education and lifestyle are optional editable additions. Save progress and resume. Existing accounts fill missing fields rather than recreating their identity.

Use consistent nouns in the app: Discover, Chat, Sangai, Profile, Plan a Date. Reduce the current repeated decorative headlines when they hide the screen's purpose. The supplied tagline is “Meet people. Build connections. Find your together.”

**Brand finding:** repository assets contain a green/cream heart-and-leaf mark and green native tokens; the previous wireframe uses that palette. No supplied blush/lavender reference asset was found in the inspected project. The new written brief supersedes those colors. Reuse the mark's geometry and build a restrained blush/peach/lavender/white/charcoal token proposal; label precise color values as design proposals until reviewed. Do not invent a replacement logo or claim the old wireframe matches the new brief.

## Product judgment and commercial tradeoffs

These are hypotheses based on this product and code audit, not validated market research or revenue forecasts.

| Decision | Options and benefits | Main risk | Recommendation / status |
| --- | --- | --- | --- |
| Core differentiation | Trusted discovery plus better conversations; or a broad social-video destination | A feed can compete with the reason people joined; small match sets mean limited content | Prioritize the transition from match to a two-way conversation. Match-only content supports that. |
| Intent positioning | Relationship-led; or equal serious/marriage/casual emphasis | Ambiguous intentions create mismatched expectations | User chose equal emphasis. Show stated intent and let users filter. |
| Games rollout | Seven at once; or shared engine with three first | Seven names hide several different input, timing and reveal systems | User chose three first. Design all seven; release in two increments. |
| Availability | Partner-specific Ready to play; or opt-in badge to all matches | Live-only play is harder across timezones and can expose activity | User chose temporary partner-specific readiness. Keep explicit game acceptance and do not expose last-seen activity. |
| Feed video | Autoplay all media; or only the visible item with data-saving controls | Bandwidth, memory and accidental audio; autoplay alone does not create connection value | One muted visible video, release off-screen players, no bulk downloads; data saver can require a tap. |
| Compatibility | Percentage score; or factual overlaps | A number can imply an unsupported scientific claim | Show shared interests and declared intentions, not an invented percentage. Game similarities are conversation prompts. |
| Follow graph | Separate follow action; or current matches with later mute controls | More state and explanation for little benefit in a private dating feed | Recommend no separate Follow layer; decision pending. |
| Sharing | Public/external share; or authorized in-app reference | Original author may not expect an expanded audience | Keep content inside its original visibility rules. Do not add public redistribution. |
| Launch footprint | All supported cities at once; or concentrated recruited cohorts | Sparse reciprocal matches make the whole social layer quiet | Cohort density needs validation. Keep all eight cities supported; decide acquisition sequencing in the growth round. |

### User simulations

| Person | What would help | Failure to avoid |
| --- | --- | --- |
| Shy user | A profile prompt and a short mutually accepted game inside Chat | Forcing games or making them wait alone in an unaccepted session |
| Social poster | A simple post and a clear audience label; a comment can become a conversation | Follower counts and public-style engagement promises in a small private network |
| Serious relationship seeker | Explicit intention, editable profile, meaningful prompts and comfortable date consent | Treating time spent scrolling as the only measure of success |
| Casual dater | Equally clear intention and respectful mutual choice | Assuming intent waives boundaries or gives permission for explicit messages |
| Privacy-conscious user | Broad city only, audience clarity, discreet notifications and fast block/report | Exposing unmatched commenters, last-seen activity or saved copies after access ends |
| Nepali abroad | Explicit city preferences and dates displayed in the relevant timezone | Assuming Nepal and Australia are online together or silently widening distance preferences |
| New user with zero matches | Useful Discover and honest Chat/Sangai empty states with a clear next step | Empty-feed landing, fabricated posts, fake matches or strangers' content to fill space |

### Feature value and costs

Ratings are relative judgments for a small team; they are not measured outcomes.

| Area | User / return value | Revenue potential | Differentiation / network effect | Strategic role |
| --- | --- | --- | --- | --- |
| Auth + onboarding | Necessary access; profile quality can improve later interactions | Indirect conversion | Low by itself | Reliable entry and clear intention |
| Discover + matching | Core acquisition of connections; return depends on relevant supply | Optional future convenience features; unresolved | Familiar mechanic; value depends on reciprocal local/city cohorts | Primary activation engine |
| Chat + snaps/stories | Core communication; replies are a natural return reason | Core access should be tested free before any paywall decision | Medium when privacy and context are excellent; pair-level interaction | Main relationship-building surface |
| Sangai feed | Helps matches learn about each other; value is uneven across user types | Ads are unproven and may work against a private experience | Potential differentiation after enough real matches; no public viral assumption | Support conversations |
| Live games | Potential help for hesitant pairs; uplift unproven | Optional future game packs, not beta billing | Content is easy to copy; integrated consent and ease matter more | Test conversation lift |
| Plan a Date | Clear value when a pair is ready; successful dates may reduce app use | Future venue partnerships need evidence | Modest differentiation; offline outcomes matter | Help users meet |
| Profile + safety | Trust and control are foundational | Indirect trust; safety controls should not depend on payment | Trust must be earned operationally | Protect the entire product |

| Area | Development complexity | Infrastructure cost | Moderation cost / safety exposure |
| --- | --- | --- | --- |
| Auth + onboarding | Medium; provider/reset integration is new | Low locally; email/provider operations later | Account abuse, age declarations and misleading verification claims |
| Discover + matching | Medium/high; concurrency, undo, quotas and eligibility | Low/medium until candidate queries scale | Spam, unwanted contact, misleading profile media |
| Chat + snaps/stories | High for mixed media, delivery and lifecycle | Media storage/transcoding/bandwidth dominate text | Private harassment and report evidence; expiry needs clear boundaries |
| Sangai feed | Medium/high; virtualized media and audience-aware interactions | Medium/high with video | Every added media format and reply surface needs reporting |
| Live games | Medium/high; new invitations, leases, timing and multiple rulesets | Low for short choice payloads; active connections require discipline | User-written games need reporting; pressure and leaked activity must be avoided |
| Plan a Date | Low/medium using existing consent model | Low without bookings/maps integrations | Sensitive meeting details and unwanted invitations |
| Profile + safety | Medium/high; authorization crosses every feature | Low/medium, higher with external verification | Ongoing operator responsibility, not a one-time screen build |

A sensible learning goal is whether matched pairs exchange a two-way conversation and voluntarily progress to a game or date invitation. Measure game invite acceptance and completion alongside block/report rates and performance. Do not collect private message bodies for analytics. Metric definitions and consent are design work, not authorization to install trackers.

## 10. Implementation order

See the companion migration plan for acceptance gates. Recommended order:

1. Resolve the two short decision rounds and freeze product contracts; preserve baseline and create versioned migrations.
2. Establish the new design tokens and four-tab navigation; remove circle surfaces and move Chat/stories/game/date entry points.
3. Complete auth, resumable onboarding and full Profile, including the selected verification gate.
4. Replace requests with directional like/pass/Super Like actions, safe undo and match confirmation.
5. Finish Chat timeline, library media, one Chat camera, story/snap viewers and focused actions.
6. Add consented live-game lifecycle and the first three game rulesets.
7. Redesign Sangai's paginated media feed and authorized interactions; simplify Plan a Date.
8. Remove retired backend paths/data contracts, validate migrations/rollback, test Android and iOS, and record actual results.
9. Add the remaining four games only after the core is usable and the first engine is proven.

## Seven-game design

All games require an active mutual match, both participants' scoped readiness and an accepted invitation. They are optional conversation starters and return to the same chat.

| Game | Interaction and reveal | Proposed delivery |
| --- | --- | --- |
| This or That | Both pick one of two options per round; reveal after both lock | First three |
| Would You Rather | Both choose a playful scenario; reveal and offer a conversation prompt | First three |
| Two Truths & a Lie | Author submits three statements and privately marks the lie; partner guesses, then reveal; swap roles | First three; user-written statements retain report controls |
| Guess My Answer | One player privately commits an answer; partner predicts; reveal after both actions | Next four |
| Compatibility Challenge | Both answer preferences; show agreements and differences without an overall compatibility percentage | Next four |
| 20 Questions | Turn-taking prompts with a shared stop/skip action; no forced completion of twenty rounds | Next four |
| Rapid Fire | Short server-timed rounds; distinguish unanswered rounds from mismatches | Next four |

The exact first-three lineup is a recommendation; the user approved the staged count. The old Build our Date content can inform Plan a Date rather than become an eighth parallel game. Historical games remain identifiable as historical data.

The engine contract defines game ID/version, input validation, legal transitions, turn/timer policy, reveal projection and completion rules. Future content modes can add eligibility/entitlement requirements through that contract. Do not add explicit content, paid unlocks or claims of verified adulthood in advance.

## Engineering boundaries

- Keep NestJS/PostgreSQL and private Docker media for the local beta. Extract Auth, Profiles, Discovery, Chat, Social, Games, Dates and Safety services as their code changes; retain one deployable API.
- Replace all-purpose state refresh with focused, paginated endpoints and typed client contracts. Apply filters before pagination. Do not build the match list from a capped discovery-candidate query, as the current `/state` implementation does.
- Add authenticated targeted live events for games/Chat with server-authoritative state and reconnect synchronization. PostgreSQL can hold short-lived readiness leases for the single-instance beta; add shared pub/sub only when multiple API instances require it.
- Preserve privacy tests while moving the global social lock to ordered pair/session locking. Do not place frequent presence updates behind a whole-product lock.
- Retain one media pipeline, add bounded thumbnail metadata, virtualize lists, pause/release off-screen players and keep private cached content scoped to the authenticated account and current authorization.
- Provider secrets stay server-side. Google OAuth IDs, mail delivery, signed iOS builds and FCM/APNs require real configuration to verify; a local fallback must be explicitly marked test-only.

## Evidence and verification

Executed during this audit: fetched origin; verified clean starting tree and matching local/remote baseline; API and mobile TypeScript passed; mobile lint passed with no warnings; inspected Compose state (both project services are stopped). No database was migrated and no app runtime was restarted for the audit. Integration/native tests were not rerun; historical results are in `docs/verification.md` and must not be represented as fresh evidence.

Source anchors at the inspected commit:

- [Five-tab layout](https://github.com/BINAYAK016/DatingAppMVP/blob/96bd8f3/apps/mobile/src/app/%28tabs%29/_layout.tsx), [state store and polling](https://github.com/BINAYAK016/DatingAppMVP/blob/96bd8f3/apps/mobile/src/lib/store.tsx).
- [Schema](https://github.com/BINAYAK016/DatingAppMVP/blob/96bd8f3/apps/api/src/schema.sql), [transaction and match guards](https://github.com/BINAYAK016/DatingAppMVP/blob/96bd8f3/apps/api/src/db.ts), [social queries](https://github.com/BINAYAK016/DatingAppMVP/blob/96bd8f3/apps/api/src/social.ts).
- [Games, chat and dates](https://github.com/BINAYAK016/DatingAppMVP/blob/96bd8f3/apps/api/src/interactions.ts), [shared composer](https://github.com/BINAYAK016/DatingAppMVP/blob/96bd8f3/apps/mobile/src/app/compose.tsx), [media authorization](https://github.com/BINAYAK016/DatingAppMVP/blob/96bd8f3/apps/api/src/media.ts).

External checks relevant to the requested architecture:

- Google ID tokens require backend signature, audience, issuer and expiry verification; provider subject is the stable account identity. A Google button alone is not login integration. [Google backend authentication](https://developers.google.com/identity/sign-in/android/backend-auth).
- Apple's third-party-login rule generally requires an equivalent login option meeting its privacy criteria, subject to listed exceptions. For an iOS dating app adding Google, plan a Sign in with Apple assessment before store submission; email/password alone should not be assumed to satisfy it. [Apple guideline 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services).
- The installed mobile package uses Expo 57. Native implementation must consult the matching documentation and the repository's mobile instructions before changing APIs. [Expo versioned documentation](https://docs.expo.dev/versions/v57.0.0/).
