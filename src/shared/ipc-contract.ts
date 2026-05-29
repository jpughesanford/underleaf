// Single source of truth for the IPC channels between main and renderer.
//
// Add a new channel here first, then implement it in electron/main/ipc/
// and expose it in electron/preload/index.ts. Both sides will fail to compile
// if their signatures drift from this contract.

import type {
  CommitOptions,
  CompileConfig,
  CompileOptions,
  CompileResult,
  ConflictResolution,
  FileNode,
  GitAddRemoteResult,
  GitLogEntry,
  GitOpResult,
  GitPullResult,
  GitStatus,
  OpenFileOptions,
  ProjectInfo,
  ProjectTemplate,
  SaveDialogChoice,
  SyncForwardResult,
  SyncInverseResult,
} from './types'

// Each entry: 'channel-name': (args) => Promise<return>.
// Use Parameters<IpcContract[K]> / ReturnType<IpcContract[K]> to derive types.
export interface IpcContract {
  // ── store ────────────────────────────────────────────────────────────────
  'store:get': (key: string) => Promise<unknown>
  'store:set': (key: string, value: unknown) => Promise<void>

  // ── dialog ──────────────────────────────────────────────────────────────
  'dialog:openFolder': () => Promise<string | null>
  'dialog:openFile': (opts: OpenFileOptions) => Promise<string | null>
  'dialog:showSave': (fileName: string) => Promise<SaveDialogChoice>

  // ── app (shell-out helpers) ─────────────────────────────────────────────
  'app:openExternal': (url: string) => Promise<void>
  'app:openPath': (filePath: string) => Promise<string>

  // ── projects ────────────────────────────────────────────────────────────
  'projects:scan': () => Promise<ProjectInfo[]>
  'projects:setRoot': (rootPath: string) => Promise<void>
  'projects:getRoot': () => Promise<string | null>
  'projects:createFolder': (folderPath: string) => Promise<boolean>
  'projects:checkLatexmk': () => Promise<boolean>
  'projects:setLatexmkPath': (path: string) => Promise<void>
  'projects:getLatexmkPath': () => Promise<string | null>
  'projects:newProject': (opts: { root: string; name: string; template: ProjectTemplate }) => Promise<string>
  'projects:clone': (opts: { root: string; url: string; name?: string }) => Promise<string>
  'projects:rename': (opts: { oldPath: string; newName: string }) => Promise<string>
  'projects:delete': (projectPath: string) => Promise<boolean>

  // ── files ───────────────────────────────────────────────────────────────
  'files:tree': (projectPath: string) => Promise<FileNode[]>
  'files:read': (filePath: string) => Promise<string | null>
  'files:write': (filePath: string, content: string) => Promise<void>
  'files:delete': (filePath: string) => Promise<void>
  'files:rename': (oldPath: string, newPath: string) => Promise<void>
  'files:mkdir': (dirPath: string) => Promise<void>
  'files:copy': (srcPath: string, destPath: string) => Promise<void>
  'files:showInFinder': (filePath: string) => Promise<void>
  'files:openInTerminal': (dirPath: string) => Promise<void>

  // ── git ─────────────────────────────────────────────────────────────────
  'git:status': (projectPath: string) => Promise<GitStatus>
  'git:stage': (projectPath: string, filePath: string) => Promise<void>
  'git:unstage': (projectPath: string, filePath: string) => Promise<void>
  'git:commit': (projectPath: string, message: string, opts?: CommitOptions) => Promise<void>
  'git:push': (projectPath: string) => Promise<GitOpResult>
  'git:pull': (projectPath: string) => Promise<GitPullResult>
  'git:fetch': (projectPath: string) => Promise<GitOpResult>
  'git:resetToRemote': (projectPath: string) => Promise<GitOpResult>
  'git:addRemote': (projectPath: string, url: string) => Promise<GitAddRemoteResult>
  'git:forcePush': (projectPath: string) => Promise<GitOpResult>
  /** True if the repo has a remote configured (false ⇒ local-only project). */
  'git:hasRemote': (projectPath: string) => Promise<boolean>
  /** Disconnect the project from its remote (removes origin). */
  'git:removeRemote': (projectPath: string) => Promise<GitOpResult>
  'git:log': (projectPath: string, maxCount?: number) => Promise<GitLogEntry[]>
  'git:diff': (projectPath: string, filePath: string, staged: boolean) => Promise<string>
  /** Contents of a file as currently staged (the index version), or null if it
      isn't in the index. Used to reveal collapsed context in a staged diff. */
  'git:showStaged': (projectPath: string, filePath: string) => Promise<string | null>
  'git:resolveConflict': (projectPath: string, filePath: string, resolution: ConflictResolution) => Promise<void>
  /** Discard all changes to a file back to HEAD (untracked files are removed). */
  'git:revertFile': (projectPath: string, filePath: string) => Promise<GitOpResult>

  // ── compile ─────────────────────────────────────────────────────────────
  'compile:run': (projectPath: string, opts?: CompileOptions) => Promise<CompileResult>
  'compile:stop': (projectPath: string) => Promise<void>
  'compile:getPdfPath': (projectPath: string) => Promise<string | null>
  'compile:readPdf': (pdfPath: string) => Promise<ArrayBuffer | null>
  'compile:detectMainDoc': (projectPath: string) => Promise<string | null>
  'compile:getConfig': (projectPath: string) => Promise<CompileConfig>
  'compile:setConfig': (projectPath: string, config: CompileConfig) => Promise<void>

  // ── synctex (editor ↔ PDF jump) ──────────────────────────────────────────
  /** Forward search: source position → PDF location. Null if synctex/data missing. */
  'synctex:forward': (projectPath: string, args: { file: string; line: number; column: number }) => Promise<SyncForwardResult | null>
  /** Inverse search: PDF location → source position. Null if synctex/data missing. */
  'synctex:inverse': (projectPath: string, args: { page: number; x: number; y: number }) => Promise<SyncInverseResult | null>

  // ── spellcheck ────────────────────────────────────────────────────────────
  /** Hunspell dictionary (aff+dic text) for the renderer's nspell instance. */
  'spellcheck:dictionary': (lang: string) => Promise<{ aff: string; dic: string }>
}

export type IpcChannel = keyof IpcContract
export type IpcArgs<K extends IpcChannel> = Parameters<IpcContract[K]>
export type IpcReturn<K extends IpcChannel> = ReturnType<IpcContract[K]>

// ── Event channels (main → renderer pushes) ────────────────────────────────
// These don't use ipcRenderer.invoke; they use ipcMain.send + ipcRenderer.on.
export interface IpcEvents {
  'compile:progress': (chunk: string) => void
  'menu:save': () => void
  'menu:openSettings': () => void
  'menu:viewEditor': () => void
  'menu:viewSplit': () => void
  'menu:viewPdf': () => void
}

export type IpcEventChannel = keyof IpcEvents
export type MenuAction = Extract<IpcEventChannel, `menu:${string}`>
