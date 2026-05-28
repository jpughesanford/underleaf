import simpleGit from 'simple-git'
import type {
  CommitOptions, ConflictResolution, FileStatus, GitAddRemoteResult,
  GitLogEntry, GitOpResult, GitPullResult, GitStatus,
} from '@shared/types'

// ─── Status filtering / parsing ──────────────────────────────────────────

// Hide app-managed paths from the git panel. Everything else (including
// .DS_Store) is left to the user's .gitignore.
function isHiddenFromPanel(filePath: string): boolean {
  return (
    filePath === '.underleaf' ||
    filePath.startsWith('.underleaf-build') ||
    filePath.startsWith('.underleaf/')
  )
}

interface RawStatusFile { path: string; index: string; working_dir: string }

// Exported for unit testing.
export function parseStatus(files: RawStatusFile[]): GitStatus {
  const staged: FileStatus[] = []
  const unstaged: FileStatus[] = []
  const conflicted: string[] = []

  for (const f of files) {
    if (isHiddenFromPanel(f.path)) continue

    const index = f.index.trim()
    const wd = f.working_dir.trim()

    if (index === 'U' || wd === 'U' || (index === 'A' && wd === 'A') || (index === 'D' && wd === 'D')) {
      conflicted.push(f.path)
      continue
    }

    if (index && index !== ' ' && index !== '?') {
      staged.push({ path: f.path, status: index })
    }
    if (wd && wd !== ' ' && wd !== '?') {
      unstaged.push({ path: f.path, status: wd })
    }
    if (index === '?' && wd === '?') {
      unstaged.push({ path: f.path, status: '?' })
    }
  }

  return { staged, unstaged, conflicted }
}

// ─── Common error wrapper ────────────────────────────────────────────────

function failResult<T extends GitOpResult>(e: unknown, extra: Partial<T> = {}): T {
  const error = e instanceof Error ? e.message : String(e)
  return { success: false, error, ...extra } as T
}

// ─── Status / staging ────────────────────────────────────────────────────

export async function getStatus(projectPath: string): Promise<GitStatus> {
  const status = await simpleGit(projectPath).status()
  return parseStatus(status.files as RawStatusFile[])
}

export async function stageFile(projectPath: string, filePath: string): Promise<void> {
  await simpleGit(projectPath).add(filePath)
}

export async function unstageFile(projectPath: string, filePath: string): Promise<void> {
  await simpleGit(projectPath).reset(['HEAD', filePath])
}

export async function commit(projectPath: string, message: string, opts?: CommitOptions): Promise<void> {
  const flags: string[] = []
  if (opts?.amend) flags.push('--amend')
  await simpleGit(projectPath).commit(message, flags)
}

// ─── Remote sync ─────────────────────────────────────────────────────────

export async function push(projectPath: string): Promise<GitOpResult> {
  try { await simpleGit(projectPath).push(); return { success: true } }
  catch (e) { return failResult(e) }
}

export async function pull(projectPath: string): Promise<GitPullResult> {
  try { await simpleGit(projectPath).pull(); return { success: true } }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const hasConflicts = msg.includes('CONFLICT') || msg.includes('conflict')
    return failResult<GitPullResult>(e, { hasConflicts })
  }
}

export async function fetch(projectPath: string): Promise<GitOpResult> {
  try { await simpleGit(projectPath).fetch(); return { success: true } }
  catch (e) { return failResult(e) }
}

export async function resetToRemote(projectPath: string): Promise<GitOpResult> {
  try {
    const git = simpleGit(projectPath)
    await git.fetch(['origin'])
    const branch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim()
    await git.raw(['reset', '--hard', `origin/${branch}`])
    return { success: true }
  } catch (e) {
    return failResult(e)
  }
}

export async function addRemote(projectPath: string, url: string): Promise<GitAddRemoteResult> {
  try {
    const git = simpleGit(projectPath)
    await git.addRemote('origin', url)
    await git.fetch()

    // Detect Overleaf's "empty init commit only" case so the caller can offer
    // a force-push to overwrite it. `git remote add` + fetch doesn't create a
    // local origin/HEAD, so ask the remote directly for its default branch:
    // ls-remote --symref prints a "ref: refs/heads/<branch>\tHEAD" line.
    const symref = await git.raw(['ls-remote', '--symref', 'origin', 'HEAD']).catch(() => '')
    const branch = symref.match(/^ref:\s+refs\/heads\/(\S+)\s+HEAD/m)?.[1] ?? 'main'
    const log = await git.raw(['log', `origin/${branch}`, '--oneline', '--max-count=2']).catch(() => '')
    const needsForcePush = log.trim().split('\n').filter(Boolean).length === 1

    return { success: true, needsForcePush }
  } catch (e) {
    return failResult(e)
  }
}

export async function forcePush(projectPath: string): Promise<GitOpResult> {
  try { await simpleGit(projectPath).push(['--force', 'origin', 'HEAD']); return { success: true } }
  catch (e) { return failResult(e) }
}

// ─── Inspection ──────────────────────────────────────────────────────────

export async function log(projectPath: string, maxCount = 20): Promise<GitLogEntry[]> {
  const result = await simpleGit(projectPath).log({ maxCount })
  return result.all as unknown as GitLogEntry[]
}

export async function diff(projectPath: string, filePath: string, staged: boolean): Promise<string> {
  const git = simpleGit(projectPath)
  return staged ? git.diff(['--cached', filePath]) : git.diff([filePath])
}

// ─── Conflicts ───────────────────────────────────────────────────────────

export async function resolveConflict(projectPath: string, filePath: string, resolution: ConflictResolution): Promise<void> {
  const git = simpleGit(projectPath)
  await git.raw(['checkout', `--${resolution}`, filePath])
  await git.add(filePath)
}
