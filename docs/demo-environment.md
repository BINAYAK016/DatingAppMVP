# Controlled Sangai demo world

This is a private, synthetic environment for exploring the actual **Profile → Discover → Like → Match → Chat → Stories → Games → Sangai → Plan a Date → Profile** journey. It uses the existing native Android/iOS app, PostgreSQL-backed matching and consent, private media, chat and games. It is not a separate simulated frontend or a public dating population.

## Start and enter

Set both `DEMO_MODE=true` and `ENABLE_DEMO=true` in the ignored local server configuration, then follow the existing Docker and native run instructions. The normal entry shows **Sangai Beta**, **Choose a profile**, and paged **Men**, **Women**, **LGBTQ+ / Other** groups. Each group contains ten fictional profiles. Selecting **Enter as [name]** creates the existing scoped demo session directly; no email, OTP, Google, password or live-selfie step is needed.

The selected account enters the same Discover, Chat, Sangai and Profile screens. **DEMO MODE** remains visible. Use **Switch Demo User** to choose another perspective without a normal logout/login journey. Switching clears the previous account's local projections and private game drafts; the server world and existing conversations remain available to the next selected profile.

Keep `ENABLE_GAMES_V2=true` for the seven-game journey and report runner. The existing flag-off rollback omits the baseline v2 games; a games-on inventory must not be presented as an active flag-off world.

To restore the real-account entry, disable both flags. Existing authentication remains intact for its later phase; real Google/SMTP credentials and provider end-to-end validation remain separate. Neither mode approves a public deployment, removes the production guard, or establishes identity verification.

## Reset and reproduce

**Profile → Reset Demo** opens a confirmation. **Reset all demo data** restores the predefined catalog, reciprocal decisions, matches, conversations, feed, stories, game states, snaps and date plans. Cancel keeps the current world. Reset is global to this server: it replaces changes made by every demo tester, not only the selected person. Stop other test runs first, then use **Switch Demo User** or close/reopen other open clients afterward.

The initiating client remounts and clears its local drafts. An already-open game room on another client can retain a higher local revision of the same deterministic game ID; an ordinary refresh alone is insufficient after reset. This controlled-beta operator constraint is not automatic cross-client reset propagation.

The report runner can restore and inspect the same world:

```powershell
npm run demo:report --prefix apps/api -- --reset
```

`--reset` explicitly restores shared demo activity before recording the report. The runner compares independently calculated eligible IDs/reasons with every page returned by the actual discovery API. Its sanitized output is [demo-test-results.json](demo-test-results.json); the human-readable inventory and verification status are in [demo-test-report.md](demo-test-report.md). A future run changes the recorded observation time; it must not be represented as the earlier browser/native proof.

Persona IDs, authored text, preferences, media UUIDs, scenario relationships and baseline resource IDs are deterministic. Reset uses a fresh time anchor for active story/snap/game expiry, readable conversation/feed order and future date plans; absolute timestamps therefore intentionally change. A story whose baseline is expired remains expired. Files use a new private storage generation, so durable deletion jobs for superseded files cannot remove the new world's media. No data is randomly regenerated on each normal application launch.

Reset operates on the known thirty demo identities and associated activity. It retains stable demo user rows and sessions, normal accounts/data/sessions, and safety records outside the reset activity. Identifier collisions with normal accounts and detected foreign references abort the transaction. Metadata and new attachments commit atomically; superseded files are queued for post-commit deletion. Failed filesystem jobs retain retry obligations. This is a private-beta reset contract, not proof of production disaster recovery.

## Fictional identities and supported fields

The selector distribution is **10 Men / 10 Women / 10 LGBTQ+ / Other**. These are selector groups, not three gender categories. The LGBTQ+ group includes gay men, lesbian women, bisexual and pansexual people, non-binary people and queer people in the same ecosystem. Actual seeded genders are fourteen men, fourteen women and two non-binary people. Gender and explicit reciprocal preferences drive the existing matching engine; an orientation label does not override either person's choices.

All names, biographies, prompts, jobs, interests, ages and conversations are invented for the demo. Ages are 21–35 at the catalog reference date, 2 October 2026. Broad Nepal cities are manually selected; there are no exact addresses or coordinates. Contact placeholders use the reserved `.invalid` domain. No real email/phone, scraped content, celebrity identity or real person's photograph is used.

Each profile fills the currently supported name, birth date/derived age, city, gender, intention, bio, selected main photo, ordered gallery, interests, one conversation prompt, languages, hobbies, profession, education, lifestyle and private dating preferences. Serious relationships, marriage and casual dating each occur ten times. Short/long bios, one/six-photo galleries, small/large match histories and active/absent/expired stories exercise different layouts.

Orientation and pronouns are explicit **demo-selector metadata**. The catalog also describes a vibe. They are not new real-account identity fields or inferred traits. The current core profile does not support a separate orientation/pronoun editor, voice introduction, multi-question personality record or liveness result; this phase does not fabricate those features. Demo completion is marked as fictional, not as verified identity or genuine email ownership.

Avatars/profile/feed/story images are original code-native SVG illustrations rasterized with Sharp. The small H.264 clip is a four-second animation of original invented scenery, encoded once using the existing local Docker encoder; Node demo startup needs no host FFmpeg. [Asset provenance](../apps/api/src/demo-assets/README.md) records the recipe, dimensions and hashes. There is no AI service at runtime and no real photo substitute. All private copies use the ordinary authorized media endpoint, including video posters.

## Useful starting perspectives

- **Aarav** has three existing matches and a long conversation, a pending/active/completed game across different pairs, a six-photo profile, and enough matched authors for feed pagination. **Pema** already Likes Aarav for an instant mutual match; **Tavi** is untouched for the ordinary one-sided Like → switch → return Like journey. Incoming Likes remain hidden in the product.
- **Arin / Neel** and **Lumi / Zoya** have existing same-sex matches plus fresh reciprocal prospects. **Sora / Esha / Tavi / Noor** exercise multiple-gender preferences. **Rio** is non-binary and interested in men; reciprocal choices leave two prospects rather than treating everyone as eligible.
- **Rohan / Nisha** are matched with no baseline conversation/game and can plan a date or send an invitation from scratch. Nisha's baseline story is expired, so no active ring should be fabricated.

Discover is cursor-paged and continues applying reciprocal age, city, gender and intention filters, pause/suspension, blocks, existing matches/closed connections and prior decisions. Shared interests explain a conversation opportunity, not a compatibility score or eligibility override. The independent catalog oracle is [demoPersonas.ts](../apps/api/src/demoPersonas.ts); actual seeding uses the authoritative swipe/game transitions in [demoWorld.ts](../apps/api/src/demoWorld.ts).

Every known demo profile can be previewed by another signed-in known demo profile while both mode flags are enabled and neither suspension nor a block prevents it. This narrow demonstration exception applies only to actual profile fields and linked profile media. It does not expand Discover candidates, mutual matches, social audiences, private chat/snap access or normal-account visibility.

## Remaining proof boundaries

Generated fixtures and API checks establish specific local behavior, not large-scale capacity. Browser fixtures, real local-service browser journeys, native emulator checks and physical-device evidence must be reported separately. Real Google/SMTP/push delivery, physical iOS execution, full permission/background/offline coverage, staffed moderation and production operation remain outside this demo. Messages remain server-readable; delivered bytes/screenshots cannot be recalled. Private media expiry/block checks and the existing Games 2.0 rollback contract remain unchanged.
