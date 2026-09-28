# Android and iOS product design

Status: proposed; no native builds or device tests performed. Both platforms release the same core capabilities. A feature that is not ready on one platform stays unreleased on both unless a deliberate, documented platform-specific design provides equivalent behavior.

## Navigation and interaction

Four bottom destinations: Discover, Moments, Connections and You. Discover shows eligible people with intentions and a factual shared-context reason. Moments is the restrained text/photo feed of eligible people. Connections contains requests, matches and chats. You contains profile editing, visibility, city scope, notification settings, safety and account controls. Create a moment from a clear button within Moments; no fifth empty “community” tab.

Use thumb-reachable primary actions, native keyboard/safe-area handling, accessible text scaling and labeled touch targets. Swipe may dismiss a discovery card, but explicit buttons provide the same action for accessibility. Decline/block should not be triggered by ambiguous gestures. Use visible pending/sent/failed states for requests, uploads and chat. Pull-to-refresh and cursor pages should not move the current reading position unexpectedly.

Build a shared design system for typography, spacing, color contrast, forms, loading states and error recovery. Respect Android back behavior and iOS navigation/sheet conventions. Provide English and reviewed Nepali core onboarding/safety strings for pilot; accept Unicode and Romanized Nepali content. Do not automatically translate intimate conversations in P0.

## Permission strategy and native capabilities

| Capability | When and fallback |
| --- | --- |
| Photo library | Open platform picker when adding a photo; handle limited access and denial without requesting the whole library |
| Camera | Ask only when user selects capture; library upload remains available |
| Notifications | Explain after an intent-bearing action; request once at a useful time; in-app inbox works without permission |
| Location | No GPS permission in P0; manually select broad city/metro area. Later approximate location must be optional with manual fallback |
| Microphone/video | Not requested in P0; future recording feature must justify both permissions and handle interruptions |
| Biometrics | Optional later local app lock; OS biometric success does not replace server authentication or prove identity |
| Share | Native share sheet for generic invite links; profile/post sharing off by default and audience-authorized when introduced |
| Background processing | Best-effort upload/push support only; do not promise indefinite JS execution or persistent background sockets |

Push via an adapter, initially Expo delivery to APNs/FCM, with revocable per-installation tokens and delivery receipt handling. Match/message notifications are P0; likes, communities and events wait for those features. Preferences include per-type controls, quiet hours and chat mute; interpret quiet hours in the user's IANA timezone. Marketing/recommendation nudges are opt-in. Default lock-screen text is generic and contains no sender, photo or message body.

