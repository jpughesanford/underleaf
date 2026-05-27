import { execSync } from 'child_process'
import {
  existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync,
} from 'fs'
import { basename, dirname, join } from 'path'
import type { ProjectInfo, ProjectTemplate } from '@shared/types'

// ─── Project discovery ────────────────────────────────────────────────────

function execAt(cwd: string, cmd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return ''
  }
}

function getGitInfo(repoPath: string): Omit<ProjectInfo, 'id' | 'name' | 'path'> {
  const branch = execAt(repoPath, 'git rev-parse --abbrev-ref HEAD') || 'main'
  const lastCommit = execAt(repoPath, 'git log -1 --format=%s') || null
  const lastCommitDate = execAt(repoPath, 'git log -1 --format=%ci') || null
  const dirtyStr = execAt(repoPath, 'git status --porcelain')
  const dirtyCount = dirtyStr ? dirtyStr.split('\n').filter(Boolean).length : 0
  const remoteUrl = execAt(repoPath, 'git remote get-url origin') || null
  const hasRemote = !!remoteUrl
  const hasConflicts = dirtyStr.split('\n').some(l => /^(UU|AA|DD|AU|UA|DU|UD)/.test(l))

  let aheadBy = 0, behindBy = 0, syncStatusKnown = false
  if (hasRemote) {
    const aheadStr = execAt(repoPath, 'git rev-list --count @{u}..HEAD')
    const behindStr = execAt(repoPath, 'git rev-list --count HEAD..@{u}')
    if (aheadStr !== '' && behindStr !== '') {
      aheadBy = parseInt(aheadStr) || 0
      behindBy = parseInt(behindStr) || 0
      syncStatusKnown = true
    }
  }

  return { branch, lastCommit, lastCommitDate, dirtyCount, remoteUrl, hasRemote, aheadBy, behindBy, hasConflicts, syncStatusKnown }
}

function deriveName(repoPath: string, remoteUrl: string | null): string {
  const dirName = repoPath.split('/').pop() || repoPath
  if (remoteUrl) {
    const parts = remoteUrl.replace(/\.git$/, '').split('/')
    const segment = parts[parts.length - 1]
    // Overleaf git bridge IDs are hex strings — not human-readable, fall back to dirname
    const isOverleafId = /^[0-9a-f]{20,}$/i.test(segment)
    if (segment && !isOverleafId) return segment
  }
  return dirName
}

/** Scan a root folder for git repositories; returns one ProjectInfo per repo. */
export function scanProjects(rootPath: string): ProjectInfo[] {
  if (!existsSync(rootPath)) return []

  const projects: ProjectInfo[] = []
  for (const entry of readdirSync(rootPath)) {
    const fullPath = join(rootPath, entry)
    try {
      if (!statSync(fullPath).isDirectory()) continue
      if (!existsSync(join(fullPath, '.git'))) continue

      const gitInfo = getGitInfo(fullPath)
      projects.push({
        id: fullPath,
        name: deriveName(fullPath, gitInfo.remoteUrl),
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

// ─── Templates ────────────────────────────────────────────────────────────

const TEMPLATE_FILES: Record<ProjectTemplate, Record<string, string>> = {
  article: {
    'main.tex': '\\documentclass{article}\n\\title{%NAME%}\n\\author{Author}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\n\\section{Introduction}\n\n\\end{document}\n',
    '.gitignore': '.DS_Store\n.underleaf\n.underleaf-build/\n*.aux\n*.log\n*.out\n*.synctex.gz\n*.fls\n*.fdb_latexmk\n',
  },
  beamer: {
    'main.tex': '\\documentclass{beamer}\n\\title{%NAME%}\n\\author{Author}\n\\date{\\today}\n\n\\begin{document}\n\\begin{frame}\n\\titlepage\n\\end{frame}\n\n\\begin{frame}{Introduction}\n\n\\end{frame}\n\n\\end{document}\n',
    '.gitignore': '.DS_Store\n.underleaf\n.underleaf-build/\n*.aux\n*.log\n*.out\n*.synctex.gz\n*.fls\n*.fdb_latexmk\n*.nav\n*.snm\n*.toc\n',
  },
  thesis: {
    'main.tex': '\\documentclass[12pt]{report}\n\\title{%NAME%}\n\\author{Author}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\\tableofcontents\n\n\\chapter{Introduction}\n\n\\end{document}\n',
    'chapters/introduction.tex': '\\chapter{Introduction}\n\n',
    '.gitignore': '.DS_Store\n.underleaf\n.underleaf-build/\n*.aux\n*.log\n*.out\n*.synctex.gz\n*.fls\n*.fdb_latexmk\n*.toc\n*.lof\n*.lot\n',
  },
}

// ─── Project lifecycle ────────────────────────────────────────────────────

/** Sanitize a project name so it can't escape the root directory. */
function sanitizeName(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[/\\]/g, '-').replace(/^\.+/, '').trim()
  return cleaned || fallback
}

/** Create a new project from a template; initializes a git repo with one commit. */
export function createProject(opts: { root: string; name: string; template: ProjectTemplate }): string {
  const { root, name, template } = opts
  const projectPath = join(root, name)
  if (existsSync(projectPath)) throw new Error(`Folder "${name}" already exists`)

  mkdirSync(projectPath, { recursive: true })

  const files = TEMPLATE_FILES[template] ?? TEMPLATE_FILES.article
  for (const [filename, content] of Object.entries(files)) {
    const filePath = join(projectPath, filename)
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, content.replace(/%NAME%/g, name), 'utf8')
  }

  execSync('git init', { cwd: projectPath })
  execSync('git add -A', { cwd: projectPath })
  execSync('git commit -m "Initial commit"', { cwd: projectPath })

  return projectPath
}

/** Clone a git remote into the projects root. URL is passed through to git unchanged. */
export function cloneProject(opts: { root: string; url: string; name?: string }): string {
  const { root, url } = opts
  const fallback = url.replace(/\.git$/, '').split('/').pop() || 'project'
  const name = sanitizeName(opts.name ?? '', fallback)
  const dest = join(root, name)

  if (existsSync(dest)) throw new Error(`Folder "${name}" already exists`)

  execSync(`git clone "${url}" "${dest}"`, { encoding: 'utf8' })
  return dest
}

/** Rename a project's enclosing directory. Returns the new absolute path. */
export function renameProject(opts: { oldPath: string; newName: string }): string {
  const { oldPath, newName } = opts
  if (!existsSync(oldPath)) throw new Error('Project no longer exists')

  const sanitized = newName.replace(/[/\\]/g, '-').replace(/^\.+/, '').trim()
  if (!sanitized) throw new Error('Name is required')
  if (sanitized === basename(oldPath)) return oldPath

  const newPath = join(dirname(oldPath), sanitized)
  if (existsSync(newPath)) throw new Error(`Folder "${sanitized}" already exists`)

  renameSync(oldPath, newPath)
  return newPath
}

/** Delete a project directory tree. Caller is responsible for confirmation. */
export function deleteProject(projectPath: string): void {
  rmSync(projectPath, { recursive: true, force: true })
}

/** Create a folder if missing. Used by the onboarding "create new projects root" flow. */
export function ensureFolder(folderPath: string): void {
  if (!existsSync(folderPath)) mkdirSync(folderPath, { recursive: true })
}
