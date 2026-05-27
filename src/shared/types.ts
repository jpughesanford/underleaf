// Shared types — imported by both electron/ (main + preload) and src/renderer/.
// Single source of truth for any shape that crosses the IPC boundary.

// ─── Projects ─────────────────────────────────────────────────────────────
export interface ProjectInfo {
  id: string
  name: string
  path: string
  branch: string
  lastCommit: string | null
  lastCommitDate: string | null
  dirtyCount: number
  remoteUrl: string | null
  hasRemote: boolean
  aheadBy: number
  behindBy: number
  hasConflicts: boolean
  syncStatusKnown: boolean
}

export type ProjectTemplate = 'article' | 'beamer' | 'thesis'

// ─── Files ────────────────────────────────────────────────────────────────
export interface FileNode {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  children?: FileNode[]
  extension?: string
}

// ─── Git ──────────────────────────────────────────────────────────────────
export interface FileStatus {
  path: string
  status: string
}

export interface GitStatus {
  staged: FileStatus[]
  unstaged: FileStatus[]
  conflicted: string[]
}

export interface GitLogEntry {
  hash: string
  date: string
  message: string
  author_name: string
  author_email: string
}

export type ConflictResolution = 'ours' | 'theirs'

export interface CommitOptions {
  amend?: boolean
}

// Most git ops surface either success or a captured stderr string.
export interface GitOpResult {
  success: boolean
  error?: string
}

export interface GitPullResult extends GitOpResult {
  hasConflicts?: boolean
}

export interface GitAddRemoteResult extends GitOpResult {
  needsForcePush?: boolean
}

// ─── Compile ──────────────────────────────────────────────────────────────
export interface CompileError {
  type: 'error' | 'warning'
  file: string
  line: number | null
  message: string
}

export interface CompileResult {
  success: boolean
  errors: CompileError[]
  warnings: CompileError[]
  rawLog: string
  pdfPath?: string
}

export interface CompileOptions {
  file?: string
}

export interface CompileConfig {
  rootDocument?: string
  engine?: string
  bibtool?: 'bibtex' | 'biber'
}

// ─── Renderer-local state types that travel between components ────────────
// (Not IPC, but shared between routes and features.)
export interface OpenTab {
  path: string
  name: string
  content: string
  isDirty: boolean
  language?: string
}

export type SidebarTab = 'files' | 'git' | 'compile'
export type CompileTarget = 'root' | 'active'
export type ViewMode = 'editor' | 'split' | 'pdf'

// ─── Dialog ───────────────────────────────────────────────────────────────
export type SaveDialogChoice = 'save' | 'discard' | 'cancel'

export interface OpenFileOptions {
  title?: string
  filters?: { name: string; extensions: string[] }[]
}
