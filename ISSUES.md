
## TODO 

- [ ] brightness window can extend beyond the app window, moving off screen. 
- [ ] can we add the "Find in PDF" and "Find in Source" buttons that over leaf has that jump between the editor and pdf?
- [ ] selecting a file in the git panel should open the file with all git changes hi lighted. The PDF does not need to be here in the git panel. We can show the old file in a left editor and the new file in the right editor. 
- [ ] diff view: drop word-level / intra-line highlighting — use whole-line tint + gutter accent only (user finds word highlights distracting). Remove `--dv-*-word` + `.dv-w-add`/`.dv-w-del` from `diff-view.css`. Reference: `dev/design-mockups/diff-views.html`. 
- [ ] diff view: replace the `@@ … @@` hunk header (`.dv-hunk`) with the plain-language "fold" separator — recessed Word-style seam + capsule reading "No changes · lines X–Y", green accent bar, click-to-unfold. Authors aren't git users. Reference: `dev/design-mockups/diff-views.html` study 04. 
- [ ] add spell check to editor. 
- [ ] compile.ts's readPdf returns the entire PDF as an ArrayBuffer over IPC on every preview. Fine for normal documents; large PDFs get fully copied through the bridge each compile. This was logged as a "note for later" — a future streaming/file-URL approach
- [] in the git panel, the amend button is not very visible in light mode. its not readable. 
- [] in the find and replace panel, make the all button the same color as the replace button. 

## Style guide audit (2026-05-28)

Violations of `dev/STYLE_GUIDE.md` §2.2 (zero hardcoded color literals). The
brand-tint literals (`rgba(76,175,80,…)`) were already tokenized into the
`--color-brand-tint*` ladder; the items below remain. **Diff-view / merge-conflict
code is intentionally excluded — another agent owns it.**

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
- [ ] *(DEFER — Source Control domain)* `EditorPane.tsx:104-106` merge-conflict
      decorations hardcode `#2e7d32`/`#c62828`/`#f59e0b` + `rgba()` fills.
      Coordinate with the diff-view agent before tokenizing.

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