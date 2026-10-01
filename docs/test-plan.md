# Beta acceptance tests

Use fictional accounts and test media. Record platform, OS, device, build hash and outcome. Bundle exports and browser tests do not establish native parity.

## Automated

API integration tests use an isolated database: adult authentication, private fields, match-only social access, reciprocal preferences, pagination, private media, snap/expiry rules, game secrecy, retry-safe chat, date consent, block revocation, reporting, admin access and account deletion. Historical group tests remain server regression checks; circles, follows and written connection requests are not part of the current mobile product.

Mobile checks cover TypeScript, Expo lint/doctor and platform bundle exports. Playwright tests cover the four-tab journey, profile onboarding, demo entry, discovery gestures/undo, match-only moments, chat and a two-client live game. Focused profile/game regression tests also check old-game history cursors, unavailable profiles/games, dirty drafts, gallery/settings failures, pending answer controls, unread Activity actions and date validation including daylight-saving gaps. Failure fixtures stay in the browser and do not mutate real user records. Tests present in source are not verification results; record actual run outcomes separately in `docs/verification.md`.

## Run on Android and iOS

1. Register/login, reject under-18/invalid credentials, edit profile/preferences/photo, relaunch with stored session. Verify no private contact/birthday fields leak.
2. Swipe Like/Pass/Super Like, undo where allowed and reveal only a mutual match. Verify unmatched users cannot read posts/stories or chat/snap/play. Pause discovery while keeping matches; likes remain hidden until mutual.
3. Post text/photo/video; like/comment/save/share; navigate feed pages. Check video playback/data saver, slow network, offline feedback and retry. Test each supported media count against the implemented upload limits.
4. Deny then allow camera/library access. Capture photos/videos on actual devices. Test cancellation, orientation, oversize/overlong/invalid uploads, interrupted upload and backgrounding.
5. Send photo/video snaps; open once, close early, background and relaunch; verify no reopening. Check unopened and story expiry with isolated fixtures. Never claim screenshot prevention.
6. Open profile/settings/safety from each supported entry point. Check dirty-draft navigation, immediately saved gallery changes, media removal failure, pending settings, focus revalidation after unmatch/block and terminal versus retryable loading errors. Inspect Activity with no updates, all read and unread updates.
7. Play all three games from two clients; verify explicit readiness and invitation consent, unavailable readiness, expiry/cancel/revocation, secrecy before reveal, immutable choices and disabled controls during requests. Open a completed game older than the latest 20 from paginated conversation history. Propose/accept/decline/cancel dates; validate before Review, reject past/invalid dates and daylight-saving gaps, and check cross-timezone display and revocation after unmatch.
8. Send messages on two clients; retry one client ID, disconnect/reconnect, background/foreground, block then attempt stale actions. Unblock must not restore a match.
9. Report, review, resolve/dismiss/suspend, inspect case state, export own data, delete account, retry old session and media URLs.
10. With real FCM/APNs credentials, test opt-in/out, denied permissions, foreground/background/killed notification launch, logout, account switching and revoked matches. Without credentials only the in-app inbox is accepted.

Use compact/modern Android devices, at least one physical Android phone, compact/current iPhones and supported iOS simulators. Include large text, keyboard obstruction, Android back behavior and safe areas. Native iOS and remote push remain open until actually exercised.
