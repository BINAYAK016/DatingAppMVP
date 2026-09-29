# Sangai redesigned private beta — 30 September 2026

Sangai means together. The product is a dating app for Nepali adults in Kathmandu, Bhaktapur, Lalitpur, Pokhara, Sydney, Melbourne, Perth and Brisbane. Serious relationships, marriage and casual dating have equal emphasis. The core journey is **Discover → Match → Chat → Sangai → Date**, with four tabs: Discover, Chat, Sangai and Profile. No AI is used. The [September 29 beta](beta-20260929.md) is historical.

## Implemented product

- Email/password signup, verified-email access, single-use password reset, five saved onboarding steps, an adult declaration and completed profile before protected product APIs. The Google adapter verifies ID tokens server-side and uses stable provider identities; it needs real OAuth client configuration before use. Email verification does not establish age or identity.
- Discover opens first. Left/right/up gestures and button alternatives record Pass, Like and Super Like. Reciprocal preferences apply on the server. Incoming Likes stay hidden in responses and notifications; mutual Likes create one match. Retry identifiers prevent duplicate decisions. Undo applies only to the latest decision before matching. Unmatching cannot be undone by swiping again.
- Chat contains the match-only 24-hour story rail and the camera entry. Conversations combine text, regular photo/video messages, view-once snaps, game invitations and dates in a cursor-paged timeline. Chat lists include message previews and unread counts. The attachment menu contains secondary actions.
- Sangai is a virtualized feed in 30-post pages. One sufficiently visible feed video loads and plays muted; scrolling away, leaving the tab or backgrounding releases it. Data saver requires a tap. Posts support reactions, comments/replies, private saves and shares into an existing match conversation. A share is a reference, not a copied post: both sender and recipient must already have access, and reads recheck access.
- The first three games are This or That, Would You Rather and Two Truths & a Lie. Readiness is visible only to one selected match, renewed while the game screen is foreground and expired after 45 seconds without renewal. Both must be ready to invite, accept and submit. Invitations expire after two minutes; active games after ten. Players can decline or cancel. Choices stay hidden until both finish; Two Truths hides the lie indices until both guesses. Games use versioned records and separate validation/projection rules. Guess My Answer, Compatibility Challenge, 20 Questions and Rapid Fire remain the approved next increment.
- Plan a Date has suggested types, date/time in the user's timezone, an optional venue, and accept/decline/cancel. Only the invited match accepts. No maps, bookings or precise location collection.
- Profile has paginated My moments, private Saved moments, section editing, a main photo and gallery media, interests, languages, hobbies, optional education/profession/lifestyle and private discovery preferences. Settings control discovery pause, social/story sharing, receipt of new messages, interactions and feed data saver. Block/report/unmatch, moderation, account export and deletion remain available.
- Free + Sangai Plus pricing previews: NPR 299/month or NPR 2,870.40/year; AUD 7.99/month or AUD 76.70/year. Annual totals apply 20% off twelve monthly payments and round to minor units. Plus previews extra undos, optional lifestyle filters and future bonus packs. Standard games and the core journey remain Free. No checkout API, payment details, charge, renewal, purchase simulation or paid entitlement is implemented. See [approved plan hypotheses](subscription-proposal.md).

Separate Circles, circle events/RSVP, the old written-request inbox, Follow and standalone Play navigation are retired. Their old routes cannot bypass the redesigned rules. Retired database tables remain inaccessible to the app during the rollback window; no circle content is republished as feed content.

## Privacy and data

Real accounts and fictional demo accounts are isolated in discovery and matching. Public profile projections exclude email, birthday, preferences and secrets. Social content requires a current mutual match. Comments by people the viewer has not matched are hidden. Blocks revoke subsequent reads, writes and authenticated media access; unblock does not recreate consent.

Posts, stories, profile media and private chat/snap media have different purposes. Reusing a private upload to publish it to a broader audience is rejected; upload a new copy deliberately. Every media request, including video ranges, checks authorization. Previously delivered bytes and screenshots cannot be revoked. Unopened snaps expire in 24 hours; opening grants up to 30 seconds, and closing/backgrounding ends the window early.

Data export includes the account's profile, authored content, decisions, own game answers, dates, references and safety records without tokens/password hashes or the other player's hidden answers. It is a JSON export, not a downloadable media archive or a claim of legal portability compliance. Deletion removes live account rows and owned files; operator backups and retained moderation records need their own retention policy.

## Reproducible local environment

`docker compose up --build -d` runs PostgreSQL 17.7, the NestJS API, and a **local Mailpit inbox** at `http://localhost:8025`. Mailpit captures email and does not deliver to a real inbox. The API is at `http://localhost:4100`, with authenticated media on its private volume. Both ports bind to loopback. For invited remote testers, configure an SMTP provider and HTTPS; never use the default local credentials publicly. The server still refuses `NODE_ENV=production`.

Configure server `GOOGLE_CLIENT_ID` and mobile `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` with the same web OAuth client ID. Android needs an OAuth Android client matching `com.sangai.beta` and its signing certificate. iOS needs `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; the Expo config derives its URL scheme. Rebuild the native app after changing this configuration. No client secret belongs in the app. Existing email accounts are not silently linked by email alone. Google is visibly unavailable when build configuration is absent. Provider configuration and real Google sign-in are unverified on this host.

Shared Expo 57/React Native 0.86 screens target Android and iOS. Build native projects through Expo; do not edit generated projects. On Windows use the short build directory and Java 21, SDK 36 and updated Ninja documented in README. Native iOS execution requires a Mac/device or configured EAS credentials. Bundle export alone does not establish iOS runtime parity.

## Architecture and verification limits

The API remains one NestJS deployment with separated auth/identity, discovery, social, moments, games, interaction and media modules. PostgreSQL stores authoritative consent, expiry and game state. Migrations have ordered names, checksums, an advisory lock and transactional execution; `schema.sql` is a frozen legacy baseline. See [migration operations](redesign-operations.md).

This is a small, single-instance beta: Chat/game state polls every three seconds, general state every twelve, readiness every ten. Social transactions still use the global advisory lock. There is no Redis, WebSocket service, S3 deployment or demonstrated scaling claim. Split locks and add durable jobs/pub-sub after measured need. Optional Expo push remains off by default and needs real FCM/APNs configuration and delivery testing. No public moderation service, store submission, live payments or identity verification is claimed.

Executed checks and native evidence are recorded in [verification](verification.md). The senior developer should review the auth/consent boundaries; the DevOps engineer owns provider configuration, secrets, signing, HTTPS and deployment.
