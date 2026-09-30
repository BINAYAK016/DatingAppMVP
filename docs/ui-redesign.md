# Sangai frontend redesign — 1 October 2026

## Scope

The user requested a full UI/UX transformation of the working Expo 57 / React Native 0.86 application. The four tabs remain Discover, Chat, Sangai and Profile. This work changes frontend presentation and interaction only. Backend code, migrations, contracts, authentication, matching, chat rules, business logic and data models are frozen.

## Audit before implementation

| Screen | Current problem | Keep | Remove | Redesign |
| --- | --- | --- | --- | --- |
| Welcome | Tall generic gradient banner and repeated marketing copy push actions below the viewport | Brand, Google/email choices, login, demo entry | Banner wrapper and duplicate slogans | Airy first impression with restrained brand motif and thumb-friendly actions |
| Sign-up / login | Welcome banner above a dense bordered form; demo entry recently added but layout remains long | Exact auth handlers, adult declaration, policy access, demo retry | Repeated hero and card shell | Focused form, compact header and visible demo shortcut |
| Password reset | All fields shown before a code is requested | Existing request/reset APIs and expiry semantics | Simultaneous unrelated fields | Email stage then code/new-password stage |
| Onboarding / email verification | Small labels, generic fields, repeated instructions and equally weighted buttons | Verified-email gate, five persisted profile steps | Repeated explanations | Clear topic headlines, progress and large selections |
| Discover | Marketing header, huge initial placeholder, split generic card, instructions and actions overflow | Swipe/tap, server decisions, undo and preferences | Repeated marketing/instruction paragraphs | Large portrait, readable overlay, compact metadata and three action controls |
| Match | A small inline card with text | Mutual match result and chat shortcut | Inline card presentation | Elegant full-screen pair portrait moment |
| Chat list | Bordered rows, count and chevrons dominate; empty story region | Match list, story access, unread state | Count and repeated privacy paragraph | Story rings, whitespace rows, message hierarchy and unread dot |
| Conversation | Oversized header; secondary actions spread inline | Polling, send idempotency, history, snap/media semantics | Marketing heading and button clusters | Compact portrait header, clean bubbles, anchored composer and action sheet |
| Stories / snaps | Page/card presentation limits media | Current-match access, expiry, view-once closure | Card shell and redundant explanations | Full-screen viewer with concise context and close controls |
| Sangai feed | Heavy card around every post; repetitive labels | Virtualized paging and match authorization | Banner and heavy containers | Large photo/video, editorial text posts and icon actions |
| Post / composer | Generic full form and inline secondary actions | Upload/send endpoints, single attachment, comments/saves/shares | Repeated instructions and chip clusters | Focused preview and contextual sheets |
| Profile | Settings swamp the profile; connection count and repeated cards | Own profile, gallery, bio, intention, interests, editing and safety | Connection count and technical footer | Portrait-led story with settings behind one contextual control |
| Full profile | Initial loading incorrectly looks unavailable; small avatar | Authorized profile/gallery and chat/safety actions | Always-on privacy paragraph | Portrait hero, readable sections, skeleton, distinct error/retry |
| Edit profile | Five wrapping section chips and generic forms | Draft/cleanDraft, current PATCH and six-photo limit | Dense chip navigation | Section index and focused active section |
| Game lobby | Information cards and generic invitation buttons | Selected-match readiness, invitation and both-ready gates | Repeated explanations | Scrollable game-selection sheet with pair/status strip and three expressive game tiles |
| Live game | All five questions look like a school quiz | Existing answer/guess/respond/polling logic | All questions at once | One question at a time, large options and review before lock |
| Plan a Date | Entire form exposed immediately | Existing categories, future-date validation and payload | Dense option chips and long instructions | Activity selection, details, then invitation review |
| Safety / settings | All actions, blocks and reports crowded together | Report/block/unmatch/unblock/export/delete and confirmations | Repetitive notes | Clear rows and contextual actions |
| Free / Plus | Generic cards and repeated preview disclaimers | Approved prices, benefits and preview-only behavior | Repeated notices | Clear billing/region selection, compact comparison and one preview notice |
| Activity | Heavy card for every notification | Existing filtering and mark-read action | NEW tags and repeated boxes | Unboxed rows with quiet unread dots |
| Empty / loading / error | Generic bordered empty cards, spinners and raw errors | Meaningful status and retry | Unhelpful boilerplate | Warm icon/typography states, skeletons, concise recovery actions |

