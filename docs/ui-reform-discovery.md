# UI reform: discovery audit

Date: 8 October 2026. Baseline: `530f3f8` (the approved calm structure / warm cards implementation). Working branch: `feat/ui-reform`.

## Product direction

The core moment is mutual interest becoming a comfortable private conversation. Discover, a mutual-match moment and Chat form the main path. Match-only stories, posts, snaps, games and date plans support that path. Serious relationships, marriage and casual dating retain equal prominence. Keep four primary destinations and the existing light theme; do not add public popularity or online signals.

Design direction: an intimate relationship journal, using expressive editorial headings with readable system-sans controls, portrait-led profiles, restrained warm surfaces and clearer next actions. Preserve the established rose, cream, peach, blush and lavender palette. All backend, authentication, visibility, consent, session and request contracts remain authoritative and unchanged.

## Route and state inventory

The shared Expo Router frontend has 24 route files plus root and tab layouts. `/welcome` re-exports the public entry component. Native and browser use the same screens with platform-specific framing/media adapters.

| Route / area                              | Existing modes and important states                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/`, `/welcome`                           | Welcome, email login, email registration, Google availability, policy consent, validation and connection settings     |
| `/demo`                                   | Three persona groups, paging, ordinary-account entry/return, disabled/unavailable demo and logout retry               |
| `/reset-password`                         | Email request, code and password form, success/error                                                                  |
| `/onboarding`                             | Email verification and five profile steps, validation, pending save and resume                                        |
| Four tabs                                 | Discover, Chat, Sangai, Profile                                                                                       |
| Discover                                  | Candidate, empty/failure, intent preferences, Like/Pass/Super Like/undo, pending decision and mutual match            |
| Chat inbox                                | Match/story strip, unread previews, paging, empty/error                                                               |
| Sangai                                    | Match-only stories/feed, paging, empty/error, post creation                                                           |
| Profile                                   | Compact overview, Edit/Preview, moments, four settings groups, Plus preview, demo tools, deletion/reset confirmations |
| `/activity`                               | Paged updates, mark-read/all, retry/empty; incoming likes remain hidden                                               |
| `/edit-profile`                           | Overview and five section editors, dirty-draft confirmation, photo removal confirmation                               |
| `/profile/[id]`                           | Public profile, complete gallery, current-match chat action, unavailable profile                                      |
| `/chat/[id]`                              | Message/media/snap/game/date timeline, older pages, drafts, attachments, options, readiness/consent and snap viewer   |
| `/compose`                                | Post, story, snap, message, avatar and gallery media; upload/draft/error/discard                                      |
| `/post/[id]`                              | Post detail, comments/replies, reactions, save, share/options/delete and full-photo viewer                            |
| `/story/[id]`                             | Playback, pause, options, current visibility/expiry, unavailable state                                                |
| `/games`                                  | V2 catalog/categories/invite/current game and legacy lobby                                                            |
| `/game/[id]`                              | Seven V2 mechanics, invite/waiting/play/reveal/closed/retry plus retained legacy game                                 |
| `/plan`                                   | Activity, details and date-plan review/submit                                                                         |
| `/my-posts`, `/saved-posts`               | Paged collections, empty/retry                                                                                        |
| `/safety`                                 | Report, block, unmatch, safety information and confirmation                                                           |
| `/subscriptions`, `/subscription-preview` | Nepal/Australia, monthly/annual, Free/Plus benefits, proposed totals; no checkout                                     |

Additional operator interface: `apps/api/src/admin.html` and `admin.js` are served by the API and blocked from public access by the deployed proxy. They have a separate existing green/cream palette and admin-key authentication. This audit inventories them separately from the end-user app; backend/auth files are not being modified.

## Findings before redesign

1. Shared headings lack heading semantics. Button states and input hints/error associations are inconsistent; text can be cramped in paired actions.
2. Rose/muted small text on warm cards fails AA contrast. Decorative dividers are also used as the sole input/selection boundaries.
3. Profile editing and date planning have dense choice groups and raw date/time/CSV fields with help text separated from inputs.
4. Public-profile conversation action comes after the entire gallery, putting a core action far from the person's identity.
5. Full-width desktop footers do not align with the narrower form body. Sheets retain a phone-bottom layout at desktop widths.
6. Post author target is 38px; native settings switches need a larger interactive area. Text zoom and long-copy layouts need runtime checks.
7. Reduced motion already exists but carousel programmatic scrolling and the snap modal have unconditional animation.
8. A few copy/visual hierarchies are stale or uneven, including Plus text describing three games even though all seven exist.
9. Startup uses a single ~1.5 MB web JavaScript bundle and a ~390 KB icon font. Improvements will be selected from measured evidence rather than guessed performance gains.
10. Existing tests cover many flows but not a complete all-route matrix at the requested viewport sizes. Some auth tests send real SMTP through current configuration; the redesign audit must intercept those calls.

## Exact preserved palette

| Primitive    | Value     |
| ------------ | --------- |
| Background   | `#FFFBF8` |
| Ink          | `#2C2529` |
| Muted        | `#7A6D73` |
| Divider      | `#EEE4E3` |
| Primary rose | `#AA536B` |
| Blush        | `#F7E6E9` |
| Peach        | `#F8E9DE` |
| Lavender     | `#EFEBF5` |
| White        | `#FFFFFF` |
| Error red    | `#A7374B` |

Calculated contrast: white/primary 5.05:1; ink/background 14.54:1; muted/white 4.93:1. Primary on blush/peach/lavender is 4.20/4.26/4.30:1; muted on the same surfaces is 4.09/4.15/4.19:1. Preserve the primitives and add stronger semantic foregrounds for tinted surfaces. Decorative divider/white is 1.25:1 and must not be the sole input boundary.

## Evidence boundaries

The findings above are from source inspection and contrast calculations. Baseline export is retained in the task output directory at `sangai-ui-reform/before-export`. Before the baseline export was replaced, the synthetic endpoint-intercepted route matrix captured **131 states at each of 360×800, 768×1024 and 1440×1000 (393 screenshots)**. Screens include ordinary, empty, error, form, sheet, legacy and seven current game modes. Private routes were reached after session bootstrap; initial cold-link failure captures are retained separately as diagnostics. No unexpected API requests, external calls or JavaScript runtime errors were reported in the completed matrix. The Android baseline is the existing API 36 emulator build, connected through the UI to the local API at `http://10.0.2.2:4100`. No EC2 deployment or external OTP submission is part of this audit.

Executed screenshot coverage, performance scores and final device limits will be recorded with the redesign verification. Fixture screenshots prove layout and states; they do not prove real provider delivery or all native hardware behavior.

Valid Discover Lighthouse medians (three fresh runs per device): mobile Performance **53**, Accessibility **96**, Best Practices **100**, SEO **90**; desktop **90/93/100/90**. Mobile LCP 11.167s/TBT 546ms; desktop LCP 1.853s/TBT 30ms. Welcome measurements had incomplete-load warnings and are excluded from the valid baseline. iOS Simulator discovery failed with `spawn xcrun ENOENT` on this Windows host.
