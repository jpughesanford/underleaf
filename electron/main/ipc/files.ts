import { ipcMain } from 'electron'
import {
  readdirSync, statSync, readFileSync, writeFileSync,
  existsSync, mkdirSync, unlinkSync, renameSync
} from 'fs'
import { join, extname, relative } from 'path'

export interface FileNode {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  children?: FileNode[]
  extension?: string
}

const IGNORED = new Set(['.git', 'node_modules', '.underleaf'])

function buildTree(dirPath: string, rootPath: string): FileNode[] {
  const entries = readdirSync(dirPath).sort((a, b) => {
    const aIsDir = statSync(join(dirPath, a)).isDirectory()
    const bIsDir = statSync(join(dirPath, b)).isDirectory()
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
    return a.localeCompare(b)
  })

  const nodes: FileNode[] = []
  for (const entry of entries) {
    if (IGNORED.has(entry) || entry.startsWith('.')) continue
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
    if (!existsSync(filePath)) throw new Error('File not found: ' + filePath)
    return readFileSync(filePath, 'utf8')
  })

  ipcMain.handle('files:write', (_, filePath: string, content: string) => {
    writeFileSync(filePath, content, 'utf8')
  })

  ipcMain.handle('files:delete', (_, filePath: string) => {
    unlinkSync(filePath)
  })

  ipcMain.handle('files:rename', (_, oldPath: string, newPath: string) => {
    renameSync(oldPath, newPath)
  })

  ipcMain.handle('files:mkdir', (_, dirPath: string) => {
    mkdirSync(dirPath, { recursive: true })
  })
}
