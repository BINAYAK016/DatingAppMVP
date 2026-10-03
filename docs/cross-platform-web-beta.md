# Local cross-platform web beta

Implementation branch: `feat/cross-platform-web-beta`. The initial [audit and plan](web-beta-plan.md) records the baseline. Android and iOS retain the shared Expo application; web uses the same Router screens and product logic. This update has not been deployed to EC2.

## Run locally

Prerequisites: Node.js 24, Git, Docker Desktop with Linux containers, and the existing ignored local `.env` with its OTP secret. No AWS access is needed. From the repository root:

```powershell
npm ci
npm run setup
docker compose up --build -d
npm run web:build
npm run web:preview
```

Open `http://localhost:8081`. The preview binds only to `127.0.0.1` and proxies API/media requests to local port 4100. Mailpit remains at `http://localhost:8025`. Keep the preview process running; rebuild and refresh after source changes. Do not use this preview server for Internet hosting.

`web:build` exports production JavaScript with a same-origin API and hides connection settings. It ignores mobile dotenv files so a previously saved DuckDNS build address cannot leak into the local web export. There is no service worker or offline private-data cache. `npm run mobile` remains the native Metro workflow. For live web iteration through Metro, explicitly set `EXPO_PUBLIC_API_URL=http://localhost:4100`; cookie requests require the loopback development cookie configuration.

For the Android emulator, open the existing app's demo connection settings and save `http://10.0.2.2:4100`. This emulator's saved address was changed from DuckDNS and survived an app restart. A physical phone uses the laptop's LAN address and requires a deliberately configured LAN backend; the loopback-only browser preview does not provide that. Native local builds require both `SANGAI_ALLOW_LOCAL_HTTP=true` and `EXPO_PUBLIC_CONNECTION_SETTINGS=true`. Remote release builds should explicitly use an HTTPS API URL, set both flags to `false`, and regenerate the native project. Transport-security settings come from `app.config.ts`; never patch generated Android/iOS files.

## Sessions and private media

Native sessions still use server-bound SecureStore credentials and the existing `Authorization: Bearer` contract. Web sign-in sets an HttpOnly cookie and returns a separate CSRF handle, never the bearer token. The default cookie is host-only `__Host-sangai-session`, Secure, SameSite=Lax, Path=/, with a seven-day maximum age; server revocation/expiry remains authoritative. Every protected browser mutation requires an approved Origin/Referer, `X-Sangai-Client: web`, and a session-derived `X-CSRF-Token`. An invalid bearer header cannot fall back to a valid cookie.

`GET /v1/auth/session` restores the browser session. The CSRF handle stays in component memory. Browser game drafts use tab-scoped sessionStorage and are cleared on account changes/logout; they contain no login credential. Login tokens are never put in localStorage, resource URLs or exported bundles. Account changes in another tab are detected on protected reads/resume, clear the old view and restore the replacement account. Logout waits for the server to revoke/clear the HttpOnly cookie; a failed logout offers retry instead of claiming success.

Local Compose uses `WEB_COOKIE_SECURE=false` with `NODE_ENV=development`, accepting only HTTP localhost/127.0.0.1 browser origins. This exception must not be used for the deployed beta. Set `WEB_COOKIE_SECURE=true` and an exact HTTPS `CORS_ORIGINS` for deployment. Shared API responses and protected media retain no-store headers. Browser videos use authenticated fetch into temporary object URLs; images stay in component memory. Object URLs are released on removal/navigation. Bytes already displayed cannot be recalled from a tester's device.

## Platform feature matrix

| Feature                                                            | Web                                                          | Android                                 | iOS                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------- |
| Demo selection, four tabs, profiles, discovery and mutual matching | Shared screens; browser coverage                             | Shared native screens                   | Shared native screens; runtime pending            |
| Match-only feed, ordered photo posts, saves, comments              | File picker, compression and cookie uploads                  | Native system picker and bearer uploads | Native system picker; device verification pending |
| Stories, private chat, ordinary media, view-once snaps             | Private fetch/playback; browser controls                     | Native players/camera                   | Native players/camera; runtime pending            |
| Invitations and dating games                                       | Existing three legacy and seven v2 games preserved           | Same shared game logic                  | Same shared game logic                            |
| Activity, safety, report/block, pricing previews                   | Shared screens and API authorization                         | Same shared screens                     | Same shared screens                               |
| Session restoration                                                | HttpOnly cookie + CSRF                                       | SecureStore + bearer                    | SecureStore + bearer                              |
| OS push                                                            | Deferred; Activity stays available                           | Expo/FCM when configured                | Expo/APNs when configured                         |
| Camera                                                             | Device capture picker when supported; desktop file selection | Native permission/camera flow           | Native permission/camera flow                     |

The matrix describes implementation paths, not certified device parity. See [verification](verification.md) for executed checks. Normal email onboarding uses local Mailpit in testing. External SMTP, Google OAuth, FCM and APNs still require provider configuration and real end-to-end testing. Push currently opens Activity, where an authorized item opens its associated conversation/game/content. No private message body appears in push payloads.

## Browser limitations

