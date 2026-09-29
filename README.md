# Sangai Beta

A real React Native / Expo Android and iOS app for Nepali adults in Kathmandu, Bhaktapur, Lalitpur, Pokhara, Sydney, Melbourne, Perth and Brisbane. Shared TypeScript screens use native navigation, camera/media access, video playback and secure token storage. No AI services are used.

This is a **local, private testing beta**, with a working NestJS API and PostgreSQL. It is not approved for a public dating-service launch. The [beta guide](docs/beta.md) records implementation choices and remaining release work. Earlier discovery documents are historical proposals.

The redesign audit, confirmed decisions and implementation roadmap are in [the audit](docs/redesign-audit.md), [plan](docs/redesign-plan.md) and [current beta guide](docs/beta.md). The product now follows **Discover → Match → Chat → Sangai → Date**.

## Included

- Four tabs: Discover, Chat, Sangai and Profile, with warm blush/peach/lavender branding.
- Verified-email access, password reset, five saved profile steps and declared 18+ access. Google integration requires OAuth configuration.
- Persisted Like/Pass/Super Like gestures and buttons; hidden incoming Likes, mutual matching, safe undo and reciprocal preferences.
- Match-only stories, one Chat camera, snaps, ordinary photo/video messages and a paged mixed conversation timeline.
- Virtualized private feed, visible-video autoplay, data saver, reactions, replies, saves and sharing without audience expansion.
- Three consented live games: This or That, Would You Rather, Two Truths & a Lie. Four more follow in the agreed next increment.
- Date invitations, editable profiles/gallery, privacy settings, moderation, block/report/unmatch, export and account deletion.
- Free + Sangai Plus **pricing previews only**: NPR 299/month or 2,870.40/year; AUD 7.99/month or 76.70/year. No checkout or paid entitlement.

Circles, circle events/RSVP, the old request inbox and separate Play tab are retired. Sample accounts are visibly fictional and isolated from real-account discovery. See the [Android Studio run guide](docs/android-redesign.md) and [verification](docs/verification.md) for executed checks and remaining platform/provider validation.

## Backend

Install Docker Desktop with Linux containers, Git and Node.js 24. From this repository:

```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
```

Health: <http://localhost:4100/health>. Moderator console: <http://localhost:4100/admin>. The local operator key is configured in `.env`; never put it in the mobile app. Database and media use persistent volumes. Ports bind to loopback. Local verification/reset emails appear in **Mailpit at http://localhost:8025**; they are not delivered to external inboxes. Configure real SMTP and Google OAuth as described in the beta guide for invited external testers.

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

The emulator uses `http://10.0.2.2:4100` for the host API. The welcome screen has an editable server address; `EXPO_PUBLIC_API_URL` can override the build default. Keep Docker running. Choose **Aarav**, **Anaya** or **Samira** to explore the existing demo matches. Sign out under **Profile** to switch accounts. **Rohan** and **Nisha** let you test new matching.

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

Read [beta guide](docs/beta.md), [verification](docs/verification.md), [test plan](docs/test-plan.md), and [agent instructions](AGENTS.md).
