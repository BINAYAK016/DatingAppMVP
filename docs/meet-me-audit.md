# Meet Me authentication and profile audit

**Audit date:** 1 October 2026. **Source baseline:** `35fd0d3` on `feat/sangai-redesign`.

**Status: audit and proposal only; Meet Me is not implemented.** This document records source inspection against the new Authentication + Profile Creation 2.0 brief. No application, API, schema, environment or Docker changes were made for this audit, and no new runtime tests were executed. Existing verification evidence is in [verification.md](verification.md); a proposal or compiled adapter is not proof of provider operation.

Confirmed decisions remain: Android and iOS are the primary applications; serious relationships, marriage and casual dating have equal emphasis; identity, orientation and dating preferences are separate; incoming Likes remain hidden until mutual matching; social content is match-only; no AI. The brief's example intention labels do not silently replace these decisions.

## Actual architecture

| Layer | Current source and runtime |
| --- | --- |
| Mobile | Expo `~57.0.25`, React Native `0.86.3`, React `19.2.3`, TypeScript and Expo Router; shared native screens plus a supplementary web preview. See [mobile package](../apps/mobile/package.json) and [Expo config](../apps/mobile/app.config.ts). |
| API | NestJS `12.1.1`, Express 5 and TypeScript in one deployment, with auth/identity, discovery, social, moments, games, interactions and media modules. See [API package](../apps/api/package.json) and [routes/middleware](../apps/api/src/main.ts). |
| Database | PostgreSQL 17.7 in Compose. Frozen legacy schema plus ordered, checksum-checked migrations through `006_post_media.sql`; transactions use advisory locks. See [database helpers](../apps/api/src/db.ts) and [migrations](../apps/api/src/migrations). |
| Media | Authenticated API delivery from a private local Docker volume; Sharp image processing and FFmpeg video processing. There is no deployed S3 bucket. See [media](../apps/api/src/media.ts). |
| Email | Nodemailer; local Mailpit captures verification/reset emails. External SMTP credentials were deferred by the user. See [authentication setup](authentication.md). |
| Live updates | API polling for account, chat, games and readiness. No Redis or WebSocket service is implemented. Optional Expo push dispatch is off by default and is not a durable job system. See [push adapter](../apps/api/src/push.ts). |
| Local operation | Compose runs API, PostgreSQL and Mailpit; database/media volumes persist separately. Native development builds use the host toolchain. See [Compose](../compose.yaml) and [current beta](beta.md). |

This is a single-instance private beta, not a claim of production readiness or iOS runtime parity. The source still refuses production mode; native iOS execution requires a suitable Mac/device or configured build credentials.

## Authentication: what can be reused

Email/password signup and login are real server operations. Passwords use salted scrypt; server sessions store token hashes and expire after seven days. Signup creates a restricted account rather than granting access to dating/social APIs. Native session tokens use SecureStore; web preview tokens remain in memory. See [auth](../apps/api/src/auth.ts), [store](../apps/mobile/src/lib/store.tsx) and [route guard](../apps/mobile/src/app/_layout.tsx).

Email verification already has backend-validated, cryptographically random six-digit OTPs, challenge/account/purpose-bound HMAC hashes, constant-time comparison, 15-minute expiry and single consumption. It limits attempts, issuances and resend timing. SMTP runs outside the global transaction lock; pending challenges cannot redeem, failed delivery preserves an older usable code, and successful resend supersedes prior challenges. No OTP is returned by the API or displayed as a development shortcut. See [identity](../apps/api/src/identity.ts), [OTP input](../apps/mobile/src/components/OTPInput.tsx) and [verification screen](../apps/mobile/src/app/onboarding.tsx).

The frontend already supports initial sending, first-enabled autofocus, paste/autofill, countdown/resend and inline wrong/expired/exhausted-code errors. Session restoration has persistent retry/sign-out recovery; expired sessions clear local account state. Logout clears local authentication even if its server request fails. Password recovery uses the same response shape for known/unknown addresses; reset consumes a code once and invalidates existing sessions.

Google has a native Google Sign-In adapter, a real web Google Identity Services adapter and server ID-token validation for audience, signature/expiry and verified email. Provider identities are keyed by stable Google subject. Existing password accounts are not silently linked by email alone. New Google accounts skip email OTP but still need the adult/profile journey. See [native adapter](../apps/mobile/src/components/GoogleAuth.native.tsx), [web adapter](../apps/mobile/src/components/GoogleAuth.tsx) and [server identity](../apps/api/src/identity.ts).

