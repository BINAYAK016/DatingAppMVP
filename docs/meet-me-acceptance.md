# Meet Me acceptance matrix — planned, not run

Prepared 1 October 2026 for the Authentication + Profile Creation 2.0 proposal. **Every case below is a future acceptance check. None has been executed for the new feature.** Existing beta results in [verification.md](verification.md) do not establish acceptance of this redesign, its migration, or a future verification provider.

Use isolated, unmistakably fictional accounts and consented test media. Record the source/build, API version, migration version, platform, device/OS, fixture, assertion and actual result when executing. API checks must use an isolated database. Browser fixtures and provider stubs can establish failure handling and state transitions; they cannot establish real Google sign-in, liveness accuracy, native capture or Android/iOS parity.

## Decisions required before dependent tests

- Keep Serious relationship, Marriage and Casual dating equally prominent, as previously agreed. Do not silently replace stored intentions with the brief's softer wording.
- Agree on stable identity/matching categories, self-description semantics and display defaults. Gender, optional orientation and meeting preferences are separate concepts. A trans person uses their self-identified matching category without a separate dating mode or inferred classification.
- Choose topic-draft persistence and its guarantees: device-local restart recovery versus server-backed, cross-device recovery. Do not label an unsaved local answer as saved to the server.
- Approve additive fields, projection rules, migration and profile-media ordering/setup access. Preserve existing auth, mutual-like matching, chat, match-only social audiences and safety rules.
- Select and approve a real liveness/photo-comparison provider, reference-photo policy, retention and returning-user transition before implementing live verification. Decide which reads/writes are gated while a verification is pending. Email verification alone must never produce an identity badge.
- Voice introduction remains optional and requires separate audio permissions/storage/deletion acceptance if included. Its omission must not block completion.

Unresolved decisions are **pending**, not waived or passed. The matrices describe required outcomes, not implemented functionality or permission to introduce an unapproved provider.

## Authentication and stale OTP correction

| ID | Future scenario | Acceptance assertion | Planned evidence |
| --- | --- | --- | --- |
| A01 | Register valid email/password; incorrect, incomplete and pasted OTP | Backend issues and validates a real six-digit code. Paste/autofill fills the input once; invalid codes show an actionable error without advancing or losing the email. Keyboard and focus do not repeatedly reopen after success. | API + browser + device |
| A02 | Expired code, exhausted attempts, early resend and resend after cooldown | Existing expiry, single-use, attempt and send limits remain enforced server-side. Countdown follows the returned server deadline; a restart does not reset it. Retry instructions distinguish expiry from throttling. | API clock fixtures + browser |
| A03 | Code-send or verify request fails, times out or returns after navigation | No simulated success. Saved account state is revalidated on recovery; controls leave pending state and show Retry. A late response cannot navigate a different account or verification screen. | API + delayed browser transport |
| A04 | Correct an unverified account's email while a verify/send for the old email is in flight | Only an authorized, still-unverified account can use correction. After the correction commits, old-email codes and late old-generation responses cannot verify the new address, replace its displayed email, start its countdown or advance onboarding. Already-committed verification is re-read and prevents using correction as a verified-account email-change bypass. | API concurrent requests + browser delayed responses |
| A05 | Resend races with correction; old SMTP completion arrives last | Code issuance and redemption remain bound to the current account, address, purpose and challenge generation. A code sent to the old address cannot verify the corrected address. Failure and retry preserve server cooldowns; account switching invalidates pending UI work. | API controlled mail transport + browser |
| A06 | Correction to malformed, already-associated or unchanged email | Validation is clear; collision cannot merge/link accounts or disclose another account's profile. Failure preserves the prior authoritative address/challenge state. Use the agreed no-op/resend behavior for an unchanged address. | API + browser |
| A07 | Return with verified email, incomplete profile, completed profile or expired session | Route from authoritative account state. Verified email is not reverified unnecessarily; incomplete accounts resume Meet Me; completed accounts use the normal app; expired sessions recover through authentication without showing another user's draft. | API + browser + restart on device |
| A08 | Real Google: new/existing user, cancellation, offline and provider error | Validate tokens server-side against configured audiences. New users enter the appropriate incomplete flow; existing users retain their data. Cancellation produces no account/session; errors recover without fake success or client secrets. | Configured provider + Android/iOS devices |
| A09 | Google email collides with a password account, or token has wrong audience/unverified email | Preserve explicit linking policy; no email-only automatic account takeover or account merge. Reject invalid credentials and retain privacy-safe errors. Missing provider configuration is displayed truthfully. | API token fixtures + configured provider |

