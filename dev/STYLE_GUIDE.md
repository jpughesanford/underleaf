# Underleaf Style Guide

> **Audience:** primarily Claude (future sessions), secondarily humans.
> **Purpose:** a single source of truth for visual + interaction decisions so new
> UI stays consistent with what already exists. When you build a new component,
> find the closest existing pattern in §6 and conform to it. Do not invent new
> radii, colors, timings, or spacing values — reuse the scales below.
>
> **Ground truth files** (read these if a rule here seems stale):
> - `src/renderer/styles/tokens.css` — structural tokens (layout, type, shadow, motion)
> - `src/renderer/styles/utilities.css` — `.btn`, `.input`, `.badge`, forms, layout helpers
> - `src/renderer/styles/reset.css` — root scaffolding, scrollbars, selection rules
> - `src/renderer/styles/animations.css` — keyframes
> - `src/renderer/theme/themes/*.json` — all color tokens (set at runtime)
> - `src/renderer/ui/` — `ContextMenu`, `IconButton`, `Modal`, `ModeToggle`
> - `src/renderer/routes/editor/EditorRoute.tsx` — the canonical 3-column layout
>
> See also memory: `project_underleaf_themes.md`, `feedback_codemirror_theme_selectors.md`.

---

## 1. Design philosophy / tone

Underleaf is an **offline, native-feeling desktop IDE** (Electron). The visual
language is **calm, dense, and editor-like** — closer to VS Code / JetBrains than
to a marketing website.