Configuration was inspected as presence flags only. Local mail/OTP configuration exists; Google client configuration is absent on this host. Mailpit does not establish real inbox delivery. Actual Google signup, returning-provider login and provider cancellation/failure journeys remain unverified without configured credentials. No client secret belongs in mobile configuration.

**Authentication gap:** no Change email UI or API exists. The existing verification screen masks the address and offers resend/sign-out; it cannot correct a mistyped address while preserving the restricted account.

## Onboarding and profile: existing versus missing

| Requirement | Existing behavior | Gap or implication |
| --- | --- | --- |
| Saved progress | Five server steps: basics; photo/bio; intention/interests; preferences/lifestyle; prompt/completion. Successful saves update canonical user columns and monotonic `onboarding_step`. | Current in-progress answers are component memory. App termination before a step save loses them. Five dense groups do not provide one idea per screen. |
| Adult access | Email verification precedes onboarding. Basics validates 18+, records the declaration and freezes birth date after declaration. Completion requires prior steps, photo, bio and interests. | Preserve this server authority when introducing microsteps and alternative personality expression. |
| Identity | Gender supports Woman, Man, Non-binary and Prefer not to say in the UI. Server gender is bounded text. | No dedicated self-description or pronouns. Arbitrary gender text does not form a reliable matching category. |
| Preferences | Private arrays for genders, cities and intentions, plus age bounds. Empty gender array means unrestricted. | Explicit “open to anyone compatible” must be distinguishable from an unanswered screen through saved progress, without changing legacy empty-array semantics. |
| Orientation/privacy | Gender and preferences are already separate. Email, birth date and preferences are absent from public profile projections. | No orientation field or identity display flags. Gender is currently always projected publicly; frontend hiding would not protect API responses. |
| Same-sex dating | Discover applies both people's gender preferences independently and checks them again when recording a Like. Multiple selections and unrestricted preferences already work. | Add dedicated man/man, woman/woman, multiple-preference and non-binary regression cases; no separate LGBTQ+ mode or orientation-based eligibility is needed. |
| Intention | Serious relationship, Marriage, Casual dating, Friendship first and Still figuring it out. | Retain stored values and equal presentation while changing the question's tone. |
| Photos/video | Camera/library, crop, main photo and up to six profile gallery items; remove confirmation in editing. Profile media uses the existing ownership/purpose authorization pipeline. | Onboarding exposes only main-photo selection. Gallery add/remove routes currently require a completed account. There is no profile reorder endpoint. |
| Photo ordering | `profile_media` has a position column; reads sort by position then ID. | Main-photo insertion always uses position 0; additional insertion uses the current count. Changing main photo or deleting intermediate items can cause position collisions. No uniqueness/range constraint prevents them. |
| Personality | Interests, hobbies, languages, optional lifestyle and one text conversation starter. | No versioned question answers, visual vibe choices or prompt-associated photo/video answers. |
| Preview | Authenticated profiles reuse the private media presentation. | No “THIS IS YOU” onboarding preview; the normal profile route is readiness-gated. |
| Voice | Video may contain audio; microphone permission copy currently concerns video snaps. | No audio-only recorder, media kind, duration validation or profile voice playback. |
| Meet Me — Live | None. Email verification is explicitly not identity verification. | No liveness, face comparison, provider integration, trusted result, retry workflow or verified badge. A captured selfie alone cannot satisfy this requirement. |

Relevant sources: [onboarding API](../apps/api/src/identity.ts), [profile validation](../apps/api/src/validation.ts), [ProfileForm](../apps/mobile/src/components/ProfileForm.tsx), [onboarding screen](../apps/mobile/src/app/onboarding.tsx), [profile editing](../apps/mobile/src/app/edit-profile.tsx), [profile/media routes](../apps/api/src/main.ts), [profile gallery migration](../apps/api/src/migrations/005_profile_media.sql) and [mobile types](../apps/mobile/src/lib/types.ts).

## Existing application boundaries to preserve

The four tabs are Discover, Chat, Sangai and Profile. Authentication routes use an explicit `/welcome` exit to avoid ambiguity with the grouped Discover index. Incomplete accounts route to onboarding; restored sessions with unavailable state get retry/sign-out recovery. See [tab layout](../apps/mobile/src/app/(tabs)/_layout.tsx) and [root layout](../apps/mobile/src/app/_layout.tsx).

