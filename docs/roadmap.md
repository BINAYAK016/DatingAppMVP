# Delivery roadmap, gates and risks

Status: proposed, 28 September 2026. The confirmed delivery model is a small team using Codex to build, a senior developer to review, and a DevOps engineer to deploy. No headcount availability, budget or deadline was provided. Sequence work by verifiable outcomes, not an invented calendar commitment.

## Roles and working method

| Owner | Responsibility |
| --- | --- |
| Founder/product owner | Interviews, cohort recruitment, city opening, commercial decisions and budget |
| Codex-assisted implementation | Narrow changes with docs, tests and reviewable evidence; no unreviewed production authority |
| Senior developer | Architecture, native integration and security review; correctness tests; merge/release recommendation |
| DevOps engineer | Environments, secrets, signing pipeline support, CI/CD, telemetry, backup/restore and deployment |
| Safety/community owner — still needed | Moderation policy, staffed queue, escalations, appeals, community/ambassador conduct |
| Counsel/privacy support as needed | Nepal/Australia applicability, data processing, policies, store/entity and incident obligations |

Small team does not mean every role is full-time or a separate person. It does mean someone named must own each responsibility. Senior review is the likely throughput constraint: produce focused PRs rather than a large AI-generated codebase that cannot be reviewed.

## Phase 0 — product discovery (current)

Deliver repository audit, competitive evidence, critical feature decisions, product loop, target cities, initial commercial hypotheses and interview plan. This documentation completes desk research and planning, not market validation. Next research work: interviews/prototype and a consented concierge trial. Gate: users understand the proposition, genuine candidate supply is plausible, and the team can fund safety operations.

## Phase 1 — architecture (current)

Deliver mobile/backend/database/API/Docker/security plans, native parity strategy and implementation gates. Eight target cities are represented; Valley-first rollout is a recommendation for review. Gate: founder/senior developer agree scope and open decisions; no application implementation is authorized merely by finishing these documents.

## Phase 2 — recommended first implementation milestone: secure native foundation

When implementation is requested, build the smallest independently reviewable slice:

1. Pin a compatible React Native/Expo toolchain and backend dependencies. Produce Android and iOS development builds that launch on real devices; test a navigation screen, API call, secure token storage, photo picker and notification capability. This spike can reverse the framework choice before significant UI investment.
2. Establish the monorepo, containers/devcontainer, PostgreSQL, Redis, private storage, migrations, health checks and CI. Make the documented clone/copy/compose flow work with explicit local provider adapters.
3. Implement adult-gated registration, contact verification, session lifecycle and risk-aware recovery. Add minimal profile/intentions/city/visibility. Keep all profiles private until explicitly ready.
4. Add one photo's full quarantine-to-approved path and minimal moderation access. Include a basic report/block path, account deletion and audit trail so foundational privacy is testable.
5. Test on both OSes and review cross-user API access, secrets, tokens, deletion and container restart behavior. DevOps deploys an isolated staging environment with synthetic data and restore evidence.

Definition of done: a synthetic user can register, create a private profile and approved photo, control visibility, revoke their session and delete the account on both platforms; another account cannot read unauthorized fields/media; local environment reproduces from clean checkout; CI and senior review pass; staging restore works. No public acquisition, full feed, matching, chat, AI or billing is needed in this milestone.

This is a foundation milestone, not the launch MVP. Divide into focused PRs such as environment/toolchain, identity/session and profile/media/safety. Do not merge a single large generated foundation without incremental review.

## Phase 3 — smallest complete product loop

After foundation, build eligible discovery and text/photo moments, contextual requests, atomic matching, reliable text chat, generic push, moderator workflow and privacy controls. Complete `Register → Profile → Discover → Interact → Match → Chat` on Android and iOS. Test block/accept/send races, reconnect/deduplication, report after unmatch, media authorization and queued-notification suppression. Add outcome telemetry without intimate content.

