# Underleaf

**Write LaTeX on your Mac, offline, with the feel of Overleaf.**

Underleaf is a free desktop app for macOS that lets you write and compile LaTeX documents locally — no internet connection, no subscription, no files leaving your computer. It looks and works like Overleaf, but everything runs on your machine.


## What it does

- **Write LaTeX** with a clean, distraction-free editor that highlights syntax and autocompletes common commands
- **See your PDF instantly** — compile on save, automatically as you type, or manually whenever you're ready
- **Manage your projects** from a dashboard that shows all your LaTeX repos at a glance
- **Track changes with git** — stage files, write commit messages, push and pull to GitHub or Overleaf, and resolve merge conflicts, all without touching the terminal
- **Works with Overleaf** — clone your Overleaf project via git and keep editing it locally; push your changes back whenever you have a connection


## Installation

### Step 1 — Install TeX Live

Underleaf uses your Mac's local LaTeX installation to compile documents. If you don't have one yet, download **TeX Live** from:

[https://www.tug.org/texlive/](https://www.tug.org/texlive/)

This is a one-time install. It gives your Mac everything it needs to turn `.tex` files into PDFs. This file will be large, approximately 4-6 GBs. 

### Step 2 — Download Underleaf

> **Note:** Underleaf is under active development. See the [For developers](#for-developers) section below to build and run from source.

Available releases can be found on our [Releases page](https://github.com/jpughesanford/underleaf/releases). To install, download the `.dmg` or your desired release and launch it. For long term use, make sure the file is saved in you applications folder.

> **First launch note:** macOS may warn that Underleaf is from an unidentified developer. To open it anyway, right-click the app icon, choose **Open**, and confirm. You'll only need to do this once.

## Getting started

1. **Choose a projects folder** — on first launch, Underleaf asks you to pick a folder on your Mac where your LaTeX projects live (or where you'd like to keep them). This can be any folder.

2. **Create or clone a project** — click **+ New Project** to start from scratch, or **Clone Repository** to pull in an existing repo from GitHub or Overleaf.

3. **Open a project** — click any project card on the dashboard to open the editor.

4. **Write and compile** — edit your `.tex` files on the left, and the compiled PDF appears on the right. Use **Recompile** to rebuild, or set compilation to happen automatically on save.

5. **Commit and sync** — open the git panel from the left rail to stage your changes, write a commit message, and push to your remote.


## Using Underleaf with Overleaf

If you have an Overleaf project with git access enabled (requires an Overleaf account):

1. Copy the git URL from your Overleaf project's menu
2. In Underleaf, click **Clone Repository** and paste the URL
3. Edit locally, then push your changes back to Overleaf whenever you're online


## Tips

- **Set the main document** — right-click any `.tex` file in the file explorer and choose "Set as Main Document" to tell Underleaf which file to compile
- **Compile modes** — use the dropdown next to the Recompile button to switch between Manual, On Save, and Auto (compiles as you type)
- **Merge conflicts** — if a pull creates conflicts, Underleaf highlights them in the editor so you can resolve them without leaving the app


## For developers

Underleaf is built with Electron, React, TypeScript, and electron-vite. Contributions are welcome.

**Requirements:** Node.js 18+, TeX Live (for compilation)

```bash
npm install
npm run dev       # launch in development mode
npm run build     # package the app

npm run typecheck # tsc across main, preload, renderer, and shared projects
npm run lint      # eslint
npm run test      # vitest (unit tests for the pure service logic)
npm run check     # all three of the above — the pre-commit / CI gate
```

**Project layout**

```
electron/main/ipc/        # Thin IPC dispatchers
electron/main/services/   # Core logic (git, compile, projects, files) — no Electron deps, unit-tested
electron/preload/         # Namespaced window.api bridge, typed from the IPC contract
src/shared/               # Types + IPC contract shared by main and renderer
src/renderer/routes/      # Top-level destinations (onboarding, dashboard, editor)
src/renderer/features/    # Reusable feature modules (code-editor, pdf-viewer, git-panel, …)
src/renderer/ui/          # Headless UI primitives (Modal, ContextMenu, IconButton, …)
src/renderer/theme/       # Theme JSONs, provider, schema
tests/                    # Vitest unit tests for src/shared + electron/main/services
resources/                # App icons and static assets
```

The git integration uses `simple-git`, the editor is CodeMirror 6, and PDF rendering uses PDF.js. Build artifacts are written to `.underleaf-build/` inside each project folder (gitignored).
