# Verification record

This file records executed checks at beta delivery. See [test plan](test-plan.md) for the remaining device matrix. The build host is Windows with Node 24, Docker Desktop and Android Studio. Native build artifacts are on D: because C: is almost full. iOS native execution and store readiness cannot be inferred from bundle exports.

## Executed

- `npm test --prefix apps/api`: **11/11 passing**, isolated PostgreSQL databases. Includes negative authorization tests, concurrent duplicate-message requests, and rejection of playlists disguised as uploaded videos.
- `npm run check`: API and mobile TypeScript pass.
- `npm run lint --prefix apps/mobile`: pass with no errors/warnings.
- `npx expo-doctor`: **21/21 passing**. API and mobile `npm audit`: **0 known vulnerabilities** at the time checked (not a guarantee of security).
- `npx expo export --platform all`: Android and iOS Hermes bundles plus web bundle successfully produced.
- Playwright on Chrome, 412 × 915 viewport: **3/3 passing** (post creation, discovery/circle discussion/event form, dating-game choices/chat).
- `node tests/media-smoke.mjs artifacts/video-test.mp4`: real FFmpeg synthetic MP4 upload/transcode, authenticated 206 byte-range playback, unmatched access denial, and video-snap closure pass on Docker.
- Both Compose services healthy; data survives container recreation.
- Android API 36 Google APIs x86_64 emulator boot reached `sys.boot_completed=1` with WHPX acceleration.

## Build environment notes

The initial standard multi-stage Docker build completed. A later rebuild encountered a Docker Desktop registry proxy timeout (`192.168.65.1:3128`). The local runtime was updated by layering freshly compiled API code, schema and admin files over its existing beta image, preserving the installed dependencies; the updated image and media tests passed. The normal Dockerfile remains the reproducible source definition. Fix the host proxy for uncached builds. No unrelated containers or images were removed.

Native Android application build/install results are recorded below when complete. Native iOS journeys, actual camera hardware, permission-denial/device matrices and remote APNs/FCM delivery remain unverified.