Discover has portrait-led profiles, swipe/button alternatives, hidden incoming Likes, idempotent decisions, latest-action Undo and mutual-match celebration. Both participants' preferences apply to discovery and new decisions; blocks/suspension and real/demo separation remain authoritative. See [discovery](../apps/api/src/discovery.ts) and [Discover screen](../apps/mobile/src/app/(tabs)/index.tsx).

Chat includes current-match stories, text/photo/video messages, view-once snaps, paginated history, games and date invitations. Social content is not a public network. Sangai has a paginated feed, ordered multi-photo posts, video playback, comments/replies, private saves and shares to an existing match that recheck access. See [conversation](../apps/mobile/src/app/chat/[id].tsx), [Chat tab](../apps/mobile/src/app/(tabs)/chat.tsx), [Sangai tab](../apps/mobile/src/app/(tabs)/sangai.tsx), [social](../apps/api/src/social.ts), [moments](../apps/api/src/moments.ts) and [interactions](../apps/api/src/interactions.ts).

Three live games exist: This or That, Would You Rather and Two Truths & a Lie. Readiness is temporary and scoped to one selected match; both must be ready and the invitee must accept. Answers/lie indices remain hidden until the appropriate mutual completion. The four further games remain a later approved increment. See [games](../apps/api/src/games.ts) and [game screen](../apps/mobile/src/app/games.tsx). Onboarding personality answers must not reuse a live game's private answer record or weaken these consent rules.

The proposed Meet Me work does not justify rewriting matching, chat, stories, feed, games, Docker or the authentication architecture. Optional shared-answer icebreakers should describe actual answers, not introduce a fake numerical compatibility score or inferred sensitive traits.

## Minimum backward-compatible server changes proposed

These are proposed contracts, not newly available routes or fields. Final names and required/optional questions belong to the approved implementation plan.

### 1. Versioned microstep persistence and shared readiness

**Why:** one-question screens need durable saves and a precise resume position, and new completion requirements must not be bypassed through the old endpoint.

Add a versioned, bounded progress record on `users` (for example `meet_me_progress` JSONB containing version, saved screen ID and completed screen IDs). Save canonical answers into the profile model rather than maintaining a second authoritative profile in an unvalidated draft blob. An authenticated microstep endpoint accepts a known screen ID and its validated answer; returning state supplies the last committed progress. Do not collect abandoned raw keystrokes or claim an offline answer is saved before acknowledgement.

Keep existing `PATCH /v1/onboarding` payloads readable for compatibility, and add a microstep/finish contract rather than renumbering existing steps. Completed legacy accounts retain completion. Map partially completed legacy steps into the new journey without deleting their saved information or repeating email verification. Existing `onboarding_step` remains meaningful to older clients.

**Readiness must remain entirely server-derived.** A shared completion validator must enforce verified email, the adult declaration/valid age, required identity/preference answers, required profile media and the approved minimum self-expression. If live verification is approved as mandatory for the new account cohort, only a trusted successful provider result can satisfy that additional gate. Save/endpoints, public metadata or client flags cannot set verification success.

Both the new finish endpoint and legacy `/onboarding` final step must invoke the applicable shared validator. A new-version account cannot mark itself complete through the old five-step route while skipping new requirements. Older clients may require an upgrade for a new cohort whose required screens they cannot present; API shape compatibility must not be described as unrestricted semantic compatibility.

Apply the same version-aware readiness policy to protected middleware, state projections, Discover eligibility, new decisions, mutual-match checks and media access. Preserve explicit restricted-account setup exemptions for OTP, owner progress/preview, allowed profile media, logout/export/deletion. Do not expand those exemptions into general social access. Avoid trusting `onboarded_at` alone for newly gated accounts.

**Migration/security:** additive migration `007` after the frozen existing migrations; explicit legacy/new-cohort version backfill; bounded progress schema; no changes to historical migration checksums. Existing sessions and identifiers remain intact. Test direct and legacy-route completion attempts before accepting the new gate.

### 2. Inclusive identity, private orientation and display projection

**Why:** identity descriptions must not become accidental matching categories, and sensitive fields need server-enforced display control.

Retain the canonical existing gender values for matching and add an explicit Other/self-description category without deriving orientation. Store the optional description separately. Trans users can choose the gender that represents them without a separate mode or forced public disclosure. Keep private dating preference arrays independent; an explicit unrestricted choice maps to the existing empty array and a completed preference screen.

