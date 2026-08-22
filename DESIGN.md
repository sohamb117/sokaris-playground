# Sokaris Playground Design Contract

## 1. Atmosphere & Identity

Sokaris is a severe, desktop terminal workspace: direct, technical, and free of
decoration. Its signature is a full-height 50/50 split drawn only with square
black-and-white rules. The interface must feel like a dependable local machine,
not a consumer code editor or a simulation of a glowing CRT.

## 2. Color

### Palette

| Role | Token | Value | Usage |
| --- | --- | --- | --- |
| Black | `--color-black` | `#000` | Dark surface, dark text, dark border |
| White | `--color-white` | `#fff` | Light surface, light text, light border |
| Surface | `--surface-primary` | `var(--color-black)` | Application background |
| Text | `--text-primary` | `var(--color-white)` | Text on the application background |
| Inverse surface | `--surface-inverse` | `var(--color-white)` | Deliberately inverted regions |
| Inverse text | `--text-inverse` | `var(--color-black)` | Text on inverted regions |
| Border | `--border-default` | `var(--color-white)` | Every structural division |
| Inverse border | `--border-inverse` | `var(--color-black)` | Divisions on inverted regions |

### Rules

- `#000` and `#fff` are the only permitted color values, including semantic and
  interaction states.
- No gray, opacity-derived gray, alpha color, accent color, image tint, or
  platform-specific system color is permitted.
- Color must remain flat. Gradients, translucency, blend modes, and textures are
  prohibited.
- Future state differences must use inversion, border weight, text treatment, or
  symbols rather than additional colors.

## 3. Typography

### Font stack

`--font-mono: ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas,
"Liberation Mono", "DejaVu Sans Mono", "Segoe UI Symbol", "Apple Symbols",
monospace;`

No font files may be downloaded or bundled. The symbol fallbacks exist only for
glyph coverage; all visible text remains in the single system monospace stack.

### Scale

| Level | Token | Size | Weight | Line height | Tracking | Usage |
| --- | --- | --- | --- | --- | --- | --- |
| Title | `--type-title` | `2rem` | `700` | `1` | `-0.04em` | Primary workspace title |
| Heading | `--type-heading` | `1rem` | `700` | `1.25` | `0` | Pane and section headings |
| Body | `--type-body` | `0.875rem` | `400` | `1.5` | `0` | Default terminal text |
| Label | `--type-label` | `0.75rem` | `700` | `1.25` | `0.08em` | Metadata and terse labels |
| Caption | `--type-caption` | `0.75rem` | `400` | `1.25` | `0` | Secondary technical detail |

### Rules

- Typography is functional and compact; no display, serif, proportional, or
  decorative face is permitted.
- Labels may be uppercase. Body copy and source text preserve authored casing.
- Type tokens above are exhaustive until a real content requirement proves a
  missing level.

## 4. Spacing & Layout

### Base unit and spacing

All spacing derives from a 4px base unit.

| Token | Value | Usage |
| --- | --- | --- |
| `--space-0` | `0` | Flush terminal edges |
| `--space-1` | `4px` | Tight symbol or text separation |
| `--space-2` | `8px` | Compact inline groups |
| `--space-3` | `12px` | Dense control or row inset |
| `--space-4` | `16px` | Standard pane inset |
| `--space-6` | `24px` | Section separation |
| `--space-8` | `32px` | Major internal separation |

### Desktop grid

| Token | Value | Contract |
| --- | --- | --- |
| `--layout-min-width` | `1024px` | Hard desktop-only minimum width |
| `--layout-columns` | `minmax(0, 1fr) minmax(0, 1fr)` | Exact 50/50 primary split |
| `--layout-pane-width` | `50%` | Semantic reference for each pane |
| `--layout-min-height` | `100dvh` | Full viewport workspace floor |
| `--help-dialog-max-width` | `480px` | Help surface width ceiling within the output pane |
| `--help-dialog-inline-inset` | `var(--space-2)` | Help surface distance from each output-pane inline edge |
| `--help-dialog-block-inset` | `var(--space-2)` | Help surface distance from each output-pane block edge |
| `--help-dialog-width` | `min(max width, available output width)` | Help width resolved inside its structural host |
| `--help-dialog-max-height` | `available output height` | Help height ceiling after both block insets |
| `--output-preview-width` | `80%` | Result canvas display target within the output pane |
| `--output-preview-max-height` | `80%` | Result canvas display-height ceiling within the output pane |

