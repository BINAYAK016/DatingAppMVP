# Sangai Beta

A real React Native / Expo Android and iOS app for Nepali adults in Kathmandu, Bhaktapur, Lalitpur, Pokhara, Sydney, Melbourne, Perth and Brisbane. Shared TypeScript screens use native navigation, camera/media access, video playback and secure token storage. No AI services are used.

This is a **local, private testing beta**, with a working NestJS API and PostgreSQL. It is not approved for a public dating-service launch. The [beta guide](docs/beta.md) records implementation choices and remaining release work. Earlier discovery documents are historical proposals.

The redesign audit, confirmed decisions and implementation roadmap are in [the audit](docs/redesign-audit.md), [plan](docs/redesign-plan.md) and [current beta guide](docs/beta.md). The product now follows **Discover → Match → Chat → Sangai → Date**.

The current [demo environment](docs/demo-environment.md) contains **30 complete fictional profiles** in one shared dating world: 10 Men, 10 Women and 10 LGBTQ+ / Other selector entries. Choose a persona and enter instantly; **Switch Demo User** changes perspective without a logout. The [inventory and test report](docs/demo-test-report.md) lists every baseline match, conversation, story, game, post and date, plus independently expected and actual discovery results for all thirty personas. Profile imagery is original geometric artwork; the [demo-media provenance](apps/api/src/demo-assets/README.md) documents its creation.

The [1 October frontend audit and redesign](docs/ui-redesign.md) records the earlier visual release (`f3f9978`): portrait-led discovery, match moments, conversations, feed, profiles, games and date planning. That release preserved backend contracts. Earlier bundled portraits have [documented provenance and prompts](apps/mobile/assets/demo/README.md).

The earlier [product polish](docs/product-polish-audit.md) added six-digit email verification/reset, clearer auth recovery, ordered multi-photo posts, upload feedback, story playback/navigation and focused profile/game/date recovery. Those changes include a minimal additive [post-media contract](docs/post-media.md) and authentication fixes; matching, match-only audiences and game consent remain intact. Follow the [authentication setup](docs/authentication.md) before starting Docker. Real Google sign-in and external email delivery still require your provider configuration and end-to-end verification.

The [1 October application audit](docs/full-audit-20261001.md) records the baseline defects and staged fixes. The current implementation adds [seven Games 2.0](docs/games-v2.md), [private-media and security foundations](docs/security-foundation.md), and [batched reads with cursor pages](docs/scalability-audit.md). The [capacity plan](docs/capacity-plan.md) separates the tiny local smoke measurements from future load scenarios. Final combined and native evidence belongs in [verification](docs/verification.md); source implementation alone does not establish device parity or production capacity. The preserved [Meet Me audit](docs/meet-me-audit.md) and [plan](docs/meet-me-plan.md) remain proposals, including external live verification.

## Included

- Four tabs: Discover, Chat, Sangai and Profile, with warm blush/peach/lavender branding.
- Demo-first entry, grouped/paged persona selection, profile previews, account switching and a confirmed shared **Reset Demo**. Existing verified-email/Google/profile-creation architecture remains available with demo mode disabled; no new authentication integration is part of this phase.
- Persisted Like/Pass/Super Like gestures and buttons; hidden incoming Likes, mutual matching, safe undo and reciprocal preferences.
- Match-only stories, one Chat camera, snaps, ordinary photo/video messages and a paged mixed conversation timeline.
- Virtualized private feed, up to six ordered photos or one video per post, visible-video autoplay, data saver, reactions, replies, saves and sharing without audience expansion.
- Seven Games 2.0: This or That, Would You Rather, Two Truths & a Lie, Guess My Answer, Compatibility Challenge, 20 Questions and Rapid Fire. Invitations allow returning later; only the invited match's explicit acceptance starts play. Ready is optional and advisory for v2 games.
- Cursor-paged Activity, matches, stories, discovery, feed and conversation history; batched unread/message previews and bounded bootstrap projections.
- Date invitations, editable profiles/gallery, privacy settings, moderation, block/report/unmatch, export and account deletion.
- Free + Sangai Plus **pricing previews only**: NPR 299/month or 2,870.40/year; AUD 7.99/month or 76.70/year. No checkout or paid entitlement.

Circles, circle events/RSVP, the old request inbox and separate Play tab are retired. Sample accounts are visibly fictional and isolated from real-account discovery. See the [Android Studio run guide](docs/android-redesign.md) and [verification](docs/verification.md) for executed checks and remaining platform/provider validation.