## Journey, preview and recovery

| ID | Future scenario | Acceptance assertion | Planned evidence |
| --- | --- | --- | --- |
| J01 | Complete every required topic on a compact phone | One meaningful topic per screen, readable title and primary action, accessible controls and useful validation. Changing topic resets its scroll position without losing the draft. No completion-percentage pressure or mandatory optional modules. | Browser small screen + both devices |
| J02 | Back, Edit, Skip and revisit an answered topic | Required answers remain intact. Optional skipped modules are absent from the public preview. Changing identity does not infer or silently replace meeting preferences/orientation; incompatible or unresolved choices request confirmation. | Browser + API persisted state |
| J03 | Choose each relationship intention | Serious relationship, Marriage and Casual dating receive equal visual prominence and work with existing reciprocal filters. Existing additional choices remain supported unless an explicit migration is approved. | Browser + API |
| J04 | Reach THIS IS YOU, edit, then confirm | Preview uses the same consent-filtered content another eligible user receives, with no private-field spread. Edit returns to the right topic. The profile does not become discoverable merely by opening preview; only accepted final completion activates it. Confirmation enters Discover directly. | Two-account API + browser |
| J05 | Double-tap Continue/final confirmation; response is lost after server commit | One logical save/completion occurs. Pending controls prevent duplicate actions. Retry/revalidation recognizes committed state instead of creating a second profile or losing the latest answer. | API + browser fault injection |
| J06 | Offline before save or failed save after editing | Retain the editable draft and show what remains unsaved. Do not advance or announce Saved until the authoritative save succeeds. Retry preserves identical intended data; errors never leave a blank or permanently disabled screen. | Browser network faults + device airplane mode |
| J07 | Background, kill or restart at each topic and during upload/save | Restore the last state covered by the agreed persistence guarantee. Reconcile in-flight server saves before continuing; never discard newer saved answers with an older local draft. Do not promise recovery of an unsaved answer that was never persisted. | API + native process restart |
| J08 | Sign out/account switch, then resume on the same device | Drafts are account-scoped; the next account cannot see the prior user's identity, media or OTP. Logout clears sensitive session work; own saved profile can be restored only after authenticating its owner. | Browser + devices |
| J09 | Resume on a second device or upgrade draft schema | Server-backed drafts, if approved, resume the correct topic/data on the second device. Device-local-only mode clearly limits this guarantee. Version migration uses stable topic identifiers, rejects corrupt data safely and cannot downgrade completed server state. | Migration fixtures + two devices |
| J10 | Keyboard, large text, reduced motion, rotation and interrupted navigation | Topic and error remain reachable above the keyboard; safe areas and actions remain usable without horizontal overflow. Back preserves answers; reduced motion removes unnecessary transitions. | Browser layouts + Android/iOS |
| J11 | Optional personality/vibe answers and shared signals | Only answered, consented modules render. Shared-answer text reflects exact agreed answers; no invented numerical compatibility, inferred orientation, attractiveness ranking or AI-generated identity interpretation. | API projection + browser |

## Authorization and private projections

