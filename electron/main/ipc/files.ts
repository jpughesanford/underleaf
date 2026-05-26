import { ipcMain, shell } from 'electron'
import { execSync } from 'child_process'
import {
  readdirSync, statSync, readFileSync, writeFileSync,
  existsSync, mkdirSync, unlinkSync, renameSync, copyFileSync, rmSync
} from 'fs'
import { join, extname, relative, resolve } from 'path'

export interface FileNode {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  children?: FileNode[]
  extension?: string
}

// Always hidden — these would either dwarf the tree or are pure noise that no
// user ever wants to browse. Everything else (incl. dotfiles/dotfolders like
// .underleaf, .vscode, .github) flows through and is gated by the renderer's
// "show hidden" toggle in FileExplorer.
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
          name: entry,
          path: fullPath,
          relativePath: rel,
          isDirectory: true,
          children: buildTree(fullPath, rootPath),
        })
      } else {
        nodes.push({
          name: entry,
          path: fullPath,
          relativePath: rel,
          isDirectory: false,
          extension: extname(entry).slice(1),
        })
      }
    } catch {
      // skip
    }
  }
  return nodes
}

export function registerFileIPC(): void {
  ipcMain.handle('files:tree', (_, projectPath: string) => {
    if (!existsSync(projectPath)) return []
    return buildTree(projectPath, projectPath)
  })

  ipcMain.handle('files:read', (_, filePath: string) => {
    const normalized = resolve(filePath)
    if (!existsSync(normalized)) return null
    return readFileSync(normalized, 'utf8')
  })

  ipcMain.handle('files:write', (_, filePath: string, content: string) => {
    writeFileSync(filePath, content, 'utf8')
  })

  ipcMain.handle('files:delete', (_, filePath: string) => {
    const stat = statSync(filePath)
    if (stat.isDirectory()) {
      rmSync(filePath, { recursive: true })
    } else {
      unlinkSync(filePath)
    }
  })

  ipcMain.handle('files:rename', (_, oldPath: string, newPath: string) => {
    renameSync(oldPath, newPath)
  })

  ipcMain.handle('files:mkdir', (_, dirPath: string) => {
    mkdirSync(dirPath, { recursive: true })
  })

  ipcMain.handle('files:copy', (_, srcPath: string, destPath: string) => {
    copyFileSync(srcPath, destPath)
  })

  ipcMain.handle('files:showInFinder', (_, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('files:openInTerminal', (_, dirPath: string) => {
    execSync(`open -a Terminal ${JSON.stringify(dirPath)}`)
  })
}
