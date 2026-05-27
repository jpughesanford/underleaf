import { ipcMain, BrowserWindow, dialog } from 'electron'
import { basename } from 'path'
import type Store from 'electron-store'
import * as projects from '../services/projects'
import { resolveLatexmkPath } from '../services/tex-live'
import type { ProjectTemplate } from '@shared/types'

export function registerProjectIPC(store: Store): void {
  // ── Discovery ──────────────────────────────────────────────────────────
  ipcMain.handle('projects:scan', () => {
    const root = store.get('projectsRoot') as string | null
    return root ? projects.scanProjects(root) : []
  })

  // ── Projects root path (persisted in store) ────────────────────────────
  ipcMain.handle('projects:getRoot', () => store.get('projectsRoot'))
  ipcMain.handle('projects:setRoot', (_, rootPath: string) => { store.set('projectsRoot', rootPath) })
  ipcMain.handle('projects:createFolder', (_, folderPath: string) => {
    projects.ensureFolder(folderPath)
    store.set('projectsRoot', folderPath)
    return true
  })

  // ── TeX Live ───────────────────────────────────────────────────────────
  ipcMain.handle('projects:checkLatexmk', () => {
    return resolveLatexmkPath(store.get('latexmkPath') as string | undefined) !== null
  })
  ipcMain.handle('projects:getLatexmkPath', () => store.get('latexmkPath') ?? null)
  ipcMain.handle('projects:setLatexmkPath', (_, path: string) => { store.set('latexmkPath', path) })

  // ── Project lifecycle ──────────────────────────────────────────────────
  ipcMain.handle('projects:newProject',
    (_, opts: { root: string; name: string; template: ProjectTemplate }) => projects.createProject(opts))
  ipcMain.handle('projects:clone',
    (_, opts: { root: string; url: string; name?: string }) => projects.cloneProject(opts))
  ipcMain.handle('projects:rename',
    (_, opts: { oldPath: string; newName: string }) => projects.renameProject(opts))

  // Destructive — keep the confirmation dialog at the IPC boundary so the
  // service doesn't need to know about Electron.
  ipcMain.handle('projects:delete', async (_, projectPath: string): Promise<boolean> => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return false
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      message: `Delete "${basename(projectPath)}"?`,
      detail: `This will permanently delete the folder at:\n${projectPath}\n\nThis cannot be undone.`,
      buttons: ['Delete', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    })
    if (response !== 0) return false
    projects.deleteProject(projectPath)
    return true
  })
}