Add bounded pronouns, self-description, optional orientation selections and validated display flags. New orientation information defaults to hidden; showing it requires an explicit user choice. Preserve legacy gender visibility for existing accounts instead of silently changing their presentation. Optional question/identity answers can be skipped and removed.

Redact in the centralized `publicFields`/profile projection used by Discover, profiles, matches, message authors and social authors. Hidden orientation must not be returned in a raw public object, even if the UI suppresses it. Do not expose flags or answer existence that reveal hidden information. Private canonical gender still drives reciprocal eligibility when its display is disabled. Owner state and export receive the original values through an explicit owner projection.

**Migration/security:** additive user columns/validated JSONB flags with safe defaults, an owner-only projection extension and optional mobile contract fields. Older profile-edit payloads omitting new fields must preserve them rather than reset them through defaults. Test hidden fields across every public projection and after blocks/unmatch. No inference of orientation, caste, ethnicity or attractiveness.

### 3. Structured personality and media answers

**Why:** stored question answers should support truthful profile presentation and optional shared-answer icebreakers.

Add a bounded versioned answer structure with stable question IDs, allowed option IDs and short text limits. It can represent selected everyday/date/vibe questions and optional sentence prompts. Keep legacy bio/prompt/intention fields, and map compatible answers deliberately. Do not repurpose live game answer storage. New-profile completion may accept approved personality expression instead of forcing a conventional bio, but that alternative must be checked by the common validator.

For photo/video answers, reuse selected profile media rather than duplicating uploads. A nullable prompt association/caption on `profile_media` is sufficient if that representation meets the approved UX. Avoid arbitrary JSON media IDs with no ownership checks or retention references.

**Migration/security:** additive answer data and, if needed, prompt metadata on existing profile-media rows. Validate all IDs/types/limits; attach only owned profile-purpose media and keep profile visibility checks. Public answers are explicit profile content, not private orientation/verification evidence. Extend owner export and deletion; retain selected media during cleanup.

### 4. Safe email correction

**Why:** an unverified password account needs to correct an address without losing its saved journey or verifying the replacement through the old inbox.

The minimum scope is an authenticated, password-confirmed change for an unverified password account. Validate/normalize the replacement, check uniqueness without disclosing another account, preserve progress and keep the account restricted. Rate-limit the mutation and avoid silent provider linking. Verified-account or Google-email changes need a separate approved policy rather than being folded into this correction feature.

**Challenge race:** current HMACs bind challenge ID, account and purpose, not email destination. Updating `users.email` alone would allow an old code to verify the changed address. In the same transaction as correction, invalidate outstanding verification and reset challenges, including pending SMTP reservations. Sending to the replacement happens after commit, outside the global lock. Old in-flight mail may still arrive, but its challenge must never reactivate or redeem. Preserve the existing pending-activation guard and verify this race in an integration test. Rotate/revoke other sessions as defined by the correction contract and return a usable current session if required.

**Migration/security:** this restricted correction can use the existing email/challenge/session tables with no email-change schema. A future verified-email change would instead need a destination-bound pending email flow that keeps the old verified address until confirmation. It must not reuse the restricted correction shortcut.

### 5. Profile photo ordering and onboarding gallery access

**Why:** multiple photos, removal and reordering should work before completion, and saved order must be deterministic.

Allow authenticated verified adults to add/remove/reorder their own profile gallery during onboarding. This changes only specific setup-route exemptions; it does not grant readiness or expand media audiences. Keep ownership/purpose checks, six-item limit, image-only main photo and current upload validation.

Add an atomic reorder contract containing the exact current unique media IDs, with an image selected as the main photo. Reject foreign, missing, duplicate or extra IDs. Assign contiguous positions and keep `avatar_id` consistent. Route existing main-photo/add/remove operations through the same normalization helper so old clients cannot reintroduce collisions.

**Migration/security:** deterministically repair existing order first, with current avatar first and stable position/ID ordering for the remainder. Then add an appropriate position range/uniqueness constraint; perform reorder updates without transient constraint collisions. Existing media IDs/files and ownership remain unchanged. Removal should continue to revoke subsequent profile access without promising to revoke already delivered bytes.

### 6. Accurate owner-only preview

**Why:** “THIS IS YOU” must reflect the actual visible profile before introducing the account into Discover.

Expose an authenticated owner-only preview during setup using the same public projection and private media component as ordinary profiles. It must not permit browsing another unfinished account. Show hidden-field choices accurately; edit returns to the saved screen, and acceptance invokes the shared finish validator.

