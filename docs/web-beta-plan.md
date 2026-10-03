# Cross-platform web beta: local implementation

Branch: `feat/cross-platform-web-beta`. Baseline: `e1908cc`.

The EC2 instance and deployed Caddy configuration are outside this implementation. Run the API, PostgreSQL, Mailpit and exported web app locally before any later deployment.

## Audit

- Shared Expo SDK 57 / React Native 0.86 screens already export to web. Core browser journeys have existing Playwright coverage.
- Native credentials are securely bound to the chosen server using SecureStore. Browser credentials currently exist only in memory and disappear on refresh.
- Private browser video is fetched using authorization headers into temporary object URLs. Cookie authentication must also cover media reads and uploads without leaking credentials into URLs.
- The UI caps most page content at 600 pixels, but navigation, chat and overlays still stretch on desktop.
- Native camera recovery and compression exist. Browser picker cancellation and unsupported image decoding need clearer handling.
- Web push is deferred; the Activity inbox remains available. Native push and Google login require operator-owned provider configuration.
- HTTP networking exceptions are currently unconditional. Keep explicit development access and use HTTPS defaults for release builds.
- Existing Android emulator may retain a DuckDNS address. Change its connection to `http://10.0.2.2:4100` through the app, preserving its data.

## Stages

1. Add browser cookies and CSRF protection while preserving native bearer sessions; isolate auth/storage/notification services. Test expiry, logout, wrong origin, stale CSRF and native compatibility.
2. Add a bounded desktop shell, visible keyboard focus, tab visibility/reconnect handling and media adapters. Preserve shared mobile journeys.
3. Export locally, serve the SPA with API proxying, expand browser coverage across requested widths and browser engines, and verify Android emulator access.
4. Run typechecks, lint, API/session/browser tests and web/Android/iOS JS exports. Document evidence and limitations, prepare Caddy instructions, make focused commits and push this branch only.

Native iOS build/runtime checks need macOS/Xcode or later cloud builds. A JavaScript export is not evidence of native iOS parity. No new realtime protocol or separate frontend is required for this beta: retain bounded foreground polling and explicit refresh/recovery.
