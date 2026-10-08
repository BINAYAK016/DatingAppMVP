# Sangai UI reform design system

Sangai keeps its warm palette and private, match-only experience. The visual direction pairs a compact four-tab structure with soft cards and editorial headings: the person, the conversation and the next action take priority over decorative chrome.

## Source of truth

`apps/mobile/src/theme.ts` exports `C` (colour) and `T` (type, font, spacing, radius, layout, motion and depth). `components/ui.tsx` re-exports both for existing consumers. Native and web use the same values. The browser-only focus/selection canvas variables in `web.css` mirror these tokens; no dark theme is introduced.

### Preserved brand primitives

| Token        | Value     | Intended use                             |
| ------------ | --------- | ---------------------------------------- |
| `C.bg`       | `#FFFBF8` | Main canvas                              |
| `C.ink`      | `#2C2529` | Primary text                             |
| `C.muted`    | `#7A6D73` | Secondary text on white/off-white only   |
| `C.line`     | `#EEE4E3` | Decorative dividers and card edges       |
| `C.primary`  | `#AA536B` | Primary actions and substantial icons    |
| `C.blush`    | `#F7E6E9` | Connection and selected surfaces         |
| `C.peach`    | `#F8E9DE` | Warm canvas and profile surfaces         |
| `C.lavender` | `#EFEBF5` | Quiet supporting cards and game surfaces |
| `C.white`    | `#FFFFFF` | Surface and primary-button text          |
| `C.red`      | `#A7374B` | Errors and destructive actions           |

### Semantic additions

- `C.textOnTint = #6F6168`: secondary text that remains readable across all warm surfaces.
- `C.brandTextOnTint = #944259`: small branded text on blush, peach or lavender. Also used by `C.focus` and `C.primaryPressed`.
- `C.controlBorder = #89757D`: visible outline for inputs, secondary actions and unselected choices. Decorative `C.line` is not the only boundary of an essential control.
- `C.surfaceSubtle = #F5EFEC`: disabled/read-only field surface.
- `C.scrim = #2C252966`: modal backdrop.
- `C.accent = #DB947B`: original decorative warm accent; not a text colour.
- `C.success = #41624D`, `C.successSoft = #E7EEE7`; `C.warning = #79582D`, `C.warningSoft = #F8E9DE`: semantic status colours always accompanied by words/icons.

Calculated WCAG contrast ratios: white on primary **5.05:1**; ink on background **14.54:1**. Secondary text-on-tint is **4.87–4.98:1** on blush/peach/lavender; branded text-on-tint is **5.48–5.62:1**. The original primary and muted colours do not reach 4.5:1 for small text on those tinted surfaces, so use their semantic text variants there. Do not reduce opacity on enabled text.

## Type and layout

System sans-serif keeps controls and conversations familiar and avoids font downloads. Editorial headings use Georgia on iOS/browser (with serif fallback) and the native serif family on Android. Exact letter shapes follow each platform; hierarchy and spacing are shared.

| Role            | Size / line height                               |
| --------------- | ------------------------------------------------ |
| Display         | 38 / 44                                          |
| Screen title    | 30 / 36                                          |
| Section         | 23 / 30                                          |
| Body            | 16 / 24                                          |
| Supporting text | 14 / 21                                          |
| Metadata        | 12 / 18                                          |
| Label           | 14 / 21, semibold                                |
| Eyebrow         | 11 / 16, semibold with restrained letter spacing |

Use the 4px spacing grid: 4, 8, 12, 16, 20, 24, 32, 40, 48. Page gutters are 20px (16px for media-led layouts). Reading content is capped at 680px including its gutters; narrow app shells at 760px. The browser frame uses a 1240px outer maximum, a 240px navigation rail and a 960px app-column maximum. Sheets use a maximum width of 620px. Touch targets are at least 44px; ordinary buttons have a 52px minimum and may grow with text.

Radii: input14, button16, card22, major media28, sheet28, pill999. Use the subtle card shadow on resting cards, the raised shadow on overlays. Keep boundaries and content readable without relying on shadows. Avoid nested cards around every line of information.

## Shared components