**Migration/security:** no separate preview schema is necessary. A narrowly exempted preview route must remain owner-only and cannot itself mark readiness, create matches or release verification information.

## Capabilities requiring a separate decision

**Voice introduction:** no audio-only support currently exists. Real implementation requires recording/playback with microphone permission/retry handling, a supported native module, an audio media kind and allowlisted format/size/duration processing on the server. Keep it optional, approximately 5–10 seconds, with replay/delete/re-record/skip. Its media authorization, retention, export and deletion must follow selected profile media. Video audio is not an implemented voice-introduction feature.

**Meet Me — Live:** no liveness or face comparison provider is installed or configured. Propose and approve the provider/processing arrangement before integration. Real results need server-created sessions, authenticated or signed result verification, expiry/retry states and provider-error handling. Store only the minimum private status/reference/version/timestamps necessary; do not put raw biometric evidence into ordinary `profile_media`, public projections, logs or the client bundle. Failed capture/technical timeout differs from an adverse verification result and must not automatically ban an account.

A public “Sangai Verified” badge can only be derived from a trusted successful result under the approved process. It cannot mean guaranteed safety, an authenticity percentage or a trust score. New-cohort access requirements and re-verification after relevant photo changes need an explicit policy; preserve accepted previous verification when the policy does not require repeating it. Until a real implementation is approved, implemented and tested, live verification remains a product gap and must not be represented by a simulated success path. Government ID/phone verification, invasive duplicate-identity surveillance and AI product features are outside this proposal. A biometric provider using machine learning would require the explicit verification-only exception described in the [flow/provider proposal](meet-me-plan.md); it is not authorised by the existing no-AI beta decision.

## Export, deletion and privacy obligations

The existing owner JSON export includes profile fields, selected media references, own decisions/content/game answers and provider identities, excluding password/session hashes and the other player's hidden game answers. Deletion removes the user and cascading live rows, sessions/provider challenges, owned media and video posters. Retained moderation records and operator backups have separate limits. See [export](../apps/api/src/account-export.ts), [deletion route](../apps/api/src/main.ts) and [media cleanup](../apps/api/src/media.ts).

Extend export explicitly for new private identity values, display choices, progress, personality answers and minimal verification state where appropriate. Do not export provider credentials, security challenge hashes or a partner's private answers. New tables require user foreign keys with appropriate deletion behavior; new selected media references must be included in retention cleanup so they are not collected while in use. Provider-held verification data needs an explicit deletion/retention process rather than assuming the local user cascade removes it.

Email, full birth date, exact home address, matching-only preferences, hidden orientation, private verification references and biometric evidence must remain absent from public projections. Keep broad manually selected cities, current-match consent, blocks/suspension, real/demo isolation and authenticated media delivery. Adding rich identity/profile content does not make profiles or uploads public.

## Validation required after approval

- Authentication: real local email signup, wrong/expired/exhausted OTP, honest resend, restricted email correction, stale/pending-code race, app restart, session expiration and network recovery. Real SMTP and configured Google journeys need separate provider evidence.
- Compatibility: upgrade an existing database without changing migration checksums; preserve completed/partial accounts, sessions, photo IDs and omitted new fields from old clients. Exercise legacy completion against new-version requirements.
- Identity: man/woman, woman/man, man/man, woman/woman, multiple preferences and non-binary/self-description cases; reciprocal exclusions on Discover, direct Like and media paths; hidden identity/orientation across all public projections.
- Profile: per-screen save/resume/back/edit, skips, uploads/permission failures, add/remove/reorder, exact-set validation, preview and gated completion. Android/iOS keyboard, safe area, backgrounding and actual native permissions require their own evidence.
- Privacy: owner export, account/provider deletion, selected-media retention, foreign/private media rejection, block/unmatch revocation and no sensitive logging.
- Voice/liveness, if approved: real successful/failed/retried provider result, spoof/expired callback rejection, poor lighting, camera/microphone denial, interruption, timeout and minimum-data retention. UI mockups do not satisfy these tests.

The existing tests provide a foundation: [auth integration](../apps/api/test/auth.test.ts), [beta/privacy integration](../apps/api/test/beta.test.ts), [migration checks](../apps/api/test/migration.test.ts), [browser authentication](../tests/ui/auth.spec.ts), [browser onboarding](../tests/ui/onboarding.spec.ts) and [profile/games checks](../tests/ui/profile-games.spec.ts). Extend these around new server boundaries rather than claiming unchanged tests verify unimplemented Meet Me behavior.