### Rules

- The application is desktop-only and must declare `min-width: 1024px`.
- The primary workspace is exactly two equal columns. Neither pane may grow,
  shrink, collapse, stack, or become a drawer.
- No mobile or tablet adaptation is defined. Narrow viewports may scroll
  horizontally rather than altering the approved desktop composition.
- Use only declared spacing tokens; no arbitrary visual measurements.

## 5. Components

### Workspace shell

- `Playground`: one `100dvh` application region with the exact two-track
  `--layout-columns` grid and a `1px` white vertical divider. Both tracks remain
  `50%` at every viewport width; the application never stacks below its
  `1024px` minimum.
- `EditorColumn`: the left track is a three-row grid. The image row is `144px`
  expanded or `36px` collapsed, the code row is `minmax(0, 1fr)`, and the footer
  row is `36px`. Row boundaries are `1px` white rules. Collapsing the image row
  must not alter source text, selection, textarea focus, or the image registry.
- `OutputPane`: the right track is a black canvas stage. A terse loading message
  occupies this pane until the worker reports ready. During execution the same
  element reads `running`, the pane exposes `aria-busy=true`, and any stale
  scalar is hidden. Completion, timeout, or initialization failure hides the
  loading element and removes the busy state. Thereafter the last successful
  canvas remains mounted through later runtime or decode errors.

### Image folder pane

- `ImagePaneToggle`: a native, full-width `button` exactly `36px` high. It names
  the image folder, exposes `aria-expanded`, and uses the label type token with
  `12px` horizontal inset. Hover and focus invert black and white immediately;
  focus also receives the `2px` strong rule inset from the pane edge.
- `ImageDropZone`: the remaining `108px` of the expanded row is a native file
  selection target and drop target for multiple `image/*` files. Its inset is
  `12px`; instructional copy uses the caption token. It lists accepted files by
  exact filename in insertion order and contains no remove, rename, or action
  control. The initial registry contains the bundled project-owned `input.png`,
  decoded through `ImageDecodeBoundary`; a later valid duplicate replaces data
  without moving the name.
- `ImageDecodeBoundary`: each accepted image is decoded at native dimensions
  with no rescale into row-major `Uint8ClampedArray` RGBA bytes. Browser decode
  disables color-space conversion, alpha premultiplication, and orientation.
  The most recently inserted or replaced registry image is active; list order
  remains unchanged and only the active image reaches the compiler.
- States: expanded-empty, expanded-populated, collapsed, drag-target, and
  decode-error. Drag-target uses immediate color inversion only. Decode errors
  are rendered by the shared output alert and do not mutate this pane.

### Code pane and footer

- `CodeEditor`: one native `textarea` labelled `Sokaris code`, filling the code
  row with `16px` inset, body typography, black surface, white text, square
  corners, and no internal border. Native selection and caret behavior remain
  intact. Its mount value is the raw bundled `starter.jl` source,
  the raw `starter.jl` helper plus `main!(pixels::Vector{UInt8})` loop, and is
  never rewritten after mount. Focus is communicated by a `2px` white inset
  rule. Source edits queue one auto-run `300ms` after the latest edit; there is
  no Run control. Runtime readiness and starter-image decoding must both settle
  before the initial execution; either failure appears in `ErrorAlert`.
- `HelpFooter`: exactly `36px` high with `8px` horizontal inset and a `4px` gap.
  It contains only a native `HelpTrigger` button whose visible text is `?` and
  accessible name is `Open Sokaris help`, followed by the exact caption
  `press shift for compositor menu`.
- `HelpTrigger`: a square `20px` by `20px` native button. Default is white with
  black text; hover, active, and focus invert it. Strong focus uses the `2px`
  rule. It toggles the nonmodal help dialog and regains focus when the dialog is
  dismissed with Escape or an outside pointer action.

### Floating surfaces