- `Button`: primary or `secondary`, optional `compact`, `icon`, `disabled`, and `loading`. Loading disables repeat activation, exposes busy state and shows a static hourglass beside the caller-provided progress label. Text wraps; colour/hover/press feedback does not move surrounding content.
- `IconButton`: labelled 44px action with plain/soft/primary variants; disabled state is announced. Decorative icons are hidden from screen readers.
- `Chip`: static tags render as a View; choices render as buttons with selected/disabled state. Interactive chips have a 44px minimum target and visible boundary; web exposes `aria-pressed`, while native keeps the existing selected state.
- `Field`: existing controlled value API plus optional `hint`, `error`, `autoComplete`, `returnKeyType`, `onSubmitEditing`. Errors/hints are described to the input, and error messages are announced. Callers retain existing validation and submit behavior; the component does not add requests or alter auth.
- `Header`, `Section`, `Empty`: meaningful headings expose heading semantics. Heading rows and supporting copy may grow instead of clipping essential text.
- `BottomSheet`: named native/web modal with its existing RN/RNW focus trap and restoration; explicit Close action and backdrop dismissal. On web at 768px and above it becomes a centered dialog. Small screens keep a bottom sheet. Footer actions remain outside the scrolling content, while text and keyboard layouts can grow.
- `Page`: safe-area-aware scrolling; fixed footer actions align with the inner reading column (640px with the default 20px gutters). Browser scrollbars remain available.
- `Skeleton`, `Notice`, `SelectionTile`, `StepProgress`: loading, recovery, selected and progress states use existing primitives. Progress exposes its range/value. Place the next useful action beside an empty or recovery state when the caller has one.

Do not add a generic component catalogue for unused tables, drawers, command palettes or popovers. Extend a shared component only when an actual Sangai flow needs it.

## Motion and accessibility

`T.motion` defines feedback120ms, state180ms, reveal240ms and celebration300ms. Animate opacity/transform when useful for orientation, not list height or every decorative surface. The shared reduced-motion hook listens once for the active component tree, starts quietly until native preference is known, guards against stale async reads and handles failed preference reads. Photo-carousel arrow navigation respects that preference.

Web focus is a 3px branded outline with a 3px offset, covering links, buttons, tabs, switches, radios, inputs and keyboard-focusable controls. High-contrast mode uses the system Highlight outline. Browser transition/animation and smooth scrolling respect reduced motion. Native text scaling remains enabled; use wrapping/minimum heights rather than shrinking type to fit. Decorative icon glyphs keep a stable size while labels scale. The bottom tab bar uses intrinsic height on web and font-scale-aware height on native; destination labels can wrap rather than being truncated.

Modal focus containment/return is supplied by RN Web's existing Modal implementation; preserve it. Input errors must be specific and appear beside the relevant field where existing validation identifies it. Busy states never masquerade as success, and user text must survive failures.

## Product safeguards

These are presentation changes. Authentication, sessions, media authentication, API requests, discovery eligibility, match-only visibility, game consent, moderation and data contracts remain authoritative in their existing code. Story rings indicate available accessible stories, not online presence. Demo content stays visibly fictional. Preserve all four tabs and every existing route.

See `ui-reform-discovery.md` for baseline evidence and the main verification report for executed browser/native checks. Contrast calculations and static inspection are not substitutes for runtime keyboard, screen-reader, 200% text or native-device testing.

## Executed foundation checks

On 8 October 2026, `tests/ui/ui-reform-accessibility.spec.ts` passed **14/14** cases against the consolidated exported web app using strict synthetic API fixtures. Coverage includes:

- All four core tabs at 360, 390, 768, 1024, 1440 and 1920px; primary targets at least 44px, no document horizontal overflow, no runtime errors, and the full web icon font loaded.
- Actual tab-label text geometry checked against clipping ancestors at compact widths and under enlarged text.
- Named sheets at 360/1440px: initial title focus, forward/backward keyboard containment, visible focus, Escape dismissal and trigger-focus restoration.
- Computed text font sizes and line heights doubled to **200%**, with long profile copy, at 390/1440px; measured headline sizes confirm doubling. A 360px form also confirms doubled input text, valid field geometry and retained invalid input. This is text scaling, not a viewport-only approximation or a native accessibility certification.
- Reduced-motion static loading; landscape 844×390 navigation and reachable actions; profile-field accessible descriptions, keyboard order, exposed selected toggle state, and an unsaved draft retained after dismissing its confirmation. The reduced-motion assertion rejects any pending animation longer than 0.01ms or more than one iteration, then gives the browser at most one second to finish its initial frame; the RNW modal lifecycle can otherwise be observed before its 0.01ms reduced-motion animation finishes. The corrected check also passed five consecutive repetitions on the final synchronous export.

The normal-size and 200%-text profile screenshots were visually inspected; previously clipped navigation labels now fit, with long enlarged labels wrapping. Evidence is in `artifacts/ui-reform/accessibility/`. Mobile typecheck and lint passed with zero reported warnings at this verification point. The authenticated image/video/media request block in `ui.tsx` was compared to the branch base and remained byte-for-byte unchanged. Native device and screen-reader checks are recorded separately by the main verification workflow; they are not implied by these browser results.
