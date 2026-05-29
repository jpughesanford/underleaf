
## Short Term

- [ ] add git commit histery to commit panel 

## Mid Term

- [ ] make git panel more user friendly. have a better way to look at git history, have git log and errors be persistent

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