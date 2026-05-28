import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync,
  rmSync, statSync, unlinkSync, writeFileSync,
} from 'fs'
import { extname, join, relative, resolve, sep } from 'path'
import type { FileNode } from '@shared/types'

/**
 * Throw if `target` resolves outside `root`. A null root means onboarding
 * hasn't picked a projects folder yet — there's nothing to confine to, so the
 * check is skipped (no file operation is reachable in that state anyway).
 * Exported for unit testing.
 */
export function assertWithinRoot(root: string | null, target: string): void {
  if (!root) return
  const r = resolve(root)
  const t = resolve(target)
  if (t !== r && !t.startsWith(r + sep)) {
    throw new Error('Path is outside the projects folder')
  }
}

// Always hidden from the file tree — would either dwarf the view (node_modules)
// or are pure noise no user wants to browse (.git). Everything else, including
// dotfiles like .underleaf or .vscode, flows through and is gated by the
// renderer's "show hidden" toggle.
const IGNORED = new Set(['.git', 'node_modules'])

function buildTree(dirPath: string, rootPath: string): FileNode[] {
  const entries = readdirSync(dirPath).sort((a, b) => {
    const aIsDir = statSync(join(dirPath, a)).isDirectory()
    const bIsDir = statSync(join(dirPath, b)).isDirectory()
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
    return a.localeCompare(b)
  })

  const nodes: FileNode[] = []
  for (const entry of entries) {
    if (IGNORED.has(entry)) continue
    const fullPath = join(dirPath, entry)
    const rel = relative(rootPath, fullPath)
    try {
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        nodes.push({
          name: entry, path: fullPath, relativePath: rel, isDirectory: true,
          children: buildTree(fullPath, rootPath),
        })
      } else {
        nodes.push({
          name: entry, path: fullPath, relativePath: rel, isDirectory: false,
          extension: extname(entry).slice(1),
        })
      }
    } catch {
      // skip unreadable
    }
  }
  return nodes
}

/** Recursive file listing rooted at `projectPath`. Returns [] if the path doesn't exist. */
export function listTree(projectPath: string): FileNode[] {
  if (!existsSync(projectPath)) return []
  return buildTree(projectPath, projectPath)
}

/** Read a file's contents as UTF-8, or null if missing. */
export function readFile(filePath: string): string | null {
  const normalized = resolve(filePath)
  if (!existsSync(normalized)) return null
  return readFileSync(normalized, 'utf8')
}

export function writeFile(filePath: string, content: string): void {
  writeFileSync(filePath, content, 'utf8')
}

/** Delete a file or recursively delete a directory. */
export function deleteEntry(filePath: string): void {
  if (statSync(filePath).isDirectory()) {
    rmSync(filePath, { recursive: true })
  } else {
    unlinkSync(filePath)
  }
}

export function renameEntry(oldPath: string, newPath: string): void {
  renameSync(oldPath, newPath)
}

export function makeDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true })
}

export function copyFile(srcPath: string, destPath: string): void {
  copyFileSync(srcPath, destPath)
}