## Design system

- Warm white `#FFFBF8`, charcoal `#2C2529`, dusty rose `#AA536B`, blush `#F7E6E9`, peach `#F8E9DE`, lavender `#EFEBF5`, divider `#EEE4E3`.
- Native system fonts: display 36, screen title 28, section title 22, body 16, caption 13, metadata 11. Supporting text remains readable instead of shrinking to fill space.
- Spacing 4 / 8 / 12 / 16 / 20 / 24 / 32. Primary touch targets at least 44 points. Radius 12 for fields, 18 for media/surfaces, 24 for sheets; circular shapes only for portraits and contextual icon controls.
- One icon family: Ionicons. Content emoji can remain within date/game choices, but primary navigation and controls use icons.
- Reusable header, icon button, portrait image/avatar, bottom sheet, progress indicator, selection tile, skeleton, notice and empty state. Existing functional components consume the new primitives.
- Motion uses restrained opacity/translation and swipe rotation. Reduced-motion preferences are respected where animations are introduced. Heavy shadows and decorative glass effects are avoided.

## Existing data limits

The current API does not provide general online state, identity verification, match last-message timestamps, story-viewed status or multi-attachment posts. The UI will not fabricate these. Only the account owner's email verification is known, and any badge must say email verification. Real uploads continue through authenticated media access. Optional bundled portrait artwork is restricted to clearly fictional demo accounts and never substitutes a real user's missing photo.

## Implementation plan

1. Establish shared visual primitives, portrait fallback and navigation presentation.
2. Transform auth/onboarding and Discover/match.
3. Transform Chat/stories/media and Sangai content presentation.
4. Transform profile/edit/settings, games/date planning and subscription preview.
5. Run typecheck/lint and relevant journeys, export Android/iOS/web bundles, inspect all screens in a mobile browser and the Android emulator, repair layout issues, then build the updated emulator APK.
6. Record actual results and limitations, commit in logical groups and push the existing feature branch. Confirm the backend tree is unchanged from `4f46890`.

## Verification status

The audit preceded frontend modifications. All planned screen groups are implemented, including authentication/onboarding, Discover/match, Chat/stories/snaps, Sangai/posts, profiles/editing/settings/safety, three live games, date planning and approved plan previews.

- TypeScript, Expo lint and whitespace checks pass. All seven browser journeys pass together on the final export: two-session game acceptance/reveal, navigation/stories/chat send, private post creation, regional preview prices/no billing mutation, failed initial demo-list recovery, swipe/undo/profile navigation, and signup/mail verification/upload/five-step onboarding.
- Android/iOS Hermes and web bundles export successfully. Native iOS execution remains unverified on this Windows host.
- Visual QA inspected 360 × 640 and 412 × 915 layouts, with tablet profile/index checks at 768 × 1024. Evidence includes 32 auth/onboarding captures, 12 Discover/match/activity captures, and 100 profile/game/date/safety/pricing captures, plus Chat/feed/media reviews in the delivery's `outputs/ui-qa` directory.
- Actual local demo journeys exercised all three games and date invitations. The mutual-match screenshot used the real Like/match API; only the isolated browser harness reordered already eligible profiles to avoid unnecessary decisions. Network-error screenshots used an isolated aborted request. A pending-state capture fixture stalled and is not counted as loading-state proof.
- Review corrections included complete portrait framing, small-phone demo access, readable contrast, white/rose switches, scroll reset between game/date/edit stages, complete full-screen media, long caption scrolling, access to every current story by an author, feed video play/pause and post-mount autoplay, authenticated browser story/chat video playback, and complete text moments on small phones. Native review also found keyboard overlap, initial conversation positioning and fullscreen player disposal; Android keyboard avoidance, manual-scroll-aware conversation following and route-focused player retention address these presentation issues. Native background pause remains managed by Expo, while Android snap viewers keep their existing background closure and omit a second nested fullscreen control. The game picker now opens as a bottom sheet from Chat. Private native video source headers and all server visibility checks remain intact.
- No online status, identity badge, unavailable conversation timestamps or multi-image post UI is fabricated. Fictional art is restricted to explicit demo IDs; it never substitutes a real account's missing photo.

Native build/device evidence and remaining validation limits are recorded in [verification](verification.md). No public launch or native iOS parity claim is made.
