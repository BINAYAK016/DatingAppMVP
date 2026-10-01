# Meet Me: authentication and profile creation 2.0

**1 October 2026 — Phase 2 proposal, not an implemented feature.** Baseline: `35fd0d3`, `feat/sangai-redesign`. Read with the [source audit](meet-me-audit.md) and [planned acceptance cases](meet-me-acceptance.md). The accompanying fictional design preview explores the journey; it does not authenticate, upload, record or verify anyone.

The latest brief asks for an audit and proposed flow before implementation. This proposal retains the current native Expo/React Native app, NestJS API, PostgreSQL, private media and four tabs. No application source, schema, dependency, Docker configuration or provider account has been changed in this phase.

## Product idea

**IDEA:** The profile is the result of meeting someone, rather than a form they have to compose. Small choices and moments become a readable introduction that can also give a mutual match something specific to say.

**WHY:** A blank bio asks users to perform. A question such as “Your ideal first date?” or “Show something you love” gives them a starting point. Showing their actual profile at the end lets them decide whether it represents them.

**UX:** Four quiet chapter labels—You, Your world, Your vibe, Live—with one topic per screen. No profile-completion score. Answer, see a meaningful result, continue; optional topics have Skip. Use existing warm Sangai colours and native controls, with accessible touch targets and reduced-motion support.

**BUSINESS VALUE:** Test whether more people finish a profile, resume a saved journey, and start a mutual conversation. These are hypotheses, not demonstrated retention gains. Measure aggregate checkpoint completion and first conversations without logging orientation, answers, selfies or private message text.

**TRUST/SAFETY:** Identity display is under the user's control. Preferences remain private and reciprocal. Real live verification has a narrow meaning, and never implies verified age, legal identity or guaranteed safety. No government ID, phone verification, face-search collection or duplicate-person surveillance is proposed.

**TECHNICAL IMPACT:** Add typed profile answers, privacy-aware projection, durable topic progress, ordered profile media and an owner preview. Preserve authentication, matching consent and the match-only social loop. Live verification and optional audio require separate native and server capabilities.

**COMPLEXITY:** Medium for the core journey; high for real cross-platform liveness. Optional voice is a medium extension and remains skippable.

## Proposed authentication flow

1. **Create account:** email and password, clear policy agreement, existing password rules and human errors. Retain Login and password recovery. Do not add personal-profile fields to this screen.
2. **Check your inbox:** show the account's address; real six-digit backend OTP, autofocus, paste/autofill, expiry and resend countdown. Incorrect, expired, exhausted and network-error states stay on this screen with a useful action.
3. **Change email:** correct an unverified password account after password confirmation. Preserve its progress, invalidate existing verification/reset challenges and send a new code. Old in-flight emails cannot activate an old challenge after correction. Google/verified-account email changes are outside this narrow correction route.
4. **Google:** reuse native Google Sign-In and server ID-token validation. Cancel returns safely. Provider/network errors offer retry. Existing password email collisions do not silently link accounts. A verified Google email skips OTP, but does not skip adulthood, profile or live requirements.
5. **Returning account:** restore the secure session. Show recovery/retry when state is unavailable, rather than treating a network failure as logout. Resume incomplete onboarding from saved progress; completed accounts retain their existing profile.

Production SMTP and Google configuration are still deferred under the user's earlier instruction. Mailpit delivery is useful local evidence, not proof of delivery to a real inbox. Those flows cannot be declared externally working until actual configuration and provider journeys are tested.

## Proposed Meet Me flow

Required topics are short and factual. Optional expression topics can be skipped and edited later. The order below uses stable topic identifiers, not new numbers substituted into the legacy five-step contract.

