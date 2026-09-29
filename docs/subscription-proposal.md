# SANGAI subscription preview — approved hypotheses

The user approved Free + Sangai Plus, NPR 299/month in Nepal and AUD 7.99/month in Australia, with monthly and annual previews and a 20% annual discount. These are regional test prices, not live offers or evidence of willingness to pay. No checkout API or paid entitlement is included.

## Recommended structure

Use two plans: **Free** and **Sangai Plus**. One paid tier is easier to explain and test than introducing several tiers before the core product is validated.

| Benefit | Free proposal | Plus proposal |
| --- | --- | --- |
| Profile, discovery, mutual matching | Included, with transparent abuse limits | Included; no promise of more or guaranteed matches |
| Age, gender, city and relationship-intention preferences | Included | Included |
| Text, photos/videos, snaps and match-only stories | Included | Included |
| Sangai posts and interactions | Included | Included |
| Seven standard games | Included as their two rollout increments ship | Included |
| Plan a Date | Included | Included |
| Block/report, discovery pause and core privacy controls | Included | Included |
| Undo | A modest free allowance; exact limits still need a decision | Expanded allowance, never reversal of an established match |
| Optional lifestyle filters | Basic experience remains usable | Additional filters on voluntarily supplied fields; no sensitive inferred traits |
| Bonus conversation/game packs | Standard games remain usable | Future optional packs, clearly marked planned until implemented |
| See who liked you before matching | Not offered | Not offered: the user chose hidden likes for the product |
| Boosts, public distribution, messaging unmatched people | Not proposed | Not proposed |

A supporter subscription without feature restrictions is a valid alternative. Two paid tiers would require a distinct second value proposition; adding a more expensive card with vague benefits would not validate it.

The main commercial weakness of this proposal is that filters, undo and bonus packs may not be compelling while the match pool is small. Test whether people find relevant matches and use the core conversation features before treating the preview price as a proven revenue model. Do not manufacture friction in safety, messaging or the seven promised games simply to make Plus look valuable.

## Approved regional price hypotheses

| Billing period | Nepal | Australia |
| --- | --- | --- |
| Monthly | NPR 299.00 | AUD 7.99 |
| Annual, 20% discount | NPR 2,870.40 | AUD 76.70 |

These are independently approved regional hypotheses, not a currency conversion. Annual totals are twelve monthly payments multiplied by 0.8 and rounded to the nearest minor currency unit. The full annual amount is prominent. Nothing is charged in either case.

## Implemented preview pages

1. **Profile → Sangai plans:** Free and the selected paid-plan proposal, concise benefits and clear preview status.
2. **Plan comparison:** honest included/planned states. Do not mark a future pack or filter as available today.
3. **Selected-plan preview:** selected region, billing period and proposed total; a clear statement that purchases are unavailable in the beta. No card or bank fields.
4. **Subscription status:** no active paid subscription. Do not invent purchase history, renewal dates or a Restore success response.

Changing a plan or region only changes the preview. It must not write paid entitlements, trigger checkout, send payment data, email a receipt or simulate a successful purchase. No subscription/purchase tables are needed for this display-only increment. Future real subscriptions will require verified store/provider events and server-owned entitlements; that is separate work.

## Official reference check

Tinder lists undo, location and visibility-related benefits across its subscription tiers. Hinge lists advanced filters and incoming-like access among paid features. These provide examples of packaging, not evidence that Sangai should copy them or use the same prices. Sangai's hidden-like policy specifically excludes that common upsell. [Tinder subscription features](https://www.help.tinder.com/hc/en-us/articles/115004487406-Tinder-subscriptions), [Hinge subscription benefits](https://help.hinge.co/hc/en-us/articles/38014282744595-Subscription-and-Purchase-Benefits).

No competitor price claim or Nepal/Australia demand estimate is being made. Exact future undo allowances and real subscription fulfillment remain separate decisions; the beta grants no paid benefits. The subscription browser journey, including both regional annual totals and absence of purchase requests, passed on 2026-09-30. The Nepal annual preview also rendered correctly on Android. Native device verification is recorded separately.
