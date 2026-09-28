# DatingAppMVP

Product discovery and proposed architecture for a mobile relationship platform for Nepali adults. Android and iOS are first-class clients. Official repository: https://github.com/BINAYAK016/DatingAppMVP.

## Current status — 28 September 2026

**Documentation only. No application, database migrations, Docker runtime, or application tests have been implemented.** The repository was empty when inspected. This phase establishes a reviewable plan and stops before implementation. Recommendations below are provisional product decisions, not demonstrated market demand or production capabilities.

The target cities are Kathmandu, Bhaktapur, Lalitpur, Pokhara, Sydney, Melbourne, Perth and Brisbane. The proposed starting point is staged city cohorts for adults seeking relationships, beginning with Kathmandu Valley: discover a little of someone's everyday personality, send a specific connection request, mutually match, and talk. A small text/photo feed supports that loop. Reels, public popularity metrics, unsolicited DMs, and an AI matchmaker are outside the MVP.

## Read the plan

| Document | Purpose |
| --- | --- |
| [Review summary A–M](docs/review.md) | Concise response to the supplied discovery brief |
| [Product](docs/product.md) | Opportunity, feature decisions, acquisition, journeys, monetization, metrics |
| [Research](docs/research.md) | Repository audit, competitor evidence, sources, assumptions and validation |
| [Architecture](docs/architecture.md) | Stack comparison, modules, API contracts, reliability and growth |
| [Mobile](docs/mobile.md) | Native UX, permissions, weak networks, Android/iOS parity and release testing |
| [Database](docs/database.md) | Logical entities, constraints, state transitions and indexes |
| [Security](docs/security.md) | Privacy, abuse prevention, moderation operations and retention |
| [Docker](docs/docker.md) | Planned local/production containers and native build boundaries |
| [Roadmap](docs/roadmap.md) | Gates, dependencies, risks and first implementation milestone |
| [Agent instructions](AGENTS.md) | Repository rules for subsequent work |

## Proposed development setup — not available yet

The foundation milestone must make this backend/admin setup work from a clean checkout:

```sh
git clone https://github.com/BINAYAK016/DatingAppMVP.git
cd DatingAppMVP
cp .env.example .env
docker compose up --build
```

PowerShell uses `Copy-Item .env.example .env` instead of `cp`. There is deliberately no `.env.example` or Compose file yet: publishing nonfunctional scaffolding would misrepresent this discovery phase. [Docker design](docs/docker.md) defines the files, services, migrations, health checks and validation to implement next.

Native mobile binaries run on devices or emulators, outside Compose. Android uses Android tooling; iOS builds require macOS/Xcode or a hosted macOS builder. Docker cannot replace Apple's native toolchain. EAS development builds are proposed for shared-device testing; Expo Go is not the release acceptance environment. App-store accounts, signing, provider credentials, and real-device tests remain prerequisites.

## Implementation boundary

Do not proceed automatically from this documentation into feature development. Review the launch cohort, safety staffing, stack, and pilot success criteria first. The recommended next milestone is a secure foundation and a narrow Android/iOS vertical slice, described in [the roadmap](docs/roadmap.md).

No deployment, app-store readiness, test pass, commit, or push should be inferred from this README. Verify actual Git history and command results.