- `OperatorMenu`: a fixed-position `role="menu"` opened only by standalone,
  nonrepeating Shift whose initial keydown occurs while the textarea owns
  `document.activeElement`. One window-level keydown/keyup pair handles the full
  sequence so cross-target keyup delivery works without bubbling duplicates;
  any non-Shift key while held, textarea blur, or window blur cancels it, and all
  listeners are removed on disposal. Its left edge begins at the measured
  textarea caret and is clamped to a `4px` viewport inset; its top edge begins
  below the caret by one body line and flips above when required. It has a `1px`
  white border, black surface, and no shadow. The exact 14 native
  `button[role="menuitem"]` rows are `28px` high with `8px` horizontal inset.
  Keyboard focus inverts one row and therefore identifies the exact Enter
  target. Hover on any other row remains black with white underlined text, so a
  pointer cannot create a second selected-looking row. ArrowUp/ArrowDown,
  Home/End, Enter, Escape, Tab, outside pointer selection, and direct pointer
  selection follow native menu expectations.
- `HelpDialog`: an absolute, nonmodal `role="dialog"` named `Sokaris compositor
  help`, structurally appended to the positioned `OutputPane`. Its inline and
  block insets, width, and maximum height use the declared help tokens. The
  surface therefore stays inside the output half of the `1024px` desktop canvas
  and cannot intersect the code textarea when an 800px or 900px viewport scrolls
  horizontally. It scrolls internally when needed; structured documentation may
  extend beyond one viewport but every section remains reachable through native
  scrolling. The surface uses a `1px` white border,
  `16px` inset, black surface, and body type. It has no close button; the same
  `?`, Escape, or an outside pointer action closes it. Typed help data generates
  `Quick start` with the exact starter source, `Program rules`, `Compiler subset`
  with supported typed helpers, loops, branches, and byte access,
  `Compositor glyphs` with the exact 14 semantics, and `Runtime limits` covering
  the Julia subset boundary, native resolution, source diagnostics, scalar
  interpreter fallback, 10-second execution timeout, and 60-second compiler
  initialization timeout. Sections use `16px` separation
  and glyph rows use the 4px spacing scale.

### Canvas and error output

- `ResultCanvas`: one native canvas centred in the output pane. Its internal
  `width` and `height` attributes always remain native result dimensions, while
  CSS constrains its displayed box to 80% maximum width and height with automatic
  aspect preservation and normal downscaling. It never resamples ImageData or
  changes image transformation semantics. The painter only accepts positive
  integer dimensions and exactly `width × height × 4` clamped RGBA bytes, then
  calls `putImageData` directly. Image pixels are exempt from
  the UI palette; the surrounding stage remains black.
- `ErrorAlert`: one minimal `role="alert"` with a `1px` white border, `12px`
  inset, body type, black surface, and white text. It uses `textContent`, never
  HTML, and overlays no controls. The alert appears for decode/runtime/paint
  failures, including runtime initialization and execution timeout, disappears
  on the next success, hides stale scalar output, and never clears or repaints
  the last successful canvas.

### Shared accessibility and state rules

- Every interactive element is a native button, textarea, or file input; no
  clickable generic container is approved.
- Focus is always visible using only inversion and the `2px` strong border.
  Pointer and keyboard affordances expose the same result without motion.
- Hidden menus, dialogs, file inputs, alerts, and loading copy must be removed
  from both visual layout and the accessibility tree when inactive.
- All event listeners, timers, workers, and bitmap resources are released on
  component disposal and `pagehide`.

## 6. Motion & Interaction

Motion is prohibited. Use no animation, transition, parallax, smooth scrolling,
blinking, pulsing, shimmer, transform, or animated caret treatment.

Future interactive states must be immediate and binary. Hover, active, focus,
disabled, loading, and error treatments may use only the two palette colors,
square borders, text weight, underlines, and symbol changes. Keyboard focus must
remain unmistakable without motion or a third color.

## 7. Depth & Surface

The sole depth strategy is **borders-only**.

| Token | Value | Usage |
| --- | --- | --- |
| `--border-width` | `1px` | Standard structural rules |
| `--border-strong-width` | `2px` | Focus or explicitly emphasized rule |
| `--border-style` | `solid` | All borders |
| `--radius-none` | `0` | Every corner |
| `--shadow-none` | `none` | Every surface |

- Surfaces are flat and meet at square, visible boundaries.
- No shadows, border radii, gradients, glows, blur, translucency, scanlines,
  noise, dithering, or simulated material effects.
- Separation comes only from solid black/white borders and intentional color
  inversion.
