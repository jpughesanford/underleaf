
## Short Term

- [x] in the git panel, the amend button is not very visible in light mode. its not readable. 
- [x] in the find and replace panel, make the all button the same color as the replace button. Change the replace and all hover styling to match that of the up and down arrow buttons.
- [x] there seems to be a bug where if the utility panel is closed and you click on the utility button that is already open (but hidden) the panel does not reappear. It only reappears when you change utilities. It should appear either way.  
- [x] brightness window can extend beyond the app window, moving off screen. 

## Mid Term

- [x] can we add the "Find in PDF" and "Find in Source" buttons that over leaf has that jump between the editor and pdf? (SyncTeX forward/inverse: two buttons on the editor/PDF divider + ⌘-click on the PDF)
- [ ] add spell check to editor. 

## Deffered 

- [ ] (deffered for now) compile.ts's readPdf returns the entire PDF as an ArrayBuffer over IPC on every preview. Fine for normal documents; large PDFs get fully copied through the bridge each compile. This was logged as a "note for later" — a future streaming/file-URL approach

### Style guide audit (2026-05-28)

Violations of `dev/STYLE_GUIDE.md` 

- [ ] Modularization opportunity (incremental, no visual change). extract inline-style-heavy components (`GitPanel`, `FileExplorer`,
      `Toolbar`, `EditorRoute`, `dashboard/*`, `ResizeHandle`, `Modal`) to
      `*.module.css`, conforming to style guide §6. **Deliberately deferred:** large refactor,
      no visual/functional change, real regression risk — do it component-by-component
      with visual verification, not in one blind pass. `RailButton` is the reference
      pattern.