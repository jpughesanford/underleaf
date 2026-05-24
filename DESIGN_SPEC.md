# Underleaf — Design Specification

A desktop LaTeX IDE that provides an Overleaf-faithful editing experience and PyCharm-style git integration for working on LaTeX projects offline.

---

## Core Concept

The user maintains a local folder of git repositories (populated however they choose — Overleaf git bridge, GitHub sync, manual clone, etc.). Underleaf opens this folder, displays a dashboard of available projects, and provides a full editing, compilation, and git workflow without requiring an internet connection.

---

## Platform & Distribution

| Decision | Choice |
|----------|--------|
| Initial target | macOS |
| Future targets | Windows, Linux (no macOS-specific APIs used in v1) |
| Tech stack | Electron + React + TypeScript |
| Distribution | GitHub Releases + Apple notarization + `electron-updater` |
| App Store | Excluded — sandbox restrictions incompatible with TeX Live and git shell-outs |

---

## Editor

- **Component:** CodeMirror 6 with Overleaf's `lezer-latex` grammar for syntax highlighting
- **Autocomplete:** LaTeX commands, `\cite{}` from `.bib` files, `\ref{}` from defined labels
- **Multiple windows:** Each project opens in its own Electron window with independent processes

---

## Compilation

- **Engine:** `latexmk` (included with TeX Live; handles all multi-pass logic automatically)
- **Requirement:** User must have TeX Live installed locally
- **Default trigger:** Manual (user clicks Recompile) — matches Overleaf's default
- **Configurable trigger:** On-save or debounced auto-compile, set globally in preferences
- **SyncTeX:** Always compile with `-synctex=1` to enable editor↔PDF scroll sync
- **Root document:** Auto-detect file containing `\documentclass`; user can override via gear icon in editor toolbar; override stored in `.underleaf` config at repo root

### Error Display
- Primary view: parsed error/warning list with clickable file + line references (jumps to editor location)
- Secondary view: Raw Log tab showing full `latexmk` output
- Mirrors Overleaf's compilation panel exactly

---

## PDF Preview

