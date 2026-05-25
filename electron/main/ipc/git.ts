import { ipcMain, BrowserWindow } from 'electron'
import simpleGit from 'simple-git'

export interface GitStatus {
  staged: FileStatus[]
  unstaged: FileStatus[]
  conflicted: string[]
}

export interface FileStatus {
  path: string
  status: string
}

// Hide only app-managed paths from the git panel. Everything else (including
// .DS_Store) is left to the user's .gitignore to control.
function isHiddenFromPanel(filePath: string): boolean {
  return (
    filePath === '.underleaf' ||
    filePath.startsWith('.underleaf-build') ||
    filePath.startsWith('.underleaf/')
  )
}

function parseStatus(files: { path: string; index: string; working_dir: string }[]): GitStatus {
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

export function registerGitIPC(): void {
  ipcMain.handle('git:status', async (_, projectPath: string): Promise<GitStatus> => {
    const git = simpleGit(projectPath)
    const status = await git.status()
    return parseStatus(status.files as { path: string; index: string; working_dir: string }[])
  })

  ipcMain.handle('git:stage', async (_, projectPath: string, filePath: string) => {
    const git = simpleGit(projectPath)
    await git.add(filePath)
  })

  ipcMain.handle('git:unstage', async (_, projectPath: string, filePath: string) => {
    const git = simpleGit(projectPath)
    await git.reset(['HEAD', filePath])
  })

  ipcMain.handle('git:commit', async (_, projectPath: string, message: string) => {
    const git = simpleGit(projectPath)
    await git.commit(message)
  })

  ipcMain.handle('git:push', async (_, projectPath: string): Promise<{ success: boolean; error?: string }> => {
    const git = simpleGit(projectPath)
    try {
      await git.push()
      return { success: true }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('git:pull', async (_, projectPath: string): Promise<{ success: boolean; error?: string; hasConflicts?: boolean }> => {
    const git = simpleGit(projectPath)
    try {
      await git.pull()
      return { success: true }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      const hasConflicts = msg.includes('CONFLICT') || msg.includes('conflict')
      return { success: false, error: msg, hasConflicts }
    }
  })

  ipcMain.handle('git:fetch', async (_, projectPath: string): Promise<{ success: boolean; error?: string }> => {
    const git = simpleGit(projectPath)
    try {
      await git.fetch()
      return { success: true }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('git:addRemote', async (_, projectPath: string, url: string): Promise<{ success: boolean; error?: string; needsForcePush?: boolean }> => {
    const git = simpleGit(projectPath)
    try {
      await git.addRemote('origin', url)
      await git.fetch()

      // Check if remote has only an init commit
      const log = await git.raw(['log', 'origin/main', '--oneline', '--max-count=2']).catch(() => '')
      const lines = log.trim().split('\n').filter(Boolean)
      const needsForcePush = lines.length === 1

      return { success: true, needsForcePush }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('git:forcePush', async (_, projectPath: string): Promise<{ success: boolean; error?: string }> => {
    const git = simpleGit(projectPath)
    try {
      await git.push(['--force', 'origin', 'HEAD'])
      return { success: true }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('git:log', async (_, projectPath: string, maxCount = 20) => {
    const git = simpleGit(projectPath)
    const log = await git.log({ maxCount })
    return log.all
  })

  ipcMain.handle('git:diff', async (_, projectPath: string, filePath: string, staged: boolean) => {
    const git = simpleGit(projectPath)
    if (staged) {
      return git.diff(['--cached', filePath])
    }
    return git.diff([filePath])
  })

  ipcMain.handle('git:resolveConflict', async (_, projectPath: string, filePath: string, resolution: 'ours' | 'theirs') => {
    const git = simpleGit(projectPath)
    if (resolution === 'ours') {
      await git.raw(['checkout', '--ours', filePath])
    } else {
      await git.raw(['checkout', '--theirs', filePath])
    }
    await git.add(filePath)
  })
}
