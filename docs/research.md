> Historical discovery proposal (28 September 2026). The later user-authorized beta is implemented; see [current scope](beta.md), [README](../README.md), and [verification](verification.md). Proposed services and future features below are not claims of delivered functionality.

# Evidence, assumptions and repository audit

Research date: 28 September 2026. Sources are first-party descriptions, not independent proof of results or market share. No user interviews, installations of competitors, paid experiments or performance benchmarks were performed in this phase.

## Repository inspection

The supplied projectless directory was not a Git checkout. No saved Codex project was available. The official repository was cloned into a separate working directory, preserving any other local work.

| Check | Observed result before documentation |
| --- | --- |
| Remote | `https://github.com/BINAYAK016/DatingAppMVP.git` |
| `git ls-remote --symref ... HEAD` | No refs returned |
| Clone | Successful; Git warned that the repository was empty |
| `git status` | On branch main; no commits; nothing to commit |
| `git branch -a` | No established local or remote branches |
| `git symbolic-ref --short HEAD` | main, unborn branch |
| `git log --oneline -10` | No commits; expected failure on empty HEAD |
| Tracked/existing source | None; no manifests, Docker files, tests, schema or application to review |
| Existing AGENTS instructions | None in the inspected workspace ancestry or empty checkout |
| Git tooling | Git available; GitHub CLI not installed |

GitHub's [repository page](https://github.com/BINAYAK016/DatingAppMVP) also displayed an empty repository. Read access does not establish push permission. Commit and push outcomes must be recorded separately after they occur.

## Competitive evidence and implications

