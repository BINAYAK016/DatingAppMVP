# Redesign migrations and local testing

## Database transitions

The runner records normalized SQL checksums in `schema_migrations`, holds an advisory migration lock, and executes unapplied migrations in a transaction. Existing databases deliberately apply the idempotent frozen `schema.sql` once, then the numbered expansion migrations. Do not edit an applied SQL file; add another numbered migration. A changed checksum stops startup.

1. `001_discovery`: directed decisions, retry IDs, undo history; legacy pending requests become only their sender's Like; incoming request notifications removed.
2. `002_live_games`: scoped readiness and invitation/session lifecycle. Legacy incomplete games close without inferring live consent; finished games remain history.
3. `003_identity`: verification, onboarding, provider identities and hashed one-use challenges. Only fictional demo accounts bypass real onboarding. Existing real users must verify and complete setup.
4. `004_social`: message attachments/references, private saves, reply parents, privacy switches and media purpose binding.
5. `005_profile_media`: gallery references, preserving current main-photo IDs.

Users, established pair matches, post IDs and media ownership are preserved. The five circle/event tables and legacy follows remain inaccessible to product routes. A later reviewed contract migration can remove them after the rollback retention period; no current migration drops their content.

## Backup and rollback

Before the first migration on this host, a custom-format `pg_dump` and compressed media snapshot were stored outside Git with Windows permissions restricted to the current user, under the task's `work/sangai-backup-20260930` directory. The database snapshot restored successfully to a separate disposable database with 5 users, 3 connections and 1 circle. The disposable restored database was then dropped; the original backup remains retained. The media archive contains 7 entries and remains locally retained.

The automated migration test independently creates a legacy database, upgrades twice, checks match/legacy-circle preservation and one-sided consent, and verifies checksum-drift failure. Fresh-database API tests cover the new schemas.

An old API image would re-enable the retired request/circle product. Do **not** point it at the new schema while claiming the new privacy contract still applies. For a full rollback, stop the API, restore the pre-redesign database into a separate database and its corresponding media snapshot, and use the baseline `96bd8f3` image/client together in a restricted local environment. This loses post-snapshot writes; preserve a new backup first. Never use `docker compose down -v` as a migration procedure.

## Email and Google

The default Compose SMTP host is `mailpit:1025`. Open `http://localhost:8025` on the host to read local verification/reset codes; this inbox is local development tooling and does not establish ownership of a real external mailbox. The real-tester verified-email rule requires external SMTP or configured verified Google sign-in. Set SMTP secrets in an untracked environment, not in a source file or chat transcript.

For Google, supply the IDs described in `beta.md` and rebuild. Android signing certificate fingerprints and iOS URL-scheme configuration must match the registered OAuth clients. External provider and app-store setup are not fabricated in the local beta. Assess Sign in with Apple requirements before an iOS store submission.

## Running checks

With PostgreSQL running: `npm test` creates isolated test databases and removes only those databases. `npm run check` and `npm run lint --prefix apps/mobile` validate source. `npm run web --prefix apps/mobile -- --host localhost` provides a secondary browser preview; `PLAYWRIGHT_CHANNEL=chrome npx playwright test` exercises the shell, prices, posting, two-client live-game consent and complete onboarding through local Mailpit. The onboarding fixture account is deleted at test completion.

For an Android Studio emulator, keep Docker running and install/build the shared mobile source as described in README. The device connects to `http://10.0.2.2:4100`. iOS Simulator uses its host's API address. Four additional games are the next agreed increment, not a hidden paid unlock.
