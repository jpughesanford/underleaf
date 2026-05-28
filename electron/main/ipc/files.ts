import { ipcMain, shell } from 'electron'
import { execFileSync } from 'child_process'
import type Store from 'electron-store'
import * as files from '../services/files'

export function registerFileIPC(store: Store): void {
  // Confine every renderer-supplied path to the configured projects root before
  // touching the filesystem. The renderer is trusted today, but these handlers
  // are a destructive surface (recursive delete, overwrite) and the app renders
  // arbitrary cloned-repo content — so this is defense in depth.
  const root = (): string | null => (store.get('projectsRoot') as string | null) ?? null
  const guard = (...paths: string[]): void => {
    for (const p of paths) files.assertWithinRoot(root(), p)
  }

  ipcMain.handle('files:tree', (_, projectPath: string) => files.listTree(projectPath))
  ipcMain.handle('files:read', (_, filePath: string) => { guard(filePath); return files.readFile(filePath) })
  ipcMain.handle('files:write', (_, filePath: string, content: string) => { guard(filePath); files.writeFile(filePath, content) })
  ipcMain.handle('files:delete', (_, filePath: string) => { guard(filePath); files.deleteEntry(filePath) })
  ipcMain.handle('files:rename', (_, oldPath: string, newPath: string) => { guard(oldPath, newPath); files.renameEntry(oldPath, newPath) })
  ipcMain.handle('files:mkdir', (_, dirPath: string) => { guard(dirPath); files.makeDir(dirPath) })
  ipcMain.handle('files:copy', (_, srcPath: string, destPath: string) => { guard(srcPath, destPath); files.copyFile(srcPath, destPath) })

  // OS shell-outs — these stay in the IPC layer since they're inherently Electron.
  ipcMain.handle('files:showInFinder', (_, filePath: string) => shell.showItemInFolder(filePath))
  ipcMain.handle('files:openInTerminal', (_, dirPath: string) => {
    guard(dirPath)
    execFileSync('open', ['-a', 'Terminal', dirPath])
  })
}
