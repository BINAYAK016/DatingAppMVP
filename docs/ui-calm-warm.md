# Calm structure, warm cards - UI testing branch

The user approved concept A's structure with concept B's warmer cards on 6 October 2026. Implementation is isolated on `feat/ui-calm-warm`, based on `152b797`. The original `feat/cross-platform-web-beta` checkout and its pending work are preserved. This branch changes shared client presentation and client navigation only. API source, database schema, matching, discovery eligibility, privacy rules, game consent, dependency versions and deployment configuration are unchanged.

## What to review

| Area                   | New presentation                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discover               | Portrait followed by identity, city, intent, short bio and interests on a solid surface. Labeled Pass, Like and Super Like controls.              |
| Chat                   | Compact match/story strip and readable conversation rows with existing previews and unread counts.                                                |
| Sangai                 | Normal-sized post text, warm question cards, compact story entry and a clear create action.                                                       |
| Profile                | Own-profile summary, Edit and Preview actions, grouped settings, separate Plus preview and demo tools.                                            |
| Conversation and games | Softer bubbles, compact invitation actions and a horizontal game category selector. Existing invitations and explicit acceptance remain required. |
| Composer               | Caption first, existing audience cue, smaller media controls and the same upload/draft behavior.                                                  |
| Desktop browser        | Four navigation links from 1024px; a match sidebar alongside conversation from 1280px. Narrow browser and native retain four bottom tabs.         |

The existing rose, cream, blush, peach and lavender palette is retained. Story rings indicate an accessible story, not online presence. Inbox data has no last-message timestamp, so no timestamp or online/ready indicator has been invented. Incoming likes stay hidden. Plus remains a pricing preview without checkout or paid entitlement.

## Local browser test

Use the separate UI checkout, not the original working directory:

```powershell
Set-Location 'C:\Users\Dell\Documents\Codex\2026-09-28\u\work\SangaiUI'
npm ci
npm ci --prefix apps/mobile
npm run web:build
$env:SANGAI_PREVIEW_PORT='8082'
npm run web:preview
```

Open `http://localhost:8082/demo`. The preview binds only to `127.0.0.1` and proxies existing API routes to `127.0.0.1:4100`. It uses the local backend and does not use the EC2 hostname. Keep the existing local backend running; its environment and persistent volumes are not copied into this checkout. Only one process can listen on the chosen preview port. The default remains 8081 when `SANGAI_PREVIEW_PORT` is omitted.

Choose a fictional persona, then review Discover, Chat, Sangai and Profile. The main Profile tab has a compact intent, bio and interest summary so account controls remain easy to reach. Preview profile opens the complete public profile, including prompts, lifestyle details and its photo gallery. Check Edit/Preview, all four settings sections, My/Saved moments and the existing Plus preview. In Profile's Demo tools, **Use my own account** goes through the public selector, revokes the demo session and opens ordinary signup/login. A failed logout retains the current session and offers retry. An ordinary account can return from the selector without being signed out. Do not put personal data in shared fictional accounts.

Check a conversation and game picker; switching sidebar conversations must keep each conversation's draft separate. Review the composer without publishing until you decide to create a synthetic test post. Report any crowded layout, unclear label, difficult tap target, missing action or unexpected navigation, together with the screen, platform and approximate viewport/device size.

## Focused browser regressions

```powershell
$env:SANGAI_WEB_TEST_URL='http://127.0.0.1:8082'
$env:PLAYWRIGHT_CHANNEL='chrome'
node node_modules/@playwright/test/cli.js test tests/ui/ui-calm-warm.spec.ts tests/ui/demo-account-choice.spec.ts tests/ui/demo-pagination.spec.ts tests/ui/games-v2.spec.ts tests/ui/profile-games.spec.ts tests/ui/web-platform.spec.ts
```

UI/account/pagination/Games 2.0 tests use intercepted synthetic API fixtures. Profile failure cases use local demo reads and intercept writes. Web-platform tests exercise the real local demo cookie session and preview proxy. None of these tests require EC2 or send OTP email. Full email onboarding tests are separate and require a deliberately configured local mail sink.

## Android and iOS

Shared screens are React Native components. This is not a WebView conversion. Use the existing app configuration and Expo-generated native projects; see [Android run/build guide](android-redesign.md). Native build output for this experiment is isolated at `D:\CodexBuild\SangaiUI`, leaving `D:\CodexBuild\SangaiBeta\Mobile` untouched.

The local Android test artifact enables the existing local-HTTP build option and defaults to `http://10.0.2.2:4100`. A previously saved server address overrides a bundle default; use **Switch > Connection settings** to set the local address before entering a demo. This local build setting is only for testing. Existing HTTPS release configuration remains unchanged in source. x86_64 APKs run on the x86_64 emulator; phone distribution requires an ARM64 build and a reachable HTTPS backend.

Native iOS runtime requires a Mac or an appropriately signed cloud build. A successful TypeScript check or iOS JavaScript export does not establish native iOS behavior.

## Delivery gate

Review this branch locally first. No EC2 upload, server reload, API rebuild, database migration or merge into the original branch is part of this UI change. The current cloud service uses NGINX and Certbot as instructed by the operator; this branch does not change that service. Deployment requires the user's later green signal. Executed checks and remaining device limits are recorded in [verification](verification.md).
