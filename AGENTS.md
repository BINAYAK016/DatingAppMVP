# Repository instructions

## Scope and truthfulness

- The implemented cross-platform beta is described in `docs/beta.md`. The user's latest target is the SANGAI redesign in `docs/redesign-audit.md` and `docs/redesign-plan.md`: Discover, Chat, Sangai and Profile; remove circles; keep match-only social content; camera/Snap only in Chat; no AI. Follow confirmed decisions and resolve the recorded pending product choices before dependent implementation. Do not treat the earlier circle-based scope as the future product requirement.
- Treat `docs/` as proposed decisions until implemented and verified. Update implementation status when delivering each milestone.
- Android and iOS are primary products. Do not replace the mobile app with a website, PWA, or WebView wrapper.
- Preserve user work. Begin changes by inspecting `git status`, `git branch -a`, `git log --oneline -10`, and applicable nested instructions. An empty repository has no history; report that accurately.
- Use focused commits, run checks appropriate to the change, and report limitations. Never claim a push, build, deployment or test succeeded without evidence. Never force-push without explicit authorization.

## Architecture and scope

- Proposed stack: React Native with Expo development builds and TypeScript; NestJS modular monolith; PostgreSQL; Redis-backed jobs; private S3-compatible media; small React admin app.
- Confirm dependency compatibility and pin supported versions during foundation. Do not invent unverified version requirements.
- Keep authorization, discovery eligibility, matching, safety and entitlements on the server. Share API contracts, not database models or server secrets, with clients.
- Prefer module boundaries and measured optimization over microservices, Kubernetes, custom recommendation models, or separate search infrastructure.
- Dockerize backend, worker, admin and local dependencies. Document the host/device native-toolchain exception. Maintain `.env.example`, `.dockerignore`, dev containers and reproducible setup when implementation starts.
- Add functionality only when it serves connection quality, safety or a measured business hypothesis. Later beta authorization supersedes the narrower P0/P1/P2 proposal in `docs/product.md`.

## Non-negotiable privacy and safety

- Adults only, minimum 18; birth date and contact details are private. Do not treat self-declared age or phone ownership as verified identity.
- No precise location collection in P0; use a manually selected broad area. Never return private coordinates, phone, email, birth date, or moderator notes in discovery APIs.
- Apply blocks and account suspension to all server reads/writes, including feeds, media delivery, messages, sockets, search and queued notifications. Recheck at execution/delivery time.
- No public media buckets or unauthenticated dating profile previews. Every media access must follow current visibility rules.
- No secrets in source, images, logs or mobile bundles. Use secure device token storage and redact telemetry.
- Report, block, moderation tools, account deletion and published safety policies are launch requirements, not later enhancements.
- Do not create fake users or activity for public seeding. Test fixtures must be unmistakably synthetic and isolated.
- Do not send private chats, verification evidence or sensitive profile fields to AI providers by default. No AI impersonation, autonomous messages, inferred caste/ethnicity/orientation, or attractiveness scoring.

## Verification and delivery

- Check documentation links, scope consistency, whitespace and secret exposure. Record actual application test/build outcomes in `docs/verification.md`.
- For implementation, test critical state transitions with PostgreSQL/Redis integration, authorization failures, block races, message retries, deletion and migration behavior.
- Run the primary journey on Android and iOS, plus permission denial, reconnect and background/foreground scenarios. Record device/build evidence; do not label one-platform testing as parity.
- Before a release, exercise backup restore, rollback, moderation response, notification privacy and app-store requirements.
- Keep README and docs consistent with the commands and behavior actually shipped.
