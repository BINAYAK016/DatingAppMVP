# Sangai Beta

A real React Native / Expo Android and iOS app for Nepali adults in Kathmandu, Bhaktapur, Lalitpur, Pokhara, Sydney, Melbourne, Perth and Brisbane. Shared TypeScript screens use native navigation, camera/media access, video playback and secure token storage. No AI services are used.

This is a **local, private testing beta**, with a working NestJS API and PostgreSQL. It is not approved for a public dating-service launch. The [beta guide](docs/beta.md) records implementation choices and remaining release work. Earlier discovery documents are historical proposals.

The next product direction is documented in the [SANGAI redesign audit](docs/redesign-audit.md) and [migration plan](docs/redesign-plan.md). These are planning documents; the feature list below describes the existing implementation, not completed redesign work.

## Included

- Adult signup/login, profiles/photos, interests, intentions and reciprocal discovery filters.
- Connection requests, mutual matching and persistent private chat.
- Match-only text/photo/video posts, likes, comments, following, paginated feed and short-video filter.
- Match-only 24-hour stories; direct photo/video snaps with one opening, up to 30 seconds, and 24-hour unopened expiry.
- Private circles where **every member must match every other member**, discussions, events and RSVP.
- Three two-player dating games with hidden choices and joint reveal, plus date proposals.
- In-app notifications, optional device-push adapter, reports, block/unmatch, moderator console, account export and deletion.

Sample accounts are visibly fictional test fixtures. Posts, matches, messages, choices and moderation actions persist in the database.

## Backend

Install Docker Desktop with Linux containers, Git and Node.js 24. From this repository:

```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
```

Health: <http://localhost:4100/health>. Moderator console: <http://localhost:4100/admin>. The local operator key is configured in `.env`; never put it in the mobile app. Database and media use persistent volumes. Ports bind to loopback.

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

The emulator uses `http://10.0.2.2:4100` for the host API. The welcome screen has an editable server address; `EXPO_PUBLIC_API_URL` can override the build default. Keep Docker running. Choose **Aarav**, **Anaya** or **Samira** to explore the pre-matched triangle and circle. Sign out under **You** to switch accounts. **Rohan** and **Nisha** let you test new matching.

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
