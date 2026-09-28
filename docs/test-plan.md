# Beta acceptance tests

Use fictional accounts and test media. Record platform, OS, device, build hash and outcome. Bundle exports and browser tests do not establish native parity.

## Automated

API integration tests use an isolated database: adult authentication, private fields, match-only social access, reciprocal preferences, pagination, private media, snap/expiry rules, complete match groups, game secrecy, retry-safe chat, date consent, block revocation, former-member content, reporting, admin access and account deletion. Mobile checks cover TypeScript, Expo lint/doctor and platform bundle exports. Supplemental Playwright tests cover feed creation, discovery/circle discussion/event form, game choices and chat.

## Run on Android and iOS

1. Register/login, reject under-18/invalid credentials, edit profile/preferences/photo, relaunch with stored session. Verify no private contact/birthday fields leak.
2. Send/accept/decline a connection. Verify unmatched users cannot read posts/stories or chat/snap/play. Pause discovery while keeping matches.
3. Post text/photo/video; like/comment/follow; navigate feed pages. Check explicit video loading, slow network, offline feedback and retry.
4. Deny then allow camera/library access. Capture photos/videos on actual devices. Test cancellation, orientation, oversize/overlong/invalid uploads, interrupted upload and backgrounding.
5. Send photo/video snaps; open once, close early, background and relaunch; verify no reopening. Check unopened and story expiry with isolated fixtures. Never claim screenshot prevention.
6. Create a valid three-person circle, reject a host-only match graph, then break any pair and verify access is revoked for all members. Check former-member posts/events, event creation and RSVP.
7. Play all three games from two clients; verify secrecy before reveal and immutable choices. Propose/accept/decline/cancel dates; check timezones and revocation after unmatch.
8. Send messages on two clients; retry one client ID, disconnect/reconnect, background/foreground, block then attempt stale actions. Unblock must not restore a match.
9. Report, review, resolve/dismiss/suspend, inspect case state, export own data, delete account, retry old session and media URLs.
10. With real FCM/APNs credentials, test opt-in/out, denied permissions, foreground/background/killed notification launch, logout, account switching and revoked matches. Without credentials only the in-app inbox is accepted.

Use compact/modern Android devices, at least one physical Android phone, compact/current iPhones and supported iOS simulators. Include large text, keyboard obstruction, Android back behavior and safe areas. Native iOS and remote push remain open until actually exercised.