| Principle | What it means concretely |
|---|---|
| **Quiet chrome, loud content** | UI chrome (rails, panels, toolbars) uses muted text and low-contrast borders. The user's document and code are the brightest things on screen. |
| **Information-dense** | Base font is **13px**, panel labels are **11px**. Padding is tight (3–8px in lists, not 16px). We fit a lot without feeling cramped. |
| **Functional motion only** | Animation communicates state (spin = working, pop = synced, flash = success). No decorative entrance animations. Default transition is **150ms ease**. |
| **Native, not flashy** | System font stack, macOS titlebar drag regions, restrained shadows. It should feel like a Mac app, not a webpage. |
| **Calm green identity** | Brand green (`--color-brand`) signals "active / mine / success." Used sparingly — active rail tab, focus ring, primary button, selected state. Never as a large fill. |
| **Theme-agnostic** | Every component MUST read color from CSS variables. Never hardcode a hex color in a component (the one allowed exception is `reset.css`'s first-paint fallback). 7 themes exist; your component must look right in all of them, light and dark. |

**Tone in copy:** terse, technical, lowercase-friendly labels. Panel headers are
`UPPERCASE` 11px. Buttons use sentence case ("Reset to Remote", not "RESET").

---

## 2. Color system

Colors are **not** in CSS. They live in theme JSON and are applied at runtime by
`ThemeProvider.applyTheme()`, which writes each `chrome.*` key as a
`--color-*` CSS variable on `:root`. **To use color, reference the variable.**

### 2.1 Token → variable mapping

The JSON `chrome` object key `bgApp` becomes `--color-bg-app`, `textPrimary` →
`--color-text-primary`, etc. (camelCase → kebab `--color-...`). Core set:

| Variable | Role | Dark value | Light value |
|---|---|---|---|
| `--color-bg-app` | App background, rails, editor bg | `#141b21` | `#f2f2f2` |
| `--color-bg-sidebar` | Sidebar surface | `#17202a` | `#e8e8e8` |
| `--color-bg-panel` | Inset panels (commit box) | `#0f1820` | `#dcdcdc` |
| `--color-bg-card` | Cards | `#1c2932` | `#ffffff` |
| `--color-bg-card-hover` | **The universal hover bg** for ghost/menu/list items | `#21303a` | `#f5f5f5` |
| `--color-bg-toolbar` | Top toolbar | `#15222a` | `#2f6446` |
| `--color-bg-input` | Inputs, secondary buttons | `#0f1820` | `#ffffff` |
| `--color-bg-modal` | Modals, context menus, popovers | `#17202a` | `#ffffff` |
| `--color-brand` | Identity / active / primary | `#98c379` | `#4caf50` |
| `--color-brand-hover` | Primary button hover | `#b4d49a` | `#43a047` |
| `--color-text-primary` | Body text | `#e8eede` | `#1a1a1a` |
| `--color-text-secondary` | Labels, idle icons | `#a5b3a0` | `#555555` |
| `--color-text-muted` | Hints, dim labels, idle rail icons | `#6a786e` | `#909090` |
| `--color-text-accent` | Accent text (pink in dark) | `#f3a5b6` | `#338a3e` |
| `--color-text-error` / `--color-error` | Errors | `#f87171` / `#ef4444` | `#c62828` / `#d32f2f` |
| `--color-text-warning` / `--color-warning` | Warnings | `#f5e0a0` / `#f59e0b` | `#e65100` / `#f57c00` |
| `--color-border` | **Default border** (1px everywhere) | `#2d3d3a` | `#d0d0d0` |
| `--color-border-light` | Subtle/hover border | `#3a4844` | `#e0e0e0` |
| `--color-border-focus` | Input focus ring (= brand) | `#98c379` | `#4caf50` |
| `--color-success` / `--color-info` | Status | `#98c379` / `#93c5fd` | `#388e3c` / `#1976d2` |

Plus derived sets also set by the provider: `--badge-*` (info/sync/err badge bg+border+color),
`--gitpanel-sel-bg` / `--gitpanel-sel-fg` (selected file row in Source Control),
`--scrollbar-thumb` / `--scrollbar-thumb-hover`.

### 2.1b Derived tokens (computed in `applyTheme`, not in JSON)

These are computed from the theme's `brand`/`dark` so they track each theme
automatically. **Use these instead of writing your own `rgba()` brand tints.**

| Variable | Value | Use |
|---|---|---|
| `--color-brand-tint` | brand @ 0.15 | **Active / selected fill** — selected file row, active rail button, ROOT badge bg, dashboard project icon |
| `--color-brand-tint-soft` | brand @ 0.10 | Softer selected / drag-over fill — template card selected, compile-target row, drag-over folder |
| `--color-brand-tint-faint` | brand @ 0.04 | Very subtle drop-zone wash (tree root drag) |
| `--color-brand-tint-strong` | brand @ 0.18 | Emphasized hover fill (PDF link hover) |
| `--color-brand-edge` | brand @ 0.40 | Dashed drop outline, chip border (ROOT badge) |
| `--color-brand-edge-strong` | brand @ 0.50 | Drop outline / 1px ring over a tint |
| `--color-overlay-hover` | white@0.08 (dark) / black@0.06 (light) | Hover wash for ghost/transparent surfaces over arbitrary bg (`.btn-ghost`) |
| `--color-error-hover` | `#dc2626` (dark) / `#b71c1c` (light) | Danger button hover/pressed (`.btn-danger`) |

To add another brand-tint opacity, add one line in `applyTheme`'s tint ladder —
never write a raw `rgba(brand…)` in a component.

### 2.2 Rules

- **🚫 ZERO hardcoded color literals in components or CSS.** No hex, no `rgb()`,
  no `rgba()`, no named colors (`white`, `black`) anywhere in `src/renderer`
  **except** the single documented first-paint fallback in `reset.css` (§7). Every
  color — including white/black, translucent overlays, and brand tints — must
  resolve to a `--color-*` / `--badge-*` variable. If the color you need doesn't
  exist as a token, add the token (chrome JSON for a flat color, or the `applyTheme`
  derived ladder for a tint/overlay) — do **not** inline the literal.
- **Borders are always `1px solid var(--color-border)`** unless it's a focus ring
  (`--color-border-focus`) or a hover emphasis (`--color-border-light`).
- **Hover background for any non-filled interactive surface** = `var(--color-bg-card-hover)`.
  Ghost/transparent surfaces that sit over arbitrary backgrounds use the translucent
  `var(--color-overlay-hover)` instead (`.btn-ghost`).
- **Translucent brand tints** ("selected/active fill") use the `--color-brand-tint*`
  / `--color-brand-edge*` ladder (§2.1b). Never hand-write `rgba(brand…)`.
- **Adding a theme** = add one JSON file in `theme/themes/`. No CSS edits. Provide
  the full `chrome`, `theme` (CodeMirror), and `highlightStyle` blocks (copy an
  existing file as a template). ⚠️ In CodeMirror `theme` blocks, `&light`/`&dark`
  selectors only work in `EditorView.baseTheme`, never `EditorView.theme` — they crash the renderer otherwise.

---

## 3. Structural tokens (`tokens.css`)

These are theme-independent. Use the variable, not the literal.

```
--sidebar-width:       280px    /* default left panel width (resizable) */
--rail-width:          44px     /* the icon rail; matches inline `width: 44` in EditorRoute */
--toolbar-height:      48px     /* top toolbar */
--header-h:            34px     /* panel section headers (Files, Source Control) */
--panel-resize-handle: 4px      /* visible width of a drag divider */

--font-sans:  -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif
--font-mono:  'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace

--shadow-sm:  0 1px 3px rgba(0,0,0,0.3)    /* subtle lift */
--shadow-md:  0 4px 12px rgba(0,0,0,0.4)   /* context menus, popovers, floating buttons */
--shadow-lg:  0 8px 24px rgba(0,0,0,0.5)   /* modals */

--transition: 150ms ease                    /* the default for everything */
```

---

## 4. Scales (reuse these — do not introduce new values)

### 4.1 Typography
| Size | Use |
|---|---|
| **11px** | Panel section headers (UPPERCASE, 600, `letter-spacing: 0.5`), badges, file-tree meta, chips, hints |
| **12px** | Context-menu items, secondary buttons (`.btn-sm`), form labels, list rows |
| **13px** | **Base body size**, `.btn`, `.input`, form errors |
| **15px** | Modal title |

Weights: `500` (labels, buttons), `600` (headers, emphasis, badges), `700` (rare, strong section labels). Body line-height `1.5`. Code uses `var(--font-mono)`.

### 4.2 Spacing (the `gap-*` / padding rhythm)
Multiples of 4: **4, 6, 8, 10, 12, 14, 16**. Utility classes: `.gap-1`=4 `.gap-2`=8 `.gap-3`=12 `.gap-4`=16.
- List/tree rows: `padding: 3px 8px`, tree indent step = `14px` per depth.
- Buttons: `6px 14px` (`.btn-sm` = `4px 10px`, `.btn-icon` = `6px`).
- Inputs: `8px 12px`. Modal body: `20px`. Modal header: `16px 20px`. Menu items: `7px 10px`.

### 4.3 Border radius (memorize this ladder)
| Radius | Use |
|---|---|
| **3–4px** | Tiny chips, file-tree badges, inline tags, the resize-divider collapse button |
| **5px** | Menu items, `IconButton`, small ghost buttons |
| **6px** | **`.btn`, `.input`** — the default control radius |
| **8px** | `ContextMenu` surface, `RailButton`, `template-card`, popovers |
| **12px** | `Modal` |
| **999px** | Pills: `.badge`, `.fetch-all-btn` (fully rounded) |
| **50%** | Dots (rail status badge), spinner |

Rule of thumb: **the bigger/floatier the surface, the larger the radius.** Inline control = 6, floating menu = 8, dialog = 12, pill/dot = round.

---

## 5. Motion & animation

Default transition is `var(--transition)` = **150ms ease**. Hover-only color/bg
transitions on small controls often use **100–120ms** (snappier). Keep all UI
transitions in the **100–200ms** band; nothing slower for chrome.

| Keyframe (`animations.css`) | Meaning | Where |
|---|---|---|
| `spin` (0.6s linear ∞) | Generic "working" | `.spinner`, `IconButton.spin` (0.9s) |
| `fetch-spin` (0.7s linear ∞) | Background fetch in progress | `.fetch-all-btn.fetching` |
| `sync-badge-pop` (550ms, `cubic-bezier(0.22,1,0.36,1)`) | "Just synced" celebratory pop | `.sync-badge-flash` |
| `fetch-success-flash` (800ms ease-out) | Success confirmation ring | `.fetch-all-btn.success` |
| `fetch-border-sweep` | Animated gradient border during long op | fetch button border |

**Conventions for new motion:**
- Use motion to **report state**, never to decorate. If it doesn't tell the user
  something changed or is in progress, don't animate it.
- Spin for indeterminate progress. Pulse/pop (cubic-bezier ease-out, ≤600ms) for
  a discrete success moment. Flash a ring for confirmation.
- Resize/hover affordances: instant or 150ms ease background swap (see ResizeHandle:
  divider goes `--color-border` → `--color-brand` on hover in 150ms).
- Respect that this is a dense tool — err toward subtle and short.

---

## 6. Component contracts

Each entry is the **spec a new instance of that pattern must conform to.** Values
are pulled from the live components; match them.

### 6.1 Left utility rail (icon strip)
The narrow far-left column of icon toggles (Files, Source Control, Build Output).
- **Width `44px`** (`--rail-width`), `background: var(--color-bg-app)`,
  `border-right: 1px solid var(--color-border)`, `flex-shrink: 0`.
- Vertical stack, `align-items: center`, `padding-top: 8px`, `gap: 4px`.
- Each button = **`RailButton`** (styles in `RailButton.module.css`): `36×36`,
  `border-radius: 8`, no border.
  - Idle: `background: transparent`, `color: var(--color-text-muted)`.
  - Hover (idle only): color → `var(--color-text-secondary)`.
  - **Active: `background: var(--color-brand-tint)`, `color: var(--color-brand)`.**
  - Optional status dot: `7×7`, `border-radius: 50%`, top-right `6/6`, color
    `--color-error` or `--color-warning`, with a `1.5px` app-bg ring (so it reads on any bg).
- A rail button **toggles** its panel: clicking the active one collapses the sidebar.
- **New rail feature:** add a `RailButton` + an `<Icon>` in `RailIcons.tsx`, wire a
  `sidebarTab` value. Conditional tabs (like Build Output) only render once relevant.

### 6.2 Sidebar panel (the resizable left panel)
The content panel that opens beside the rail (FileExplorer, GitPanel, CompilePanel).
- Width = `layout.sidebarWidth` (default `280px`, resizable), `flex-shrink: 0`,
  `background: var(--color-bg-app)`, `border-right: 1px solid var(--color-border)`,
  `display: flex; flex-direction: column; overflow: hidden`.
- **Every panel starts with a section header** conforming to:
  - `height: var(--header-h)` (34px), horizontal padding ~`8–10px`, vertically centered.
  - Label: `font-size: 11; font-weight: 600; color: var(--color-text-muted);
    text-transform: uppercase; letter-spacing: 0.5`.
  - Header may hold right-aligned `IconButton`s (refresh, new file, etc.).
- Body below header: `flex: 1; overflow: auto`, small top/bottom padding (~4–8px).
- List rows inside: `padding: 3px 8px`, `font-size: 12`, `border-radius: 3–4`,
  hover `background: var(--color-bg-card-hover)`, selected uses brand-tinted bg
  (Source Control rows use `--gitpanel-sel-bg`/`--gitpanel-sel-fg`).
- **New panel:** mount it in EditorRoute's sidebar slot keyed by `sidebarTab`, give it
  the header pattern, make the body scroll, read all surfaces from variables.

### 6.3 Resize handle / divider
Between sidebar↔editor and editor↔PDF.
- Hit area `width: 8`, contains a visible bar `width: 4` (`--panel-resize-handle`),
  `cursor: col-resize`, `background: var(--color-border)` → `var(--color-brand)` on
  hover (150ms ease).
- On hover, an optional **collapse button** appears: `16×28`, `border-radius: 4`,
  `background: var(--color-bg-modal)`, `1px` border, `--shadow-md`, chevron SVG
  pointing toward the collapse direction.

### 6.4 Editor area
The center column (CodeMirror via `EditorPane`, or `DiffView`).
- `flex: 1; min-width: 320px` (search panel's minimum legible width — don't let it shrink past this).
- Tab strip on top when files are open: horizontal, `background: var(--color-bg-app)`,
  `border-bottom: 1px solid var(--color-border)`, `overflow-x: auto`, `flex-shrink: 0`.
  Tabs are `TabItem`s (dirty dot, close affordance). Tab strips are `unselectable`.
- Editor surface bg = `--color-bg-app`; CodeMirror colors come from the theme JSON
  `theme` + `highlightStyle` blocks, **not** from CSS. LaTeX token classes are
  `.tok-keyword`, `.tok-string`, `.tok-comment`, `.tok-number`, `.tok-link`, etc.
  (see any theme's `highlightStyle`).
- Empty state = `EmptyEditor` (centered, muted). Cursor/selection/active-line styling
  belongs in the theme JSON, never inline.

### 6.5 Context menu / popover (`ui/ContextMenu`)
Right-click menus and detail popovers.
- `position: fixed`, positioned at click x/y by the consumer. `z-index: 2000`.
- Surface: `background: var(--color-bg-modal)`, `1px solid var(--color-border)`,
  **`border-radius: 8`**, `padding: 4`, `min-width: 200`, `box-shadow: var(--shadow-md)`.
- Optional header row: `padding: 4px 12px 6px`, `font-size: 11`, `font-weight: 600`,
  `color: var(--color-text-muted)`, bottom border + `margin-bottom: 4`.
- **Item:** full-width flex, `gap: 8`, `padding: 7px 10px`, `border-radius: 5`,
  `font-size: 12`, `color: var(--color-text-primary)`, `transition: background 100ms`.
  - Hover: `background: var(--color-bg-card-hover)`.
  - Disabled: `color: var(--color-text-muted)`, no hover bg.
  - Leading icon: `.itemIcon`, `flex-shrink: 0`, `color: var(--color-text-muted)`.
- **Danger variant** (Delete, Reset to Remote): text + icon `--color-text-error`,
  hover `background: var(--badge-err-bg)`.
- Separator: `height: 1px; background: var(--color-border); margin: 4px 6px`.
- **New menu:** reuse `ContextMenu`; supply items as `{ label, icon, onClick, danger?, disabled? }`. Don't build a bespoke floating menu.

### 6.6 Modal / dialog (`ui/Modal`)
- Overlay: `position: fixed; inset: 0; background: rgba(0,0,0,0.6)`,
  `backdrop-filter: blur(4px)`, centered, `z-index: 1000`. Click on backdrop closes.
- Dialog: `background: var(--color-bg-modal)`, `1px solid var(--color-border)`,
  **`border-radius: 12`**, `width` prop default `440` (`max-width: 90vw`),
  `box-shadow: var(--shadow-lg)`, `overflow: hidden`.
- Header: `padding: 16px 20px`, space-between, title `font-weight: 600; font-size: 15`,
  ghost close button (×) bottom-bordered.
- Body: `padding: 20`. **Escape closes** (already wired in `Modal`).
- Use the `.form-*` utilities for body content (see 6.8). **New dialog:** wrap content
  in `<Modal title=... onClose=...>`; don't hand-roll an overlay.

### 6.7 Buttons (`.btn` family — `utilities.css`)
Base `.btn`: inline-flex, centered, `gap: 6`, `padding: 6px 14px`,
`border-radius: 6`, `font: 13px/500 sans`, `transition: background+opacity 150ms`,
`:disabled` → `opacity: 0.5`. Variants:
| Class | Look | Use |
|---|---|---|
| `.btn-primary` | `--color-brand` bg, white text, hover `--color-brand-hover` | Main confirm action (one per dialog) |
| `.btn-secondary` | `--color-bg-input` bg, `1px` border, hover `--color-bg-card-hover` | Cancel / secondary |
| `.btn-ghost` | transparent, `--color-text-secondary`, hover `var(--color-overlay-hover)` | Toolbar/inline low-emphasis |
| `.btn-danger` | `--color-error` bg, white, hover `var(--color-error-hover)` | Destructive confirm |
| `.btn-sm` | `4px 10px / 12px` | Compact contexts |
| `.btn-icon` | `padding: 6` | Square icon-only |

For **icon-only toolbar buttons inside features**, prefer `ui/IconButton`
(transparent, `border-radius: 5`, sized via prop — 24 in file/git toolbars, 26 in
PDF tools, 36 in rails; hover bg `--color-bg-card-hover`, `.active` = toggled-on,
`.spin` for in-flight). **New button:** pick a `.btn` variant or `IconButton`; never style a raw `<button>`.

### 6.8 Inputs & forms (`utilities.css`)
- `.input`: full-width, `padding: 8px 12px`, `--color-bg-input` bg, `1px border`,
  `border-radius: 6`, `13px`, focus → `border-color: var(--color-border-focus)`,
  placeholder `--color-text-muted`. `textarea.input` resizes vertical + uses mono.
- Form layout: `.form-section` (column, `gap:16`) › `.form-field` (column, `gap:6`)
  with `.form-field-label` (12/500 secondary), `.form-field-hint` (12 muted, code in mono 11),
  `.form-error` (13 error). Actions row: `.form-actions` (right-aligned, `gap:8`, `padding-top:8`).
- Selectable choice cards: `.template-card` (radius 8, border; selected → brand border +
  `var(--color-brand-tint-soft)` bg + brand text).

### 6.9 Badges & status (`utilities.css`)
- `.badge`: pill (`border-radius: 999`), `padding: 2px 7`, `11px/500`. Variants
  `.badge-green/red/yellow/blue/gray` use translucent status tints + matching text color.
- `.spinner`: `16×16`, `2px` ring with `currentColor` top, `spin 0.6s`.
- Dot indicator (rail): `7×7` circle, status color, app-bg ring.

### 6.10 Diff & conflict view (`features/diff-view/`, `styles/diff-view.css`)
The Source Control diff. Opened from the git panel; **occludes the whole main
area** — editor *and* PDF pane — so the author sees only the diff (EditorRoute
suppresses the PDF handle + pane while `diffTarget` is set). Reference mockup:
`dev/design-mockups/diff-views.html`.
- **Shell** (`.dv-root`): column, `background: var(--color-bg-app)`.
- **Header** (`.dv-header`): `height: var(--header-h)` (34px) so it lines up with
  the Source Control panel header to its left (§6.2); app bg, hairline bottom.
  Holds filename (13/600) + dir (11 muted), a status pill, a `+N −M` stat, the
  Split/Unified segmented control, and `IconButton`s (open-in-editor, close).
- **Status pill** (`.dv-pill`): badge pill reusing `--badge-*` sets —
  `unstaged`=info, `staged`=sync/green, `conflict`=error.
- **Split/Unified toggle** (`.dv-seg`): segmented control; active button =
  `var(--color-brand-tint)` + brand text (the app's toggle convention, §6.1).
- **Color semantics — the one theme-independent exception:** add/delete use fixed
  green/red rgba tints (`--dv-add-*`/`--dv-del-*` in `diff-view.css`), because
  green = added / red = removed regardless of theme, and they must read over both
  editor backgrounds. Layered: whole-line tint (~13%) < gutter (~24%) < accent
  glyph. **No word-level/intra-line highlight** — authors found it distracting
  ([[feedback_diff_no_word_highlight]]); change emphasis is the whole-line tint
  plus a colored **+/−** sign per line (both split and unified).
- **The fold** (`.dv-fold`): the skipped-region separator. A quiet centered rule
  (`::before` gradient hairline) with a floating capsule — a brand-green bar +
  plain-language **"N unchanged lines"** (never git's `@@ … @@`, which only
  survives in the title tooltip; authors aren't git users —
  [[feedback_plain_language_for_authors]]). Clickable to reveal hidden context;
  on hover the capsule lifts and an unfold chevron fades in.
- **Conflict block** (`.dv-conflict`): card bordered with `--badge-err-border`;
  *ours* (`HEAD (current)`) red-tinted, *theirs* (`incoming`) green-tinted, common
  lines flowing quietly around it. Accept buttons (`.dv-accept`) are neutral and
  take the side's accent on hover (ours→red, theirs→green, both→brand). Labels are
  plain ("Accept Current / Incoming / Both"), not "ours/theirs".
- **Minimap rail** (`.dv-map`, `DiffMinimap.tsx`): 14px change-overview on the
  right edge mapping the *rendered/scrollable* content (not the whole file, so the
  viewport box is exact and there are no dead zones). Green/red ticks at changed
  rows, a brand viewport box; click-to-jump + drag-to-scrub; hides itself when
  nothing overflows.

---

## 7. Cross-cutting rules

- **Selection:** text/labels/code are selectable by default (`user-select: text` on root).
  Interactive chrome (buttons, tab strips, file rows, drag regions) opts out via
  `.unselectable` or component rules. Add `.unselectable` to any new clickable row/strip.
- **Scrollbars:** thin (`6px`), transparent track, `--scrollbar-thumb` thumb. Don't restyle per-component.
- **Titlebar drag:** macOS — draggable regions get `.titlebar-drag`, interactive
  children inside them get `.titlebar-no-drag`.
- **Z-index ladder:** content `0` → context menu / popover `2000` (above) ... modal
  overlay `1000`, floating collapse button `10`. (Note: context menus intentionally
  sit above modals.) Reuse these tiers; don't pick arbitrary z-values.
- **First paint:** the only place a literal color is allowed is `reset.css`'s `html`
  fallback (`#141b21`/`#e8eede`, matches Underleaf Dark), covering the one frame
  before `ThemeProvider` mounts.

---

## 8. Checklist for any new UI element

1. Does an existing component in §6 already cover this? Reuse it.
2. All colors via `--color-*` / `--badge-*` variables — **zero hardcoded hex, rgb,
   rgba, or named colors** (§2.2). Brand tints use the `--color-brand-tint*` ladder.
3. Radius from the §4.3 ladder; spacing from the §4.2 rhythm; font size from §4.1.
4. Borders `1px solid var(--color-border)`; hover bg `var(--color-bg-card-hover)`.
5. Transitions 100–200ms; motion only if it reports state (§5).
6. Verify it reads correctly in both a light theme (`underleaf-light`) and a dark
   theme (`underleaf-dark`), since users switch.
7. Mark interactive rows/strips `.unselectable`; keep text content selectable.
8. New shared primitive → `src/renderer/ui/` as a `*.module.css` + component.
   Component-specific styles → CSS Module or inline; cross-cutting helpers → `utilities.css`.
