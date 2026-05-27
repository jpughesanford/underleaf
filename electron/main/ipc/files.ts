import { ipcMain, shell } from 'electron'
import { execSync } from 'child_process'
import * as files from '../services/files'

export function registerFileIPC(): void {
  ipcMain.handle('files:tree', (_, projectPath: string) => files.listTree(projectPath))
  ipcMain.handle('files:read', (_, filePath: string) => files.readFile(filePath))
  ipcMain.handle('files:write', (_, filePath: string, content: string) => files.writeFile(filePath, content))
  ipcMain.handle('files:delete', (_, filePath: string) => files.deleteEntry(filePath))
  ipcMain.handle('files:rename', (_, oldPath: string, newPath: string) => files.renameEntry(oldPath, newPath))
  ipcMain.handle('files:mkdir', (_, dirPath: string) => files.makeDir(dirPath))
  ipcMain.handle('files:copy', (_, srcPath: string, destPath: string) => files.copyFile(srcPath, destPath))

  // OS shell-outs — these stay in the IPC layer since they're inherently Electron.
  ipcMain.handle('files:showInFinder', (_, filePath: string) => shell.showItemInFolder(filePath))
  ipcMain.handle('files:openInTerminal', (_, dirPath: string) => {
    execSync(`open -a Terminal ${JSON.stringify(dirPath)}`)
  })
}