| Alternative | Observed first-party feature/position | Implication for this product |
| --- | --- | --- |
| Hinge | Optional profile-based [conversation suggestions](https://hinge.co/newsroom/convo-starters) and [limits on unanswered conversations](https://help.hinge.co/hc/en-us/articles/31662181659027-What-is-Your-Turn-Limits) | Personality and conversation quality are established territory. AI openers are easy to copy, not a moat. |
| Bumble | [Opening Moves](https://bumble.com/en/features/opening-moves/) reduce the burden of beginning a conversation | A prompt by itself does not distinguish us. Test local relevance and response quality. |
| Tinder | [Video-selfie photo verification](https://www.tinderpressroom.com/2023-04-26-Tinder-Adds-Video-Selfie-to-Photo-Verification) is an established offering | Verification is a trust expectation, not proof someone is safe. |
| BiheNepal | [Its own site](https://bihenepal.com/) advertises Android/iOS apps, Nepali reach, verification, photo blurring, blind dates and Kundali matching | Nepali focus and diaspora access are already served. Do not claim to be the first. Its download/request counters are marketing claims, not verified active-user liquidity. |
| Instagram, Facebook, TikTok and existing groups | Strategic substitutes for attention, self-expression and meeting people; no current feature audit performed | Inference: asking users to recreate a social audience is expensive. Our specific hypothesis is that mutual dating intent and controlled introductions improve on ambiguous social contact. |

**Conclusion:** There is no demonstrated unmet market merely because these features can be combined. The promising wedge is private, culturally fluent, locally dense introductions with enough everyday context to begin a real conversation. That remains an unvalidated hypothesis.

## Market assumptions to validate

1. Confirmed target cities: Kathmandu, Bhaktapur, Lalitpur, Pokhara, Sydney, Melbourne, Perth and Brisbane. Recommended rollout: Kathmandu Valley first, followed by city cohorts when supply and operations are ready. Recruitment initially concentrated around ages 23–35 is a hypothesis, not a user requirement; eligibility remains 18+. The user's belief that these cities have abundant Nepali populations does not establish active dating demand or reciprocal supply.
2. Need to test separately: privacy from acquaintances, intent clarity, response burden, authenticity, willingness to contribute personal posts, and dissatisfaction with current alternatives.
3. Nepal and the diaspora are different marketplaces. Long-distance intent, time zones, relocation expectations and launch-country obligations make simultaneous unrestricted release a poor default. Support Nepal/Australia in the design, launch cities in cohorts, and require explicit opt-in for cross-border recommendations.
4. Cultural relevance should mean language, life-stage context and user-chosen relationship expectations. Do not equate Nepali culture with compulsory caste, religion, astrology or family access.
5. Supply is a compatibility graph, not a male/female ratio. Measure reciprocal preference eligibility for different gender identities, orientations, ages and areas without exposing small cohorts.
6. Infrastructure reach does not establish dating demand. The [NTA MIS portal](https://www.nta.gov.np/misreport) reports telecommunications subscriptions; do not turn SIM/subscription counts into unique potential customers or paying daters. No defensible TAM estimate was established here.

## Discovery plan before committing to a full build

Interview approximately 30 adults across potential user groups, including people who stopped using dating apps and people worried about visibility. Ask about actual recent experiences and workarounds before showing the idea. Separately interview 5 prospective community/venue partners. These sample sizes are planning assumptions, not statistical proof.

Use a clearly labeled clickable prototype to compare profile-only discovery with profile-plus-one-personal-moment. Measure understanding, comfort, intended action, and whether the context changes a person's decision. Do not recruit through deceptive romantic profiles.

Then conduct an explicitly consented concierge pilot with 50–100 adults and a trained moderator. Use minimal private records, no public contact spreadsheet, and defined deletion. Present genuine candidates only; never promise a minimum number of matches. Test text/photo introductions before building reels or AI.

Key falsification signals: people want to browse but will not connect; personal posts feel unsafe; context adds no conversation lift; eligible supply is too thin; or moderation cost cannot be supported. In those cases narrow the cohort, simplify to profile prompts, or stop. Do not answer weak demand with more features.

## Technical and policy references

These sources informed proposed engineering choices; package compatibility and policies need rechecking when implementation or submission begins.

- [React Native performance](https://reactnative.dev/docs/performance): native-quality UX still requires profiling and careful JS work scheduling.
- [Flutter architecture](https://docs.flutter.dev/resources/architectural-overview): shared Dart UI, own rendering architecture and native platform integration.
- [Expo EAS Build](https://docs.expo.dev/build/introduction/): hosted Android/iOS builds; Android workers use Linux and iOS workers use macOS.
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) and [push notifications](https://docs.expo.dev/push-notifications/overview/): native integration options, subject to device and platform limitations.
- [NestJS](https://docs.nestjs.com/), [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html), [Compose startup dependencies](https://docs.docker.com/compose/how-tos/startup-order/): framework/module, integrity and local startup references.
- [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/): UGC safeguards, account deletion, data use and differentiated dating experiences matter. Native implementation alone does not ensure acceptance.
- [Google UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en-GB), [child safety standards](https://support.google.com/googleplay/android-developer/answer/14747720), and [account deletion](https://support.google.com/googleplay/android-developer/answer/13327111): operational and submission requirements to verify before launch.
- [Nepal Privacy Act, 2075 — Nepal Law Commission](https://lawcommission.gov.np/content/12261/the-privacy-act-2075/): primary legal reference. This discovery pass does not determine all applicable Nepalese rules, registrations, cross-border restrictions, consumer obligations or diaspora-country requirements. Local counsel must resolve those before a public launch.

## Open decisions and owners

| Decision | Working recommendation | Needed evidence/owner |
| --- | --- | --- |
| First geography and audience | Eight confirmed cities; staged rollout recommended | Founder sets sequence after city-level interviews |
| Staffing, budget and schedule | Confirmed: small team, Codex development, senior developer review, DevOps deployment | Founder still needs budget, availability and safety staffing |
| Framework | React Native + Expo | Native spike on both OSes; actual hiring pipeline |
| Authentication delivery | Phone OTP with recovery design | Nepal carrier delivery tests, fraud cost and diaspora coverage |
| Public-launch verification | Provider evaluation, risk-based/manual beta checks | Safety lead, privacy review, false-rejection tests |
| Hosting region/provider | Single region selected by measured Nepal latency and data obligations | Engineer and counsel; no vendor purchased |
| Launch availability and legal entity | Limited initial distribution | Founder, counsel and store-account owner |
| Safety response coverage | Named lead and staffed response schedule | Founder; block launch if insufficient |
| Pricing | No P0 payments; test willingness later | Interviews and actual usage economics |

## Australia-specific discovery

Australian cities are in confirmed scope. Review the [OAIC Privacy Act overview](https://www.oaic.gov.au/privacy/privacy-legislation/the-privacy-act) and [eSafety Basic Online Safety Expectations](https://www.esafety.gov.au/industry/basic-online-safety-expectations) with counsel before distribution there. Determine applicability, sensitive-information handling, cross-border processing, incident reporting and online safety obligations for the actual entity and service. Do not assume small-team status exempts the business. No Australian legal compliance conclusion was reached in this phase.