Store refresh credentials in platform-backed secure storage; keep short-lived access token in memory where practical. Do not persist chat bodies in unencrypted generic key/value storage. P0 offline chat storage can be avoided: show connectivity status and keep an in-memory draft. If durable drafts/messages are later necessary, implement a reviewed encrypted local database, key lifecycle, backup exclusions and logout/account-deletion wiping. Secure storage behavior after reinstall differs by platform; server session revocation remains authoritative. See [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

## Low bandwidth and reliability

Proposed budgets to validate on physical lower-end Android phones and an older supported iPhone:

- Initial discovery uses roughly 10 items and thumbnail derivatives, with a target first-page transfer <=1 MB under normal text/photo use.
- Generate sized image variants server-side; aim for thumbnails around 30–80 KB, with larger images fetched only on demand. Quality/content can require exceptions; enforce an overall transfer budget.
- Client limits dimensions/bytes before upload, then server enforces independent limits. Show upload progress, cancel and retry; reuse an upload identifier to avoid duplicated posts.
- No video autoplay, video prefetch or video uploads in P0. Future video needs poster-first loading, duration/size limits, server transcoding and adaptive playback evaluated on both platforms.
- Virtualize lists, bound image and query caches, release decoded images offscreen and profile memory/scrolling in release builds.
- Test 400 kbps downstream, 150 kbps upstream, 300 ms RTT, packet loss and offline transitions as synthetic stress profiles. These are test conditions, not claims about average Nepalese service.
- Cache approved low-sensitivity UI data only with short lifetimes. Refetch access before opening private resources. Evict blocked/deleted items upon synchronization; offline devices cannot be guaranteed instantaneous revocation.
- Retry network failures with backoff/jitter and idempotency; do not auto-retry authorization/validation failures. A pending chat message is not “sent” until server persistence is acknowledged.
- Preserve scroll position and form state across interruptions; show explicit expired-session recovery rather than an endless spinner.

## Deep linking and release architecture

Use owned HTTPS universal/app links as the primary external route. A private custom scheme may support navigation, but scheme possession is not proof of authorization. Logical routes include `/profile/{id}`, `/post/{id}`, `/match/{id}` and future `/event/{id}`. After login, resolve through the backend; inaccessible or blocked resources show a generic unavailable state. Do not include tokens, raw phone numbers, private previews or match text in URLs. Deep links to future features resolve gracefully until enabled.

Development, staging and production use separate app IDs, backend environments, push credentials and data. Client configuration contains public endpoints only; nothing in a mobile bundle is secret. Store signing keys and provider credentials in protected CI/secrets systems. Signing ownership and account access need an explicit backup custodian.

Set monotonically increasing Android versionCode and iOS build numbers; use semantic product versions for user-visible releases. Store review and staged rollout are part of delivery. Runtime-compatible OTA changes may be considered later with rollback; native module/permission changes require a new binary. Do not assume OTA can bypass review. Support the currently distributed and previous supported client/API compatibility window; force an update only for material compatibility/security reasons.

Expo development builds are proposed, with physical device testing before stores. Hosted EAS can build both platforms; local iOS builds require macOS. Store submission also needs actual privacy/support/deletion pages, metadata, screenshots, review access, age/content classifications and declarations reflecting all included SDKs. No readiness claim is made now. See [Expo build documentation](https://docs.expo.dev/build/introduction/).

## Test and parity matrix

The senior developer owns release acceptance; DevOps owns repeatable build/deployment execution. Codex can author tests but cannot substitute unverified claims for device evidence.

| Scenario | Android coverage | iOS coverage | Evidence required |
| --- | --- | --- | --- |
| Register → profile → discover → request → match → chat | Emulator plus physical low/mid-range devices | Simulator plus physical iPhone | Automated journey plus recording/logs from release-like build |
| OTP/session expiry/recovery/logout/deletion | Selected oldest supported and current OS | Selected oldest supported and current OS | No stale session access; safe recovery and deletion states |
| Photo picker/camera/upload | Denied/revoked/limited access, activity recreation | Denied/limited access, lifecycle interruptions | Retry/cancel without duplicate post, correct EXIF stripping |
| Feed/discovery/matching | Small/large screens; memory pressure | Small/large screens; text scaling | Stable scrolling and same eligibility/state rules |
| Chat | Offline/reconnect, duplicates, background/foreground | Same, plus OS suspension | Durable ordering, one accepted message per client ID |
| Push and links | FCM, cold/warm launch, denied permission | APNs, cold/warm launch, denied permission | Real-device delivery, authorized route, privacy defaults |
| Report/block/privacy | Server races plus visible UI updates | Same | No later read/send/media access or sensitive queued push |
| Location | Manual city fallback; no P0 GPS prompt | Same | No precise location in requests/responses |
| Deferred video/comments/events | Not enabled | Not enabled | Test full parity before any future release |

Use unit tests for critical logic, React Native component tests for stateful flows, backend integration tests for contracts and authorization, and Maestro or Detox for the primary end-to-end journey after a tool spike. Fix the supported OS/device matrix at foundation against the selected SDK and target users; do not invent an untested minimum version now. Add manual VoiceOver/TalkBack, Nepali font, low-data, crash recovery and real push testing that UI automation cannot establish alone.
