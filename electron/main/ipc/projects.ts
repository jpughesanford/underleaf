import { ipcMain } from 'electron'
import { readdirSync, statSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import type Store from 'electron-store'

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
}

function getGitInfo(repoPath: string): Omit<ProjectInfo, 'id' | 'name' | 'path'> {
  const run = (cmd: string) => {
    try {
      return execSync(cmd, { cwd: repoPath, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
    } catch {
      return ''
    }
  }

  const branch = run('git rev-parse --abbrev-ref HEAD') || 'main'
  const lastCommit = run('git log -1 --format=%s') || null
  const lastCommitDate = run('git log -1 --format=%ci') || null
  const dirtyStr = run('git status --porcelain')
  const dirtyCount = dirtyStr ? dirtyStr.split('\n').filter(Boolean).length : 0
  const remoteUrl = run('git remote get-url origin') || null
  const hasRemote = !!remoteUrl

  return { branch, lastCommit, lastCommitDate, dirtyCount, remoteUrl, hasRemote }
}

function deriveName(repoPath: string, remoteUrl: string | null): string {
  const dirName = repoPath.split('/').pop() || repoPath
  if (remoteUrl) {
    const parts = remoteUrl.replace(/\.git$/, '').split('/')
    const segment = parts[parts.length - 1]
    // Overleaf git bridge IDs are 24-char hex strings — not human-readable
    const isOverleafId = /^[0-9a-f]{20,}$/i.test(segment)
    if (segment && !isOverleafId) return segment
  }
  return dirName
}

function scanProjects(rootPath: string): ProjectInfo[] {
  if (!existsSync(rootPath)) return []

  const entries = readdirSync(rootPath)
  const projects: ProjectInfo[] = []

  for (const entry of entries) {
    const fullPath = join(rootPath, entry)
    try {
      const stat = statSync(fullPath)
      if (!stat.isDirectory()) continue
      const gitPath = join(fullPath, '.git')
      if (!existsSync(gitPath)) continue

      const gitInfo = getGitInfo(fullPath)
      const name = deriveName(fullPath, gitInfo.remoteUrl)

      projects.push({
        id: fullPath,
        name,
        path: fullPath,
        ...gitInfo,
      })
    } catch {
      // skip unreadable dirs
    }
  }

  return projects.sort((a, b) => {
    if (a.lastCommitDate && b.lastCommitDate) {
      return new Date(b.lastCommitDate).getTime() - new Date(a.lastCommitDate).getTime()
    }
    return a.name.localeCompare(b.name)
  })
}

export function registerProjectIPC(store: Store): void {
  ipcMain.handle('projects:scan', () => {
    const root = store.get('projectsRoot') as string | null
    if (!root) return []
    return scanProjects(root)
  })

  ipcMain.handle('projects:setRoot', (_, rootPath: string) => {
    store.set('projectsRoot', rootPath)
  })

  ipcMain.handle('projects:getRoot', () => {
    return store.get('projectsRoot')
  })

  ipcMain.handle('projects:createFolder', async (_, folderPath: string) => {
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true })
    }
    store.set('projectsRoot', folderPath)
    return true
  })

  ipcMain.handle('projects:checkLatexmk', () => {
    try {
      execSync('which latexmk', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('projects:newProject', async (_, opts: { root: string; name: string; template: string }) => {
    const { root, name, template } = opts
    const projectPath = join(root, name)

    if (existsSync(projectPath)) {
      throw new Error(`Folder "${name}" already exists`)
    }

    mkdirSync(projectPath, { recursive: true })

    // Write template files
    const { writeFileSync } = await import('fs')
    const templates: Record<string, Record<string, string>> = {
      article: {
        'main.tex': `\\documentclass{article}\n\\title{${name}}\n\\author{Author}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\n\\section{Introduction}\n\n\\end{document}\n`,
        '.gitignore': '*.aux\n*.log\n*.out\n*.pdf\n*.synctex.gz\n*.fls\n*.fdb_latexmk\n',
      },
      beamer: {
        'main.tex': `\\documentclass{beamer}\n\\title{${name}}\n\\author{Author}\n\\date{\\today}\n\n\\begin{document}\n\\begin{frame}\n\\titlepage\n\\end{frame}\n\n\\begin{frame}{Introduction}\n\n\\end{frame}\n\n\\end{document}\n`,
        '.gitignore': '*.aux\n*.log\n*.out\n*.pdf\n*.synctex.gz\n*.fls\n*.fdb_latexmk\n*.nav\n*.snm\n*.toc\n',
      },
      thesis: {
        'main.tex': `\\documentclass[12pt]{report}\n\\title{${name}}\n\\author{Author}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\\tableofcontents\n\n\\chapter{Introduction}\n\n\\end{document}\n`,
        'chapters/introduction.tex': `\\chapter{Introduction}\n\n`,
        '.gitignore': '*.aux\n*.log\n*.out\n*.pdf\n*.synctex.gz\n*.fls\n*.fdb_latexmk\n*.toc\n*.lof\n*.lot\n',
      },
    }

    const files = templates[template] || templates.article
    for (const [filename, content] of Object.entries(files)) {
      const filePath = join(projectPath, filename)
      const dir = filePath.split('/').slice(0, -1).join('/')
      mkdirSync(dir, { recursive: true })
      writeFileSync(filePath, content, 'utf8')
    }

    execSync('git init', { cwd: projectPath })
    execSync('git add -A', { cwd: projectPath })
    execSync('git commit -m "Initial commit"', { cwd: projectPath })

    return projectPath
  })

  ipcMain.handle('projects:clone', async (_, opts: { root: string; url: string }) => {
    const { root, url } = opts
    const name = url.replace(/\.git$/, '').split('/').pop() || 'project'
    const dest = join(root, name)

    execSync(`git clone "${url}" "${dest}"`, { encoding: 'utf8' })
    return dest
  })
}
