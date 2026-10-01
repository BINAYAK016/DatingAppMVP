# Final product polish audit

Audited baseline: `c550cda`, 1 October 2026. The audit was completed before implementation. The four-tab native dating journey, mutual-match visibility, server authorization, explicit game consent and private media remain the foundation.

## Findings and approved work

| Area              | Observed gap                                                                                                                          | Planned correction                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication    | Hex verification codes; silent resend suppression; mail inside the global write lock; failed state hydration can leave signup visible | Six-digit keyed OTPs, rolling limits, truthful resend timing, delivery outside the lock, explicit session recovery                     |
| Google            | Native adapter exists but credentials are missing; web button is permanently disabled                                                 | Real GIS/native adapters, actionable errors and documented provider configuration                                                      |
| Posting           | One media item, repeated library controls, no upload progress                                                                         | Simple selection → preview → caption → Post; up to six ordered photos or one short video; additive media contract approved by the user |
| Feed              | Fixed photo presentation, delayed like feedback, unnecessary caption links, comments input after the whole list                       | Photo carousels, optimistic likes with recovery, actual truncation links, anchored comments, contextual safety actions                 |
| Stories           | Manual load/play, no timed progression, static indicators                                                                             | Immersive autoplay, elapsed indicators, tap navigation, hold pause, swipe close, current/next buffering and foreground-only playback   |
| Chat camera       | Navigates to an empty composer                                                                                                        | Launch photo camera once on entry, preserve recording/library and cancellation recovery                                                |
| Games             | Older or missing games stay on a skeleton                                                                                             | Existing authorized timeline lookup and terminal recovery states                                                                       |
| Profiles/settings | Stale profile after unmatch, misleading media save copy, silent draft loss, repeat setting requests                                   | Focus revalidation, honest media persistence, draft protection and pending feedback                                                    |
| Dates             | Invalid details reach Review; DST gaps normalize silently                                                                             | Validate before Review, including requested local hour/minute                                                                          |

The user approved the minimal multi-photo schema/API extension and requested provider setup now, with SMTP credentials supplied during deployment. External SMTP and actual Google sign-in cannot be verified without provider configuration. Local Mailpit delivery can be exercised. No new matching or chat architecture is required. Polls have no existing API and are outside this polish change.

## Verification targets

Run isolated API security/migration tests, local email issuance and consumption, signup/login/logout/recovery, ordered photo uploads and authorization, story playback/gestures/lifecycle, and focused game/profile/date regressions. Export Android, iOS and web bundles; build and exercise the Android emulator. Native iOS runtime and real provider delivery remain explicitly unverified on this Windows host. Record executed results in `verification.md` after implementation, rather than treating this plan as evidence.