- **Renderer:** PDF.js (runs in Electron's Chromium; consistent cross-platform behavior)
- **Scroll sync:** SyncTeX-driven — clicking in the editor scrolls the PDF to the corresponding location and vice versa
- **Position:** Right panel, always within the app window

---

## Git Integration

### Panel Layout
- Dedicated sidebar tab in the left rail (gear icon activates it, replacing the file explorer)
- Contents: staged files list, unstaged files list, commit message field, Commit / Push / Fetch / Pull buttons

### Workflow
- Stage individual files or hunks (not all-or-nothing)
- Commit with a user-defined message
- Push / fetch / pull against any configured git remote

### Conflict Resolution
- Standard git conflict markers (`<<<<<<<` / `=======` / `>>>>>>>`) written into files
- CodeMirror decorations highlight conflict regions with colored backgrounds
- Inline **Accept Ours** / **Accept Theirs** buttons per conflict hunk

### Authentication
- Delegated entirely to system git (macOS Keychain, SSH agent, Git Credential Manager)
- App captures `stderr` from git processes; if an auth failure pattern is detected, surfaces a dismissible in-app error with setup instructions and a link to documentation

### Connecting a Remote
- When a project has no git remote configured, the git panel shows a **"Connect to Remote"** button instead of push/pull controls
- User pastes any git remote URL (Overleaf git bridge, GitHub, GitLab, self-hosted)
- App runs `git remote add origin <url>` then `git fetch`
- If the remote has only a single initialization commit (Overleaf's default blank project), app offers: *"Remote has only an empty initialization commit — push your local work and overwrite it?"* → `git push --force`

### Supported Remotes
Any git remote: Overleaf git bridge, GitHub, GitLab, Bitbucket, self-hosted.

---

## Project Dashboard

- **Discovery:** Scans a single user-configured root folder; any subdirectory containing `.git` is treated as a project
- **Display name:** Derived from the git remote URL (e.g., `git.overleaf.com/12345/my-paper` → `my-paper`); falls back to directory name if no remote is set
- **Project card metadata:** Last commit date, current branch, count of uncommitted changes
- **Actions:**
  - **Clone Repository** — paste a git URL, app clones into the projects folder
  - **New Project** — choose from bundled templates (Article, Beamer, Thesis); creates a new folder with `main.tex`, `.gitignore`, and `git init`

---

## First Launch

1. App opens to a prompt with two buttons: **Create New Folder** and **Choose Existing**
   - **Create New Folder:** system folder picker → creates directory → empty dashboard
   - **Choose Existing:** system folder picker → scans for git repos → populated dashboard
2. If `latexmk` is not found in `PATH`, a dismissible warning banner appears on the dashboard: *"TeX Live not detected — compilation will be unavailable."* with an Install Instructions link
3. TeX Live check does not block access to the dashboard or editor

---

## Settings

### Global (`Cmd+,` — native Mac preferences window)
- Projects root folder path
- Default TeX engine (`pdflatex`, `xelatex`, `lualatex`)
- Default compilation trigger (Manual / On Save / Auto)
- TeX Live version (informational; app warns if local version differs from Overleaf's current version)

### Per-Project (gear icon in editor toolbar — stored in `.underleaf` at repo root)
- Root document override
- Engine override
- Bibliography tool (`bibtex` / `biber`)
- Compilation trigger override

---

## v1 Scope Exclusions

| Feature | Reason Excluded |
|---------|----------------|
| Overleaf comments & review | Requires unofficial Overleaf API; fragile, ToS gray area. Deferred post-v1. |
| Mac App Store distribution | Sandbox incompatible with TeX Live shell-outs and arbitrary folder access |
| Windows / Linux | Planned post-v1; no design decisions block this path |

---

## Phased Build Order

### Phase 1 — Project Scaffold & Dashboard
**Goal:** A running Electron app that can open a folder and display projects.

- [ ] Initialize Electron + React + TypeScript project (`electron-vite` or similar)
- [ ] Set up ESLint, Prettier, TypeScript strict mode
- [ ] First-launch onboarding screen (Create New Folder / Choose Existing)
- [ ] Git repo discovery: scan root folder for `.git` subdirectories
- [ ] Project dashboard: display cards with name, last commit date, branch, dirty count
- [ ] TeX Live detection: check `latexmk` in PATH, show warning banner if missing
- [ ] Persist projects folder path in app config (`electron-store`)

**Milestone:** App opens, shows a real list of local git repos as project cards.

---

### Phase 2 — File Explorer & Editor
**Goal:** Open a project and edit `.tex` files.

- [ ] Three-panel layout: left sidebar (file explorer) | center (editor) | right (PDF placeholder)
- [ ] File explorer: recursive directory tree, file open on click
- [ ] CodeMirror 6 integration with `lezer-latex` grammar
- [ ] Syntax highlighting for LaTeX
- [ ] File save (`Cmd+S`)
- [ ] Tab bar for open files
- [ ] Left rail icon tabs (Files, Git, placeholder for Settings)

**Milestone:** User can open a project, browse files, and edit `.tex` files with full LaTeX syntax highlighting.

---

### Phase 3 — Compilation & PDF Preview
**Goal:** Compile a project and display the PDF in-app.

- [ ] Shell out to `latexmk` with correct flags (`-pdf -synctex=1 -interaction=nonstopmode`)
- [ ] Root document auto-detection (`\documentclass` search)
- [ ] Per-project `.underleaf` config file (root document override, engine, bib tool)
- [ ] Recompile button in toolbar
- [ ] PDF.js integration in right panel
- [ ] Compilation log parsing: extract errors and warnings with file/line references
- [ ] Error panel: parsed view (default) + raw log tab
- [ ] Clickable error entries jump to file + line in editor
- [ ] SyncTeX: editor click → PDF scroll, PDF click → editor scroll
- [ ] Configurable compilation trigger (Manual / On Save / Auto) in global settings

**Milestone:** User can compile a multi-file LaTeX project and see the PDF in-app with working SyncTeX and error reporting.

---

### Phase 4 — Git Integration
**Goal:** Full git workflow inside the app.

- [ ] Git sidebar tab: staged / unstaged file lists using `simple-git`
- [ ] Stage / unstage individual files
- [ ] Commit message field + Commit button
- [ ] Push / Fetch / Pull buttons
- [ ] Auth failure detection: parse `stderr`, surface in-app guidance
- [ ] "Connect to Remote" flow: add remote URL, fetch, detect blank init commit, offer force push
- [ ] Conflict detection: identify conflicted files after fetch/pull
- [ ] Conflict highlighting: CodeMirror decorations on `<<<<<<<` / `=======` / `>>>>>>>` regions
- [ ] Inline Accept Ours / Accept Theirs buttons per conflict hunk
- [ ] New Project: templates (Article, Beamer, Thesis) with `git init`
- [ ] Clone Repository: paste URL, `git clone` into projects folder

**Milestone:** User can stage selectively, commit with a message, push/pull, and resolve merge conflicts — all without leaving the app.

---

### Phase 5 — Settings, Polish & Multiple Windows
**Goal:** Full settings system and production-quality UX.

- [ ] Global preferences window (`Cmd+,`): projects folder, engine, compilation trigger, TeX Live version display
- [ ] Per-project settings panel (gear icon in toolbar)
- [ ] Multiple Electron windows: each project opens independently
- [ ] Window management: Cmd+` cycles windows, dashboard persists as its own window
- [ ] LaTeX autocomplete: commands, `\cite{}` from `.bib`, `\ref{}` from labels
- [ ] Spell check (configurable, off by default)
- [ ] Image preview in file explorer
- [ ] Keyboard shortcuts matching Overleaf (compile, navigate errors, toggle panels)
- [ ] Dark mode support (follows system preference)

**Milestone:** App is feature-complete and feels polished enough for daily use.

---

### Phase 6 — Distribution & Release
**Goal:** Ship a signed, auto-updating app via GitHub Releases.

- [ ] Apple code signing setup
- [ ] macOS notarization via `electron-notarize`
- [ ] `electron-updater` integration (auto-update from GitHub Releases)
- [ ] DMG installer build via `electron-builder`
- [ ] GitHub Actions CI: build + sign + notarize + publish on tag push
- [ ] Landing page / README with install instructions
- [ ] Homebrew cask (optional, post-launch)

**Milestone:** A signed DMG is downloadable from GitHub Releases and auto-updates silently.

---

## Future Milestones (Post-v1)

- Windows and Linux builds
- Overleaf comments and review (pending official API availability)
- Homebrew cask
- Overleaf-to-GitHub sync wizard (help users set up their remote)
