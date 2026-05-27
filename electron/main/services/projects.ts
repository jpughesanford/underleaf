import { execSync } from 'child_process'
import {
  existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync,
} from 'fs'
import { basename, dirname, join } from 'path'
import simpleGit, { type SimpleGit } from 'simple-git'
import type { ProjectInfo, ProjectTemplate } from '@shared/types'

// ─── Project discovery ────────────────────────────────────────────────────

// Run a git command and return stdout, or '' on failure. simple-git's API
// doesn't return strings directly, so wrap each call individually.
async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p } catch { return fallback }
}

async function getGitInfo(repoPath: string): Promise<Omit<ProjectInfo, 'id' | 'name' | 'path'>> {
  const git: SimpleGit = simpleGit(repoPath)

  // Probe the cheap, always-safe metadata in parallel.
  const [branchRaw, lastCommit, lastCommitDate, status, remoteRaw] = await Promise.all([
    safe(git.revparse(['--abbrev-ref', 'HEAD']), 'main'),
    safe(git.raw(['log', '-1', '--format=%s']).then(s => s.trim() || null), null),
    safe(git.raw(['log', '-1', '--format=%ci']).then(s => s.trim() || null), null),
    safe(git.status(), null),
    safe(git.raw(['remote', 'get-url', 'origin']).then(s => s.trim() || null), null),
  ])

  const branch = branchRaw.trim() || 'main'
  const remoteUrl = remoteRaw
  const hasRemote = !!remoteUrl

  const dirtyCount = status?.files.length ?? 0
  const hasConflicts = (status?.conflicted.length ?? 0) > 0

  // Ahead/behind requires an upstream — fails if there isn't one set, so wrap.
  let aheadBy = 0, behindBy = 0, syncStatusKnown = false
  if (hasRemote) {
    const [aheadStr, behindStr] = await Promise.all([
      safe(git.raw(['rev-list', '--count', '@{u}..HEAD']), ''),
      safe(git.raw(['rev-list', '--count', 'HEAD..@{u}']), ''),
    ])
    if (aheadStr.trim() !== '' && behindStr.trim() !== '') {
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

/**
 * Scan a root folder for git repositories; returns one ProjectInfo per repo.
 *
 * Each repo's git probe runs in parallel — for a directory of N project clones,
 * total wallclock is roughly the slowest single probe, not N × probe time.
 */
export async function scanProjects(rootPath: string): Promise<ProjectInfo[]> {
  if (!existsSync(rootPath)) return []

  // Synchronous pre-filter: only paths that look like git repos make it to the
  // async git probe. statSync is cheap relative to spawning git.
  const candidates: string[] = []
  for (const entry of readdirSync(rootPath)) {
    const fullPath = join(rootPath, entry)
    try {
      if (!statSync(fullPath).isDirectory()) continue
      if (!existsSync(join(fullPath, '.git'))) continue
      candidates.push(fullPath)
    } catch {
      // skip unreadable
    }
  }

  const results = await Promise.all(
    candidates.map(async (fullPath): Promise<ProjectInfo | null> => {
      try {
        const gitInfo = await getGitInfo(fullPath)
        return {
          id: fullPath,
          name: deriveName(fullPath, gitInfo.remoteUrl),
          path: fullPath,
          ...gitInfo,
        }
      } catch {
        return null
      }
    }),
  )

  const projects = results.filter((p): p is ProjectInfo => p !== null)
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
