
## TODO 

- [ ] brightness window can extend beyond the app window, moving off screen. 
- [ ] can we add the "Find in PDF" and "Find in Source" buttons that over leaf has that jump between the editor and pdf?
- [x] selecting a file in the git panel should open the file with all git changes hi lighted. The PDF does not need to be here in the git panel. We can show the old file in a left editor and the new file in the right editor. (done — diff view opens from the git panel with old-left/new-right split + tinted changes, and now occludes the PDF pane while open.)
- [x] diff view: drop word-level / intra-line highlighting (done — `CodeContent` is tint-only; removed dead `wordDiff` engine code + tests).
- [x] diff view: plain-language hunk separator — implemented as the "fold" milestone (`.dv-fold`): centred rule + capsule "N unchanged lines", green accent bar, click-to-unfold with hover chevron.
- [x] diff view: coloured +/− signs in the side-by-side view; change-overview minimap rail (click/drag to navigate).
- [ ] add spell check to editor. 
- [ ] compile.ts's readPdf returns the entire PDF as an ArrayBuffer over IPC on every preview. Fine for normal documents; large PDFs get fully copied through the bridge each compile. This was logged as a "note for later" — a future streaming/file-URL approach
- [] in the git panel, the amend button is not very visible in light mode. its not readable. 
- [] in the find and replace panel, make the all button the same color as the replace button. 

## Style guide audit (2026-05-28)

Violations of `dev/STYLE_GUIDE.md` §2.2 (zero hardcoded color literals). The
brand-tint literals (`rgba(76,175,80,…)`) were already tokenized into the
`--color-brand-tint*` ladder; the items below remain. (The diff view is now
shipped and its own `.dv-seg` literal was tokenized; the EditorPane merge-conflict
decorations in item B are a separate, still-pending cleanup.)

### A. Hardcoded brand green `#4CAF50` → should be `var(--color-brand)`
- [ ] `FileExplorer.tsx:67,183,184` — folder icon `color: '#4CAF50'` (3×).
- [ ] `OnboardingRoute.tsx:10` — `const BRAND = '#4caf50'` used throughout the
      onboarding screen; replace with the brand var (or read from theme).

### B. Hardcoded status colors duplicating existing tokens
(`#f87171`/`#fbbf24`/`#c62828` already exist as `--color-text-error` /
`--color-text-warning`; error text should ideally use the `.form-error` utility.)
- [ ] `AddRemoteModal.tsx:62` (`#fbbf24`), `:66`,`:96` (`#f87171`) — use tokens / `.form-error`.
- [ ] `DashboardRoute.tsx:219,233` (`#fbbf24`), `:408,433` (`#f87171`).
- [ ] `OnboardingRoute.tsx:177` (`#c62828`) — replace with `.form-error`.
- [ ] `EditorPane.tsx:104-106` — the *in-editor* merge-conflict line decorations
      hardcode `#2e7d32`/`#c62828`/`#f59e0b` + `rgba()` fills. (Separate from the
      shipped diff-view conflict panel; tokenize against `--dv-*`/status vars.)

### C. White / black literals → need on-brand / overlay tokens
- [ ] `utilities.css` — `.btn-primary`/`.btn-danger` use `color: white`. Introduce
      `--color-on-brand` (white in current themes) rather than a literal.
- [ ] `SettingsModal.tsx`, `GitPanel.tsx`, `OnboardingRoute.tsx` — assorted
      `#fff`/`#000`/`white` literals; audit each against tokens.
- [ ] `theme-album.css` — standalone theme-preview page; lower priority but still
      has 5 white/black literals.

### D. Inline box-shadow literals duplicating `--shadow-*`
- [ ] Sweep components for inline `box-shadow: 0 … rgba(0,0,0,…)` and replace with
      `var(--shadow-sm|md|lg)` where they match.

### E. Modularization opportunity (incremental, no visual change)
`RailButton` was migrated to a CSS module as the reference pattern. The following
are built almost entirely with inline styles and mix layout + color; extract to
`*.module.css` over time, conforming to the §6 contracts:
- [ ] `GitPanel.tsx`, `FileExplorer.tsx`, `Toolbar.tsx`, `EditorRoute.tsx`,
      `dashboard/*`, `ResizeHandle.tsx`, `Modal.tsx` (→ shared `ui/` modules).
- [ ] Modals (`AddRemoteModal`, `Onboarding`) re-implement error text inline instead
      of reusing the existing `.form-error` / `.form-*` utilities.