| ID | Future scenario | Acceptance assertion | Planned evidence |
| --- | --- | --- | --- |
| P01 | Read another account via Discover, detail, match, feed author, chat author or media | Apply current eligibility/match/block/suspension checks on the server. Knowing an account/media ID cannot bypass them. Private contact details, raw birth date, matching-only answers, draft state and verification evidence are absent from projections. | API endpoint matrix |
| P02 | Turn identity/pronoun/orientation display off, on, then off again | Public display requires the agreed explicit consent. Turning it off removes the field from authorized profile projections, not just visible text. Other clients refresh/redact stale content; current matching preferences are unaffected. | Two-client API + browser |
| P03 | Request owner-only preferences or verification fields with another token | Deny access even if the requester is a match. No provider tokens, biometric material, similarity values, support notes or raw authentication secrets enter public responses, media URLs, notifications or logs. | API + response/log inspection |
| P04 | Deep-link into Discover/social while email/profile requirements are incomplete | Server gates apply independently of routing; setup access is narrowly limited to the owner and required operations. A client flag cannot mark onboarding or live verification complete. | API unauthorized requests + browser |
| P05 | Pause, block, suspend, delete or revoke access while another client holds a profile/media screen | Revalidate reads and delivery at execution time. Revoke stale access and show a truthful unavailable state; do not reinterpret a temporary network error as profile removal. Unblocking does not restore a match. | API race + two-client browser |
| P06 | Export/delete own account with new optional/private modules | Export only to the owner; include the agreed user data without exposing secrets. Deletion follows the documented retention policy, removes private media access and does not leave orphan verification/audio objects or public badges. | API + storage inspection |

## Six inclusive reciprocal matching scenarios

For all six, use adults with compatible ages, cities and intentions and no block/pause/suspension so gender reciprocity is the only varying eligibility rule. All identities below are self-declared, not inferred from photos, orientation or pronouns. For every accepted candidate verify mutual Likes create exactly one match and unlock chat; one-sided Like remains hidden and does not unlock anything. For every excluded candidate verify absence from Discover, rejection of direct-ID swipe and denial of an unmatched detail deep-link. Returning a candidate is eligibility, not an automatic match.

| ID | Fictional setup | Positive assertion | Reciprocity/nonmatch assertion |
| --- | --- | --- | --- |
| M01 | Man seeking men | Another Man who seeks men is eligible through normal Discover. | A Man seeking only women is excluded despite the viewer's preference; a Woman is excluded by the viewer's preference. |
| M02 | Woman seeking women | Another Woman who seeks women is eligible. | A Woman seeking only men is excluded; a Man is excluded by the viewer's preference. |
| M03 | Man seeking men and women; optional bisexual label | A Man seeking men and a Woman seeking men are both eligible. Hiding/removing the optional label changes no eligibility. | A Man seeking only women or a Woman seeking only women is excluded; Non-binary is not silently added to the viewer's choices. |
| M04 | Woman explicitly open to anyone compatible; optional pansexual label | Man, Woman and Non-binary candidates who include women in their preferences are eligible. Explicit Anyone is distinct from an unknown or unset migration value. | A candidate whose preferences exclude women stays excluded. Neither the orientation label nor Anyone overrides the candidate's consent. |
| M05 | Non-binary person seeking men and women | A Man or Woman whose preferences explicitly include Non-binary is eligible. | A candidate seeking only men/women is excluded if that set omits Non-binary; a Non-binary candidate is excluded by the viewer's selected set. |
| M06 | Self-identified Man seeking men, with an optional private trans self-description | A Man seeking men is eligible in the same Discover system. Hiding/changing the optional description does not alter the canonical identity or meeting preferences. | A candidate seeking only women remains excluded. No special LGBTQ+ mode, disclosure requirement or anatomy/assigned-sex inference is introduced. |

Also run the brief's opposite-sex controls: Man seeking women with reciprocal Woman seeking men is eligible; the reverse viewer produces the same eligibility. Check a nonreciprocal opposite-sex candidate, changed preferences, mixed intents and age/city filters. All checks are planned, not executed.

## Migration and returning accounts