Gate: zero unresolved critical security/safety issues; primary journey passes both platforms; operational moderation drills and deletion/restore checks succeed. Admit a small invite-only Valley cohort with actual safety staffing. Do not fake candidate supply.

## Phase 4 — retention and cohort expansion

Measure mature cohorts and compare context-assisted versus profile-only discovery. Fix response friction and weak onboarding before adding features. Open Pokhara and the most ready Australian city when liquidity, local operations and legal review permit, followed by remaining target cities. Users explicitly choose any cross-border discovery.

Gate: promising meaningful-connection participation, acceptable report/action burden and supply distribution, with documented sample sizes and qualitative feedback. Support a relationship-related pause as success. If the social feed does not help, simplify it. P1 features each need a short hypothesis and guardrail before development.

## Phase 5 — selective AI

Only after sufficient data and demonstrated user need, trial opt-in profile help or suggested questions against fixed prompts. No autonomous sends, default private-chat processing or inferred sensitive compatibility. Gate: measured quality benefit, acceptable cost, consent/retention controls and no material safety or subgroup-quality regression. Do not create an AI service solely to satisfy branding.

## Phase 6 — monetization and partnerships

Test willingness to pay and contribution economics. Then add store-verified subscriptions and restore/refund handling if there is real value to charge for. Test events/partnerships manually before booking infrastructure. Gate: free core loop remains useful, safety is never paywalled, actual provider/store costs are modeled and support/refund processes exist.

## Major risks and response

| Risk | Early signal | Response/owner |
| --- | --- | --- |
| Eight-city fragmentation | Empty candidate sets despite many registrations | Open cohorts in stages; measure reciprocal supply, founder |
| Weak differentiation | Users describe it as another profile app | Test context/privacy benefit; shrink or change thesis, product |
| Creator/dating incentive conflict | Lots of browsing, little reciprocal conversation | Remove public popularity and unnecessary feed mechanics, product |
| Harassment, scams, minors | Severe incidents/backlog or evasion | Restrict intake, improve controls and coverage, safety owner |
| Exposure/outing | Complaints about visibility, notifications or links | Private defaults, broad areas, field-level policy tests, senior reviewer |
| Australian/Nepal obligations unresolved | Provider/entity/policy gaps | Delay affected distribution until counsel resolves, founder |
| App-store rejection | Insufficient differentiated value or policy evidence | Demonstrate actual flow and safeguards; review current policies, product/engineering |
| Reviewer bottleneck | Large diffs, inconsistent generated code, repeated defects | Smaller changes, explicit acceptance tests, no premature parallel feature sprawl, senior developer |
| iOS validation deferred | Android-only evidence or untested native packages | Native spike and real iPhone gate early, engineering |
| OTP/verification/media costs | Spend growth or fraud without active conversations | Quotas/provider caps and per-active-user economics, DevOps/product |
| Burnout from chat / notification pressure | Muted notifications, unanswered requests | Respect quiet hours, reduce batch size, allow pause, product |
| Privacy breach / deletion failure | Unauthorized reads or residual objects | Stop release, incident process and multi-store verification, senior/DevOps |
| No willingness to contribute posts | Sparse or performative content | Use prompts as evergreen context, remove separate feed if needed, product |

## Cost and schedule estimation method

Before estimating dates, determine senior review hours/week, implementation availability, DevOps allocation, physical iOS/Android access, store-account ownership, safety coverage and provider costs. Estimate each vertical slice after the native/toolchain spike and add explicit contingency for recovery, moderation and store review. Keep cloud, OTP, storage/egress, verification, moderation, support and native build service costs separate. Codex assistance reduces some typing work; it does not remove product validation, native testing or operational effort.

## Stop point for this task

Deliver only the documentation, validate it, commit and attempt the authorized normal Git push. Record actual success/failure and stop. Do not scaffold the application, deploy services, create store accounts, buy providers or launch acquisition during this phase.