Games 2.0 is enabled by server `ENABLE_GAMES_V2=true` in the local configuration. For a beta rollback, set it to `false` while retaining the migrated schema and compatible API binary: new v2 invitations and non-cancel actions stop, while authorized existing-session reads and cancellation remain available. Legacy game history and the original three-game flow remain supported; their historical readiness rules differ from v2. Do not drop game data or deploy a pre-v2 binary as a rollback. See [game rollout details](docs/games-v2.md#rollout-and-rollback).

## Backend

Install Docker Desktop with Linux containers, Git and Node.js 24. Before starting Docker, create the ignored local `.env` and a random server-only `OTP_HASH_SECRET` of at least 32 characters. This command preserves existing configuration and does not print the secret. Run it from this repository; deployment should use a secret manager. See [authentication setup](docs/authentication.md) for OTP behavior, SMTP and Google configuration.

```powershell
node -e "const fs=require('fs'),c=require('crypto');let s=fs.existsSync('.env')?fs.readFileSync('.env','utf8'):fs.readFileSync('.env.example','utf8');if(!/^OTP_HASH_SECRET=.{32,}$/m.test(s)){const line='OTP_HASH_SECRET='+c.randomBytes(32).toString('hex');s=/^OTP_HASH_SECRET=/m.test(s)?s.replace(/^OTP_HASH_SECRET=.*$/m,line):s+'\n'+line+'\n';fs.writeFileSync('.env',s);}"
docker compose up --build -d
docker compose ps
```

Health: <http://localhost:4100/health>. Moderator console: <http://localhost:4100/admin>. The local operator key is configured in `.env`; never put it in the mobile app. Database and media use persistent volumes. Ports bind to loopback. Local verification/reset emails appear in **Mailpit at http://localhost:8025**; they are not delivered to external inboxes. Configure real SMTP and Google OAuth using the [authentication guide](docs/authentication.md) for invited external testers.

Local demo entry requires **both `DEMO_MODE=true` and `ENABLE_DEMO=true`** (Compose defaults). Restarting the API preserves demo activity. **Reset Demo** restores only the catalog's shared fictional world and affects every demo participant; normal accounts, sessions and media are preserved. Reset requires confirmation and regenerates private assets and fresh active deadlines. To return to ordinary authentication, set both flags to `false` in the ignored `.env` and recreate the API. See the [demo guide](docs/demo-environment.md) for controls, reset scope and the repeatable matching/game walkthrough.

## Android Studio

1. Install Android Studio, the SDK platform/build tools and a Google APIs Android Virtual Device. Start it in **Device Manager**. Allow around 15 GB for the native toolchain/build. An x86_64 image suits an Intel/AMD Windows host.
2. Set `JAVA_HOME` to a **JDK 21** installation and `ANDROID_HOME` to your SDK location. Select the same JDK in Android Studio's Gradle settings. The Studio-bundled JDK 25 triggered a native Prefab build failure on this machine; use the documented JDK rather than the bundled default. Use the generated Gradle wrapper.
3. Run:

```powershell
npm ci --prefix apps/mobile
cd apps/mobile
npm run android
```

Expo generates, builds, installs and starts Metro. To work inside the IDE, run `npx expo prebuild --platform android`, then open `apps/mobile/android` in Android Studio. Configure native behavior through `app.config.ts`; do not hand-edit generated files.

On Windows use a short checkout path. CMake 3.22.1 bundles Ninja 1.10.2, which can fail on React Native's generated paths even with Windows long paths enabled. This build uses **Ninja 1.13.2** from the [official releases](https://github.com/ninja-build/ninja/releases), replacing only `ninja.exe` inside the task's SDK `cmake/3.22.1/bin` (with the original saved). If you see “Filename longer than 260 characters”, use a current Ninja and an OS with long paths enabled, or shorten the checkout further.

The emulator uses `http://10.0.2.2:4100` for the host API. The demo picker has an editable server address; `EXPO_PUBLIC_API_URL` can override the build default. Keep Docker running. Choose **Aarav** to explore existing matches and content. Use the persistent **Switch** control or **Profile → Switch Demo User** to change perspective. For a repeatable new match, reset the demo, enter as Aarav, Pass Pema, Like Tavi, switch to Tavi, and Like Aarav. Like alone sends a private decision; the reciprocal Like opens the match moment and Chat.

To build a standalone APK with bundled JavaScript:

```powershell
npx expo run:android --variant release
```

Local release builds use the generated development signing key and are private-test artifacts, not Play Store releases. An x86_64 APK is for x86_64 emulators; ARM phones need an arm64 build.

## iOS

On a Mac with the Xcode version required by Expo SDK 57 and CocoaPods:

```sh
npm ci --prefix apps/mobile
cd apps/mobile
EXPO_PUBLIC_API_URL=http://localhost:4100 npm run ios
```

The backend must be reachable from that Mac. Simulator `localhost` refers to the Mac, not this Windows computer. A physical device needs a reachable HTTPS beta server and signing. EAS development/preview profiles are included; they require your Expo account and platform credentials. Native iOS runtime parity still requires Mac/device validation.

## Checks

```powershell
npm ci
npm run setup
npm run check
npm run lint --prefix apps/mobile
npm test
```

API tests need the Compose PostgreSQL service; they create/drop their own uniquely named test database without resetting beta data. Set `TEST_DATABASE_URL` to use another dedicated PostgreSQL server with database-creation permission.

For supplemental browser UI tests, start API and `npm run web --prefix apps/mobile`, then `npx playwright install chromium` and `npx playwright test`. With installed Chrome, set `$env:PLAYWRIGHT_CHANNEL='chrome'` to avoid downloading Chromium. The browser tests supplement native testing; the browser is not the mobile deliverable.

To reproduce the thirty-person discovery comparison and all thirteen HTTP journeys against the **local demo API**, run `npm run demo:report --prefix apps/api -- --reset`. This command explicitly resets the shared fictional world before and after its checks and writes [structured results](docs/demo-test-results.json). The unmocked browser journey also confirms and restores its shared reset; do not run it alongside another person's demo session.

Read [beta guide](docs/beta.md), [authentication setup](docs/authentication.md), [post-media contract](docs/post-media.md), [full audit](docs/full-audit-20261001.md), [Games 2.0](docs/games-v2.md), [security foundation](docs/security-foundation.md), [query audit](docs/scalability-audit.md), [capacity plan](docs/capacity-plan.md), [verification](docs/verification.md), [test plan](docs/test-plan.md), and [agent instructions](AGENTS.md).