| ID | Future fixture/action | Acceptance assertion | Planned evidence |
| --- | --- | --- | --- |
| G01 | Legacy completed account with canonical gender and preferences | Preserve account ID, email verification, immutable birth date/adult declaration, completion, media order, matches/chat and intentions. New optional modules are opt-in edits; do not replay all onboarding or convert completion into a percentage. | Isolated DB migration + browser |
| G02 | Legacy incomplete account at each of the five existing checkpoints | Map saved data to the first unmet required topic, preserving prior answers and email/adult state. Never guess missing answers or submit final completion before preview confirmation. Back/edit and subsequent restart retain migrated progress. | Five migration fixtures + browser |
| G03 | Known legacy gender tokens with whitespace/case differences | Normalize only explicitly mapped known meanings. Preserve meeting-preference selections without broadening them. Run reciprocity checks before/after and confirm intended eligible sets are equal. | Migration + API comparison |
| G04 | Unknown/free-text legacy gender, including ambiguous self-description | Preserve the original value privately and request owner confirmation of a matching category under the approved policy. Do not infer identity, orientation or assigned sex. Unknown values cannot satisfy restrictive filters through guessed normalization; existing matches/chat remain intact. | Migration + owner/nonowner projections |
| G05 | Unknown/noncanonical preference values versus explicit Anyone | Preserve unknown choices for correction; never convert them to an empty/Anyone set that expands the audience. An explicitly saved Anyone selection retains its meaning. Cancelled correction leaves authoritative data unchanged. | Migration + API eligibility comparison |
| G06 | Legacy intent or partially stored optional fields | Preserve original data and current accepted explicit intentions; flag unsupported values for owner review rather than silent soft-label replacement. Absent optional fields remain absent and private defaults do not turn on public disclosure. | Migration + projections |
| G07 | Migration re-run, interrupted deployment or rolled-back app | Migration is repeat-safe and additive; existing clients can still authenticate/read permitted profiles. Retry cannot duplicate media/prompts or lose matches. Document rollback boundaries and resolve partially migrated rows without guessing identity. | DB migration/rollback fixtures |
| G08 | Completed user returns after introducing live verification | Apply the explicitly approved transition policy; no silent reset of `onboarded_at`, email or matches. Show real current status and a clear verification request where required. Preserve existing conversations under the agreed gate policy. | Migration + browser + provider |

## Profile media, ordering and failures

| ID | Future scenario | Acceptance assertion | Planned evidence |
| --- | --- | --- | --- |
| U01 | Verified incomplete owner adds main/gallery photos through camera/library | Narrow setup authorization permits only the owner's approved profile-media operations; unrelated social/game endpoints remain gated. Main photo satisfies the existing image requirement; media count/type/size limits remain enforced. | API + both native cameras |
| U02 | Select multiple photos, preview, reorder, save, restart and inspect as another eligible user | Exact approved ordering persists atomically and is consistent in preview, gallery, main portrait and public projection. No duplicate IDs or ambiguous positions; repeated save/retry preserves the same intended order. | API + browser/device |
| U03 | Submit foreign, duplicate, deleted, wrong-purpose or invalid-kind media in an order/update | Reject the whole invalid mutation without partial changes or exposing foreign media. Validate ownership, purpose and current availability server-side for every ID, not only the first. | API negative matrix |
| U04 | Remove main/reference image, remove non-main or reorder during pending upload | Require a valid replacement for a required main image; show immediate versus deferred save honestly. Failed removal/order keeps authoritative media unchanged and offers Retry; pending controls prevent conflicting writes. Apply verification invalidation below if reference changes. | API + browser |
| U05 | Permission denied/limited/revoked, picker cancelled or capture unavailable | Explain camera/library permissions without trapping the user. Cancellation retains existing images. Limited library access works; available fallback is truthful. Preview never implies an upload succeeded. | Android/iOS devices |
| U06 | Upload fails, app backgrounds, connection returns or session expires | Retain retryable local selection where supported; refresh authorization safely. Do not attach a failed/foreign upload or fabricate a thumbnail success. Temporary/orphan objects follow documented cleanup; successful media remains private. | API + device network faults |
| U07 | Same post/profile media IDs become inaccessible after privacy/block/deletion | Thumbnail and full-media reads apply current authorization. No public bucket, cached URL or unauthenticated preview bypass. Handle expired/revoked images without showing another account's media. | API + two clients |

## Truthful provider lifecycle and reference-photo invalidation

These are future gates requiring an approved real provider. Stubs can validate app behavior but must be labelled simulated fixtures; they do not prove that a person passed liveness or face comparison.

