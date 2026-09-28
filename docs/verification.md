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

## Native Android

The release-mode x86_64 APK built and installed on the API 36 emulator (Pixel 7, WHPX, Windows). The APK contains its JavaScript bundle and does not need Metro running. It uses local development signing, package `com.sangai.beta`, version `0.1.0`.

Executed through Android's actual UI: demo sign-in, authenticated feed, discovery with all eight city choices, circle details/discussions, game invitation and five locked answers, chat send, match-only story opening, and secure-session restoration after force-stop/relaunch. The message was independently read back from the backend. A received synthetic MP4 snap decoded in the native player; the viewer was closed on returning from the background, and subsequent media access and snap reopening were denied by the API. No app crash appeared in AndroidRuntime/ReactNativeJS error logs during these journeys.

Native photo-library testing exposed Expo SDK 57's rejection of the old URI descriptor FormData upload. The upload now passes an `expo-file-system` File, following the [versioned FileSystem documentation](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/). Android's system picker, upload, post persistence and deletion were retested successfully. A further visual check found direct authenticated Image sources blank on Android. Private photos now load through authenticated fetch into component-memory data URIs with loading/retry states; the uploaded image was visually confirmed in the final APK. The final source also exported all platform bundles successfully. APK signature verification passed (development certificate).

Final APK SHA-256: `4c790a941b9bb48610fbbe3a1404a40c816d93cdaa5b5e5e85cb4315c4803a2f`.

Build tooling: Java 21, SDK 36, NDK 27.1.12297006, CMake 3.22.1, Ninja 1.13.2 and Gradle 9.3.1. Java 25 failed Prefab native dependency configuration; SDK-bundled Ninja 1.10.2 failed Windows long paths. A task-local Java 21 and checksum-verified newer Ninja resolved those failures without editing generated native project files. Build dependencies and the AVD live on D: to limit C: usage. Windows expanded its C: pagefile during the memory-heavy initial build; allow free disk space and avoid running the emulator alongside a full native build on this 16 GB host. Emulator System UI/Messages briefly reported not responding during cold boots under resource pressure; they recovered before app checks. This was not an app crash, but emulator performance on this host is limited.

Native iOS journeys, actual camera hardware, the full permission-denial/device matrix, offline/reconnect matrix and remote APNs/FCM delivery remain unverified. Emulator smoke coverage does not establish production or store readiness.