- Screenshots, recording, developer tools and saving bytes cannot be prevented. The snap UI states that screenshots are possible. Closing/hiding a snap consumes its server viewing window; it does not guarantee destruction of copied media.
- JPEG, PNG and WebP photos are decoded and compressed to JPEG. HEIC/HEIF gets an actionable conversion message. Video must be up to 30 seconds/20 MB and decodable by the browser; use H.264 MP4 for broad compatibility. An unsupported MOV/HEVC file gets a conversion message before upload. The API independently validates/processes uploads.
- Browser camera capture depends on the phone/browser. Desktop capture may open a file picker. Actual iPhone camera, orientation and permission behavior still needs hardware testing.
- Muted autoplay, tab visibility and user controls apply to browser playback. WebKit testing on Windows is engine coverage, not Safari/iOS device evidence.
- The installed Windows WebKit engine rejected the verified H.264/yuv420p test clip with `MEDIA_ERR_SRC_NOT_SUPPORTED`; its unsupported-file recovery was tested. Actual MP4 story/snap playback passed in Chrome and Firefox. Safari/macOS playback remains required because [media codecs vary by platform](https://playwright.dev/docs/browsers#webkit). WebKit's Windows cookie inspection also reported `None` despite an explicit `SameSite=Lax` response header; the test checks the transmitted attribute and restoration/logout separately.
- Activity refreshes while foregrounded and on resume/online events. This beta retains polling; it does not promise background delivery, live sockets or web push.
- A saved unsent draft is not an offline publishing queue. Browser API/upload timeouts offer retry; in-flight publishing should be reconciled before retrying after a lost response. Existing chat/post/game client IDs provide their server retry guarantees.

## Later Caddy deployment

Only deploy after local checks pass and after backing up the existing server configuration and persistent data. [Caddyfile.web-beta.example](../ops/Caddyfile.web-beta.example) is prepared configuration, not an applied change. It keeps a mandatory source-IP allowlist, blocks admin routes before proxying, routes `/v1/*`, `/health`, `/ready` and `/policies` to loopback port 4100, serves static assets, and falls back to `index.html` for Router routes. API and private media are never cached. Only hashed Expo bundles get immutable caching. Missing assets return 404 rather than the app HTML.

1. Preserve the exact current allowlist. Set the Caddy service environment `BETA_HOST=sangaidev.duckdns.org` and `BETA_ALLOWED_IPS` to those space-separated IPv4/IPv6 CIDRs. Do not use `0.0.0.0/0`, remove the allowlist or place this behind a new unconfigured proxy. DNS must point to EC2's current public IP.
2. Set API `WEB_COOKIE_SECURE=true`, `CORS_ORIGINS=https://sangaidev.duckdns.org`; retain server secrets in the ignored environment. Keep database/API ports private and existing AWS ingress restrictions.
3. Build `npm run web:build:remote` with `EXPO_PUBLIC_API_URL` unset/empty for the same-origin deployment, and any required public Google client ID explicitly in the process environment. The build disables connection settings and ignores dotenv. No SMTP/server secret belongs in that environment or export.
4. Upload `apps/mobile/dist/` into a new versioned directory beneath `/srv/sangai/`; keep the previous web directory. Point `/srv/sangai/web` to the selected export. API and web must be upgraded together because the web client expects cookie/CSRF support.
5. Back up `/etc/caddy/Caddyfile` with a timestamp, copy/adapt the example while retaining any other existing sites, run `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` with the service environment, then reload Caddy. Do not restart unrelated services or overwrite the old configuration without its backup.
6. From an allowlisted tester, verify health JSON, all direct routes/refreshes, demo login, Secure HttpOnly cookie, logout, uploads, media and cache headers. Check a non-allowlisted source gets 403 and `/admin`, `/admin.js`, `/v1/admin/*` get 404. Normal authentication must also be tested with demo mode disabled before inviting real accounts.
7. Roll back to the previous Caddy config/web directory if checks fail. A pre-cookie API needs its corresponding previous web build. Retain database/media volumes and compatible migrated API behavior. See the existing Games 2.0 rollback guidance; do not downgrade database schemas blindly.

The sample CSP permits the optional Google Identity origin but must be validated against the actual configured OAuth flow before deployment. Caddy syntax validation is separate from external DNS/TLS/provider and allowlist evidence.

## Checks

```powershell
npm run check
npm run lint --prefix apps/mobile
npm test
npm run test:session
npm run web:build
$env:PLAYWRIGHT_CHANNEL="chrome"
npm run test:ui
$env:PLAYWRIGHT_BROWSERS_PATH="$PWD/artifacts/pw-browsers"
node node_modules/@playwright/test/cli.js install firefox webkit
node node_modules/@playwright/test/cli.js test --config playwright.cross-platform.config.ts
```

Run the API and web preview first. Tests use clearly synthetic accounts/isolated databases; the unmocked demo journey resets the shared local demo world. Run against a local testing environment, never the EC2 beta. Native JavaScript exports do not build signed iOS apps or prove camera/push/device behavior. Required manual checks remain physical Android/iPhone capture, denied permissions, background/foreground/offline transitions, notifications and real-provider authentication.