| ID | Future scenario | Acceptance assertion | Planned evidence |
| --- | --- | --- | --- |
| V01 | Provider not configured or unsupported | Show unavailable/pending configuration honestly; never display Sangai Verified or a simulated success. If live verification is a launch prerequisite, record this as a release blocker rather than silently bypassing it. | Browser + configuration inspection |
| V02 | Real successful liveness and supported reference-photo comparison | Only the authenticated server's validated provider result produces a current badge. State is bound to the account, attempt, designated reference IDs/revision and supported checks. Explain what was checked; no trust score or guarantee of safety. | Real provider + device + API |
| V03 | Pending, poor lighting, mismatch, timeout, network/provider outage and retry | Differentiate technical failure from failed verification. Offer appropriate retry/support; no automatic ban/unmatch. Pending states never receive a badge; repeated taps cannot create uncontrolled attempts. | Provider test cases + devices |
| V04 | Background/close/restart or cancel while verification is pending | Release capture resources, reconcile real server status on return and handle late results safely. A cancelled, superseded or other-account attempt cannot update the active profile. | Provider lifecycle + Android/iOS |
| V05 | Replace/remove the verified main or designated reference photo | Atomically invalidate the old badge/reference binding. Public projections stop claiming current verification immediately; recheck uses the new revision. Failed replacement must not invalidate an unchanged authoritative reference. | API transactional race + two clients |
| V06 | Reorder unchanged reference IDs or edit unrelated text/preferences/world media | Retain valid identity status when the designated reference content is unchanged. A reorder that changes the designated main/reference follows V05. No unnecessary recheck merely because a profile text field changed. | API + browser |
| V07 | Old successful provider result arrives after reference replacement or another attempt | Reject/ignore the stale binding; it cannot restore a badge for different content. Duplicate callbacks are idempotent; forged/invalid callbacks cannot set verified state. | API signed-callback/race fixtures |
| V08 | Provider revokes/expires a result, user deletes data or retention deadline passes | Authoritative status/badge updates under the approved policy. Collect and retain only approved necessary data; delete protected capture/reference artifacts on schedule. No public biometric data, raw comparisons or vendor secrets. | Provider + retention/storage inspection |

## Optional voice introduction

| ID | Future scenario | Acceptance assertion | Planned evidence |
| --- | --- | --- | --- |
| O01 | Skip, record, replay, delete and rerecord | Entire module is optional. Use the agreed approximately 5–10 second limit and approved codecs; replace/delete the previous recording safely. No default recording or automatic public playback. | API + microphone on both devices |
| O02 | Denied/revoked microphone, interruption, background or failed upload | Stop/release recording resources, retain truthful state and offer Skip/Retry. No blank screen, phantom uploaded recording or permanent pending action. | Android/iOS devices |
| O03 | Nonowner reads recording, then block/privacy/deletion revokes it | Audio follows approved profile audience and private media authorization, projection, export, deletion and retention rules. The optional module does not expand social/profile audiences. | API + two clients |

## Device and delivery evidence — all pending

| Platform/check | Required future evidence | Current status for Meet Me 2.0 |
| --- | --- | --- |
| API and migrations | Isolated database results for matrices above, concurrency/security negatives, repeat-safe migration and retained legacy behavior | Not run |
| Browser | Compact 360×640, larger 412×915, tablet layout, keyboard/large text, topic navigation, failure/recovery and two-account privacy checks | Not run; cannot establish native parity |
| Android | Development/preview build, compact and large emulator plus physical phone; camera/library/microphone permissions, process death, background, keyboard/back/safe areas, real provider and Google | Pending; existing beta Android evidence does not cover this feature |
| iOS | Supported simulator plus physical iPhone; native Google/liveness, capture/audio, limited Photos, interrupted recording, restart, keyboard/safe areas and background | Pending; no Meet Me 2.0 iOS runtime claim |
| Accessibility/privacy | Screen-reader labels/focus, large text, reduced motion, privacy toggles, response/notification/log redaction | Not run |
| Release review | Approved provider configuration, truthful status/copy, retention/deletion, rollout/rollback and documented open issues | Pending |

When execution begins, retain each case's actual outcome and evidence separately. A bundle export, a provider stub, a passing older test suite or screenshots without the stated assertions cannot be reported as a completed new-feature journey. Do not declare Meet Me 2.0 complete while required real-provider or native acceptance remains pending.
