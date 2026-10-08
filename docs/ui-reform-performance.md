# UI reform: frontend performance verification

## Scope and method

The comparison uses production Expo web exports on localhost, Lighthouse
13.5.0, Node 24.16.0, and Chromium headless shell 153.0.8010.12 from the pinned
Playwright 1.63.0 installation. Each device profile runs three times in a
fresh browser; report the median, never the best run. Viewports are 360 x 800
and 1440 x 1000 with Lighthouse's corresponding simulated network/CPU
profiles. Run only when builds, browser suites, screenshot capture, and
emulator interaction are idle.

The isolated fixture binds only `127.0.0.1:8093`. It serves a preserved
export and an in-memory synthetic signed-in Discover state (eight candidates,
one match, one story, and one post). API responses have a fixed 40 ms delay;
all mutation methods are rejected. There is no real API proxy, account,
database, SMTP transport, cookie, or personal media. External host resolution
and HTTPS requests are blocked in the measurement browser. Static responses
are uncompressed and `no-store` for both versions.

Harness, pinned tooling, raw reports, manifests, and export hashes are saved
outside application dependencies in
`outputs/sangai-ui-reform-performance`. From that directory:

```powershell
node .\run.mjs --dist "C:\absolute\before-export" --stage baseline --journey discover --runs 3
node .\run.mjs --dist "C:\absolute\after-export" --stage after --journey discover --runs 3
```

Stage names must be unused; the harness refuses to overwrite earlier reports.
Use `--repo "C:\absolute\worktree"` if its default repository path differs.
Only the MIME mapping for the new WOFF2 extension was added after the baseline;
all baseline assets and timing settings are unchanged.

## Baseline

The preserved before-export is from `530f3f8`. Valid Discover medians:

| Device  | Performance | Accessibility | Best practices | SEO |     FCP |      LCP |    TBT |   CLS |
| ------- | ----------: | ------------: | -------------: | --: | ------: | -------: | -----: | ----: |
| Mobile  |          53 |            96 |            100 |  90 | 2.857 s | 11.167 s | 546 ms | 0.024 |
| Desktop |          90 |            93 |            100 |  90 | 0.566 s |  1.853 s |  30 ms | 0.087 |

All six Discover runs have no Lighthouse run warnings. Mobile performance
scores were 46/59/53; desktop scores were 90/89/90. The variation is a reason
to compare medians under equal conditions. The original initial JS is
1,498,775 bytes, plus a 389,724-byte Ionicons TTF font.

The signed-out Welcome diagnostic produces an incomplete-load warning:
Lighthouse leaves the expected unauthenticated session 401 request unfinished
in its network accounting. Those scores are excluded from the valid
comparison. Authentication behavior was not changed to avoid this warning.

## Final comparison

The final export is from application source `75db48f`. All six final runs
completed without Lighthouse warnings. Final mobile scores were 67/68/72;
desktop scores were 92/92/92.

| Device  | Performance before → after | Accessibility before → after | Best practices before → after | SEO before → after |
| ------- | -------------------------: | ---------------------------: | ----------------------------: | -----------------: |
| Mobile  |                53 → **68** |                 96 → **100** |                 100 → **100** |       90 → **100** |
| Desktop |                90 → **92** |                 93 → **100** |                 100 → **100** |       90 → **100** |

| Device  | FCP before → after | LCP before → after | TBT before → after | CLS before → after | Speed Index before → after |
| ------- | -----------------: | -----------------: | -----------------: | -----------------: | -------------------------: |
| Mobile  |    2.857 → 0.756 s |   11.167 → 9.796 s |       546 → 306 ms |    0.0240 → 0.0076 |            4.799 → 3.295 s |
| Desktop |    0.566 → 0.205 s |    1.853 → 1.634 s |         30 → 13 ms |    0.0870 → 0.0884 |            1.069 → 0.752 s |

**The mobile 90+ performance target remains unmet.** The first visual status
appears sooner, but the large initial JavaScript download still delays useful
content under the simulated slow mobile connection. Desktop CLS is slightly
higher, though still below 0.1; it is not reported as an improvement.

The final JS bundle is 1,509,558 bytes versus 1,498,775 before (+0.7%). Combined
initial JS and icon-font bytes fall from 1,888,499 to 1,672,110 (-11.5%), driven
by the complete WOFF2 font. This is the size of those two resources, not the
whole page. Lighthouse estimates approximately 721 KiB of unused JS on the
mobile Discover route. A further performance pass should measure static
transfer compression and investigate a loading strategy that preserves the
visible route experience. No deployment configuration changed here.

[Tracked raw scores, conditions and hashes](performance/ui-reform-lighthouse.json)
include all 12 before/after runs, per-run host benchmark indices, exact
throttling settings, and export/browser SHA-256 values. Full HTML/JSON reports
remain in the local tooling output under `results/baseline-shell-discover/`
and `results/after-final-text-fix-discover/`. The final preserved export is
`outputs/sangai-ui-reform/after-export-final-text-fix`; the earlier
`after-export-pre-text-fix` snapshot is not the measured final version.

## Frontend changes

- Routes remain synchronous on web, Android, and iOS. Web keeps
  `output: "single"` and normal client-side route handling. SDK 57's async
  routes use a blank production fallback and cannot use custom
  `SuspenseFallback` exports, so enabling them would introduce a visible gap
  on first navigation. Reliable loading presentation takes priority over
  that potential bundle reduction.
- The full existing Ionicons font is losslessly encoded as WOFF2 for browsers:
  162,552 bytes, 58.3% smaller, with no glyph subset. Native retains Expo's TTF
  and renderer. Font provenance and the retained license live in
  `apps/mobile/assets/fonts/`.
- The single-page HTML template supplies the title, description, viewport,
  theme color, and a lightweight local first-paint status. Expo still injects
  its generated CSS, fingerprinted scripts, and favicon. There are no
  external font requests or new runtime dependencies.

The web bundle still contains video support used by several routes.
Reducing it further requires analyzing the complete media presentation graph;
moving one small player alone does not remove that shared runtime. Private
media fetching, authorization, object URL cleanup, session handling, and API
contracts remain unchanged.

## Interpretation and remaining checks

This is a repeatable synthetic frontend benchmark, not a claim about EC2,
actual API latency, native launch time, uploaded photographs, or video
transfer. Native JS export success does not establish device runtime or iOS
signing/build success. Font payload savings are separate from measured Lighthouse improvements.
Background activity was minimized during each set, but this is not a
laboratory-controlled host; the recorded per-run benchmark indices make CPU
variation visible.

For regression coverage, production deep links must serve `index.html`, while
missing generated JS/font assets must return 404 instead of HTML. Confirm
first visits, browser back navigation, authenticated media playback, icon
loading, and all existing routes after the redesign. The
all-route screenshot and isolated end-to-end suites are separate from this
performance fixture; their results belong in the final verification report.

References: [Expo async routes](https://docs.expo.dev/router/web/async-routes/),
[single-page HTML templates](https://docs.expo.dev/guides/progressive-web-apps/),
[Metro customization](https://docs.expo.dev/guides/customizing-metro/), and
[Lighthouse scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring).