| Chapter | Screen | Purpose and behaviour |
| --- | --- | --- |
| Introduction | **MEET ME** — “Don't build a profile. Let us meet you.” | Explain one topic at a time and saved progress. One primary action. |
| You | “What should we call you?” | Public first name. |
| You | “When's your birthday?” | Private birth date; server calculates age and enforces 18+, plus explicit adult declaration. Preserve the existing immutable declared birth date. |
| You | “Where's your chapter happening?” | Choose Kathmandu, Bhaktapur, Lalitpur, Pokhara, Sydney, Melbourne, Perth or Brisbane. Broad city only. |
| You | “Who are you?” | Man, Woman, Non-binary, Other/self-description or Prefer not to say; separate optional description. Explain public display versus matching use. |
| You | “How should people refer to you?” | Optional pronouns, including self-written pronouns; independent display control and Skip. |
| You | “Anything else you'd like to share?” | Optional self-described orientation and display control, hidden by default. Skip without penalty. Never derive it from gender or partner preferences. |
| You | “Who would you like to meet?” | Select multiple supported gender categories or explicitly choose Open to anyone compatible. Include self-described people. This choice is matching-only and requires reciprocal consent. |
| You | “If this goes well, what would you hope happens?” | Equal prominence for **Serious relationship, Marriage and Casual dating**, plus Friendship first and Still figuring it out. Preserve current stored intent values. |
| Your world | “Your profile starts with you.” | Clear main face photo. Camera/library, multiple selection, preview, remove and accessible reorder; at most six existing gallery items. Main photo must be an image. |
| Your world | “Show us something you genuinely love.” | Optional short text, photo or short video; existing private-media validation and ownership. Alternative prompts: everyday you, unexpected side, “The quickest way to win me over is…” or “We'd get along if…”. No forced conventional bio. |
| Your vibe | “Forever by the sea, or up in the clouds?” | Optional Beach/Mountains answer. |
| Your vibe | “It's Saturday. No plans yet.” | Optional Slow morning/Sports/Gaming/Movies/Adventure/Friends. |
| Your vibe | “Your ideal first date?” | Optional Coffee and a walk/Dinner and deep talks/Adventure/Games and laughter. |
| Your vibe | “How does your energy feel?” | Optional Introvert/Ambivert/Extrovert. A self-description, not a psychological assessment. |
| Your vibe | “Your weekend mood?” | Optional Cozy at home/Adventures/Social butterfly/Creative mode. |
| Your vibe | “What kind of conversation pulls you in?” | Optional Deep talks/Memes/Random nonsense/Flirting/Debates. |
| Your vibe | “What makes you light up?” | Select interests; retain existing bounded interest choices. |
| Your vibe | **Let them hear you** | Optional 5–10-second voice introduction: record, stop, replay, delete, re-record or Skip. No automatic transcript or voice inference. |
| Live | **MEET ME — LIVE** | Explain camera capture, comparison against the selected reference photo, provider/region and retention before consent. The provider controls the genuine challenge; never substitute a scripted smile/turn animation for a check. |
| Preview | **THIS IS YOU** | Actual shared public profile renderer, including only answered and visible modules; no fake badge. Edit returns to the saved topic. |
| Completion | **Looks good → Meet people** | Server validates the applicable readiness policy and current reference verification, then commits completion. Enter Discover directly. |

The minimum new profile is name, private valid birth date/adult declaration, broad city, identity category, explicit partner-preference choice, intention, clear main photo and interests. A conventional bio and all expression questions are optional; blank sections are omitted. This explicitly relaxes the current mandatory bio/prompt requirements for the new contract, while retaining the legacy contract and legacy text. Users can add a chosen prompt or media moment without being forced to invent a paragraph. Preview must make even a minimal profile look honest, rather than fill it with generated answers.

The existing age/city/intention preference controls remain accessible without inventing a location permission requirement. No inferred orientation, separate LGBTQ+ mode or compatibility percentage is introduced. Trans users choose the identity that represents them, without being forced into a separate gender category.

## Persistence, media and preview contract

- Save each topic on Continue/Skip through a validated, account-scoped endpoint. Only acknowledge “Saved” after server success. Preserve unsent bounded answers in an account-scoped secure native pending draft; do not store passwords, OTPs, raw media or biometric evidence there. Clear it on logout/account deletion and reconcile with the latest server revision after restart.
- Keep Back and Edit without discarding answers. Network loss retains the pending topic and exposes Retry. Session expiration returns to authentication and reloads that account's saved progress; another account must never inherit the draft.
- Use stable versioned topic IDs and a monotonic server revision to reject stale saves rather than silently overwrite later edits from another device. Do not mark unfinished profiles discoverable through a progress write.
- Narrowly allow verified adults to manage their own gallery before completion. Repair existing position collisions deterministically; use one atomic order normalizer for old and new add/remove/main-photo/reorder paths. Reject foreign, duplicate, missing or extra media IDs.
- Photo/video prompt answers refer to owned profile-purpose media. Remove a reference safely, remove its prompt association, and include all selected references in orphan cleanup/export/deletion. Upload errors remain retryable; an unacknowledged upload is never portrayed as finished.
- New voice recording uses SDK-compatible Expo APIs, permission handling, private audio upload and server format/size/duration validation. It requires a regenerated native build. Do not call video audio an implemented voice introduction.
- An authenticated owner-only preview uses the same public projection as Discover/matched profiles. The owner can preview hidden-field choices before becoming eligible; no other user may preview an incomplete account. Matching preferences, DOB and verification evidence never appear in this projection.

