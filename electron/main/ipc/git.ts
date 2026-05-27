import { ipcMain } from 'electron'
import * as git from '../services/git'
import type { CommitOptions, ConflictResolution } from '@shared/types'

export function registerGitIPC(): void {
  ipcMain.handle('git:status', (_, projectPath: string) => git.getStatus(projectPath))
  ipcMain.handle('git:stage', (_, projectPath: string, filePath: string) => git.stageFile(projectPath, filePath))
  ipcMain.handle('git:unstage', (_, projectPath: string, filePath: string) => git.unstageFile(projectPath, filePath))
  ipcMain.handle('git:commit', (_, projectPath: string, message: string, opts?: CommitOptions) =>
    git.commit(projectPath, message, opts))

  ipcMain.handle('git:push', (_, projectPath: string) => git.push(projectPath))
  ipcMain.handle('git:pull', (_, projectPath: string) => git.pull(projectPath))
  ipcMain.handle('git:fetch', (_, projectPath: string) => git.fetch(projectPath))
  ipcMain.handle('git:resetToRemote', (_, projectPath: string) => git.resetToRemote(projectPath))
  ipcMain.handle('git:addRemote', (_, projectPath: string, url: string) => git.addRemote(projectPath, url))
  ipcMain.handle('git:forcePush', (_, projectPath: string) => git.forcePush(projectPath))

  ipcMain.handle('git:log', (_, projectPath: string, maxCount?: number) => git.log(projectPath, maxCount))
  ipcMain.handle('git:diff', (_, projectPath: string, filePath: string, staged: boolean) =>
    git.diff(projectPath, filePath, staged))

  ipcMain.handle('git:resolveConflict', (_, projectPath: string, filePath: string, resolution: ConflictResolution) =>
    git.resolveConflict(projectPath, filePath, resolution))
}
