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
  try {
    // Force a merge (not rebase). A bare `git pull` on diverged branches aborts
    // with "Need to specify how to reconcile divergent branches" unless the user
    // has pull.rebase/pull.ff configured — so the conflict-resolution flow was
    // never reachable. --no-rebase still fast-forwards when it can; it only
    // merges when the branches diverge, producing the working-tree <<</>>>
    // markers + unmerged state the conflict view is built around.
    await simpleGit(projectPath).pull(undefined, undefined, ['--no-rebase'])
    return { success: true }
  } catch (e) {
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
    // Idempotent: if a prior attempt already added origin (e.g. a force-push that
    // then failed), update its URL instead of erroring with "remote already exists".
    const remotes = await git.getRemotes()
    if (remotes.some(r => r.name === 'origin')) {
      await git.raw(['remote', 'set-url', 'origin', url])
    } else {
      await git.addRemote('origin', url)
    }
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

// Despite the name, this overwrites the remote WITHOUT a force-push, because
// Overleaf rejects `--force` outright. It instead folds the remote's initial
// commit into local history with the "ours" merge strategy — our tree wins
// entirely, but the remote commit becomes a merged ancestor — so the push that
// follows is an ordinary fast-forward that Overleaf accepts.
export async function forcePush(projectPath: string): Promise<GitOpResult> {
  try {
    const git = simpleGit(projectPath)
    // Overleaf only accepts its default branch (`master`) and rejects anything
    // else ("Please use the master branch"). The app inits repos as `main`, so
    // align the local branch to the remote's default first.
    const symref = await git.raw(['ls-remote', '--symref', 'origin', 'HEAD']).catch(() => '')
    const remoteBranch = symref.match(/^ref:\s+refs\/heads\/(\S+)\s+HEAD/m)?.[1] ?? 'master'
    const localBranch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim()
    if (localBranch !== remoteBranch) {
      await git.raw(['branch', '-m', remoteBranch])
    }
    // Make the remote commit an ancestor of ours (keeping our content via `-s
    // ours`), so the push fast-forwards instead of needing --force. The branches
    // share no history, hence --allow-unrelated-histories.
    await git.fetch(['origin'])
    await git.raw(['merge', '-s', 'ours', '--allow-unrelated-histories', '--no-edit', `origin/${remoteBranch}`])
    await git.raw(['push', '-u', 'origin', remoteBranch])
    return { success: true }
  } catch (e) {
    return failResult(e)
  }
}

/** Disconnect the project from its remote (removes `origin`). Local history is
    untouched — the project just becomes local-only again. */
export async function removeRemote(projectPath: string): Promise<GitOpResult> {
  try { await simpleGit(projectPath).removeRemote('origin'); return { success: true } }
  catch (e) { return failResult(e) }
}

/** Whether the repo has any remote configured. Drives the Source Control panel's
    "Connect to Remote" affordance — false ⇒ a purely-local project. */
export async function hasRemote(projectPath: string): Promise<boolean> {
  try {
    const remotes = await simpleGit(projectPath).getRemotes()
    return remotes.length > 0
  } catch {
    return false
  }
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

/**
 * Read a file's staged (index) contents via `git show :<path>`. Returns null if
 * the path isn't in the index (e.g. unmerged or never staged), so callers can
 * fall back gracefully rather than treating it as an error.
 */
export async function showStaged(projectPath: string, filePath: string): Promise<string | null> {
  try {
    return await simpleGit(projectPath).show([`:${filePath}`])
  } catch {
    return null
  }
}

/**
 * Discard ALL changes to a file, restoring it to the last commit (HEAD) in both
 * the index and the working tree. An untracked/new file has no HEAD version, so
 * "reverting all changes" means removing it. Used by the diff view's
 * "Revert all changes" action.
 */
export async function revertFile(projectPath: string, filePath: string): Promise<GitOpResult> {
  try {
    const git = simpleGit(projectPath)
    const tracked = await git.raw(['cat-file', '-e', `HEAD:${filePath}`]).then(() => true).catch(() => false)
    if (tracked) {
      await git.raw(['checkout', 'HEAD', '--', filePath])
    } else {
      await git.raw(['clean', '-f', '--', filePath])
    }
    return { success: true }
  } catch (e) {
    return failResult(e)
  }
}

// ─── Conflicts ───────────────────────────────────────────────────────────

export async function resolveConflict(projectPath: string, filePath: string, resolution: ConflictResolution): Promise<void> {
  const git = simpleGit(projectPath)
  await git.raw(['checkout', `--${resolution}`, filePath])
  await git.add(filePath)
}