## Live verification proposal — approval required

**Recommendation: prototype AWS Rekognition Face Liveness with stateless CompareFaces.** Liveness supplies a reference frame; comparison can match that face to the designated existing profile image without an ID document or persistent face-search collection. This is biometric machine learning, so it requires an explicit exception to the earlier no-AI beta rule limited to verification. It adds no AI chat, profile writing, recommendations or personality scoring. [AWS liveness](https://docs.aws.amazon.com/rekognition/latest/dg/face-liveness.html), [CompareFaces](https://docs.aws.amazon.com/rekognition/latest/APIReference/API_CompareFaces.html).

| Option | Tradeoff and unknowns |
| --- | --- |
| **AWS prototype** | Official Android Compose and iOS SwiftUI capture components; a custom Expo native module/config plugin is needed. Existing Sangai auth can remain in place using temporary credential providers. Expo 57/RN 0.86 compatibility has not been proven; do a native trial before committing to this provider. [Android component](https://ui.docs.amplify.aws/android/connected-components/liveness), [iOS component](https://ui.docs.amplify.aws/swift/connected-components/liveness). |
| **iProov quote first** | Official React Native SDK and documented Australian tenant. Commercial pricing/trial and exact regional retention need a vendor quote. Confirm that an untrusted dating-profile reference is acceptable for its photo-enrolment process. SDK 57 compatibility remains untested. [Native SDK](https://github.com/iProov/react-native), [regions/setup](https://docs.iproov.com/implementation/api/prepare), [photo enrolment](https://docs.iproov.com/implementation/api/flow/photo-enrol). |
| **Regula** | Native liveness and face comparison with a protected service; its documented React Native wrapper is deprecated, so maintenance/self-hosting work is higher. Commercial licence and retention cleanup require evaluation. [Installation](https://docs.regulaforensics.com/develop/face-sdk/mobile/getting-started/installation/), [architecture](https://docs.regulaforensics.com/develop/face-sdk/overview/architecture/). |

AWS currently lists Mumbai among supported liveness regions and does not list Sydney. Mumbai is a proposed processing region, not a chosen deployment. It would require clear cross-border disclosure for both target markets and consent before sending verification imagery. Do not assume other provider support/logging copies share the selected region. Configure the AWS Organizations AI-services opt-out before real biometric processing. [Regions/data use](https://docs.aws.amazon.com/rekognition/latest/dg/face-liveness-faq.html).

Published AWS US East pricing is a **benchmark only**: USD 0.015 per liveness attempt and approximately USD 0.001 for one comparison, about USD 16 per 1,000 such attempts. Confirm selected-region prices before enabling it. Retries, quality checks, infrastructure and taxes are additional; no free trial or budget is assumed. [Pricing](https://aws.amazon.com/rekognition/pricing/), [billing FAQ](https://aws.amazon.com/rekognition/faqs/).

Proposed implementation boundaries:

1. The server creates a short-lived attempt tied to authenticated account, consent version and selected reference-photo revision. Rate-limit starts/retries, bound spend and never embed permanent AWS credentials in the app. Clients receive only temporary capture credentials with the minimum API permissions; session-ID scoping must be verified against AWS IAM support, not presumed.
2. Capture through the genuine supported SDK. The server fetches the provider result and compares faces. Client success callbacks, uploaded screenshots, local developer flags and forged webhooks cannot grant verified status.
3. Choose thresholds through representative device/lighting testing and senior review; do not blindly use API defaults. A comparison can be wrong. Offer retry/support review and a real accessibility escalation path without silently awarding verification or banning a person. [Comparison limitations](https://docs.aws.amazon.com/rekognition/latest/APIReference/API_CompareFaces.html), [liveness recommendations](https://docs.aws.amazon.com/rekognition/latest/dg/recommendations-liveness.html).
4. Use minimal retained private metadata: provider, opaque attempt ID, consent version/time, reference revision, status/reason class and timestamps. Proposed states: not started, capturing, processing, verified, retry needed, technical error and expired. Do not place biometric evidence or numerical scores in public profile metadata or application logs.
5. Request no audit frames or S3 result output; discard the reference frame after comparison, without a face collection. Session results expire after three minutes, which does **not** prove every provider copy is deleted then. Document the provider's contractual retention and deletion separately. [Session API](https://docs.aws.amazon.com/rekognition/latest/APIReference/API_CreateFaceLivenessSession.html), [output settings](https://docs.aws.amazon.com/rekognition/latest/APIReference/API_CreateFaceLivenessSessionRequestSettings.html).
6. Bind the verified badge to unchanged reference media. Replacing the designated main/reference face photo invalidates it atomically, and stale in-flight results cannot restore it. Reordering the same unchanged reference or editing unrelated world media/text/preferences does not require a new check. For any already completed member, preserve existing matched chats/social while re-verification is pending, hide the badge, and suspend new Discover exposure/swipes until a real recheck succeeds. Initial activation of a new account still requires a genuine successful check. No failed or technical attempt automatically unmatches or bans anyone.
7. A badge means only that a live face passed this process and matched the reference photo. It verifies neither legal identity nor age and offers no safety guarantee.

**Native Android and iPhone evidence is required.** AWS does not support virtual-camera inputs, so emulator capture is not sufficient liveness proof. Android Studio remains useful for the surrounding journey. There is no configured iOS build/signing path on this Windows laptop; the user has no paid Apple Developer membership. Arrange a Mac/physical iPhone test or later signing credentials before claiming native iOS verification. [Device requirements](https://docs.aws.amazon.com/rekognition/latest/dg/face-liveness-requirements.html).

## Existing accounts and compatibility — transition pending

Completed profiles, matches, chats, media, verified emails, DOB declarations and sessions must survive migration. Never retroactively invent a live result. Existing users currently have no genuine liveness verification to reuse; no badge can be backfilled from email/adult declaration.

Proposed transition for review: require live verification at the next Discover visit, while allowing existing matched communication and social access under existing privacy rules. Do not delete/reset the profile or force completed users through Meet Me again. Until they pass, exclude them from new Discover exposures and new swipe decisions. A second option is grandfathering existing accounts' discovery access without a badge, while requiring all new accounts to verify. The user must choose; neither is silently selected.

That distinction must exist on the server: profile/matched-social access and permission for **new discovery** are separate checks for the legacy cohort. New accounts cannot reach protected dating/social APIs or become a candidate before meeting their applicable requirements. Common cohort-aware validators must protect new finish, the old final onboarding route, state, Discover, direct swipes and media access, so a modified client or old endpoint cannot bypass the live gate. Do not apply a new blanket readiness rule that accidentally disables the legacy chats the transition promised to preserve.

Map incomplete legacy checkpoints to the first unmet new required topic. Keep saved values and optional modules; do not repeat verified email/adult declarations or discard a prior answer. Normalize only exact known gender meanings, trimming/case; retain unknown values privately for owner confirmation. Do not infer identity or convert unknown preferences to Everyone. Retain existing matches while enforcing conservative reciprocal eligibility for new introductions.

Add the next unused immutable migration for bounded identity/display/answer/progress fields, repaired gallery ordering and minimal verification metadata if the provider is approved. Games 2.0 and the audit foundations now allocate 007–009; do not edit any applied migration. Old edit payloads that omit new properties must preserve them. Old API shapes stay readable, but clients unable to complete new mandatory steps may need a clear upgrade response. Never mistake shape compatibility for permission to bypass the new process.

## What Discover will do with the answers

Keep reciprocal age, city, intention and gender eligibility and all block/suspension/demo checks. Orientation is not an eligibility signal. Show profile answers and factual shared-interest/question context, such as “You both chose slow mornings,” only when both public answers support it. Never invent matches, intentions or compatibility scores. Do not infer caste, ethnicity or personality traits.

Use those facts as optional conversation starters after a mutual match, with normal user choice to send. Do not auto-send messages or leak private live-game answers. Discover → Match → Chat → Sangai → Date remains the product loop; social posts/stories/snaps remain limited to active matches. No new social group or public feed is introduced.

## Implementation and completion evidence

Follow the requested phase sequence: preserve/fix real email auth and correction → Google integration checks → one-topic saved journey → identity/privacy and reciprocal regressions → profile media/order → personality modules → approved real liveness → actual preview → gated Discover → native/error/privacy tests → visual polish.

Core work can proceed independently of the pending external service decision. No liveness provider will be introduced before approval of the provider, processing region and verification-only machine-learning exception. No paid resources will be created without authorisation, and no unfinished live implementation will be labelled complete. Google/production SMTP remain configuration-dependent. Voice is optional for users but, if included, must actually record/play/delete on native devices rather than have inert app buttons.

Use [58 planned acceptance cases](meet-me-acceptance.md) plus checks appropriate to implementation. Record executed evidence separately in [verification.md](verification.md). Minimum release evidence includes migration on an existing database, rejected completion bypasses, OTP correction races, reciprocal preferences, hidden-field projections, restart/offline recovery, owned media ordering, permissions, provider failures/stale results, deletion and real Android/iOS journeys. Browser design checks establish only the proposal's presentation; they do not prove authentication, liveness or native parity.
