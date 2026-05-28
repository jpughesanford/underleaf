import { ipcMain, BrowserWindow } from 'electron'
import type Store from 'electron-store'
import * as compile from '../services/compile'
import { resolveSynctexPath, synctexForward, synctexInverse } from '../services/synctex'
import { resolveLatexmkPath } from '../services/tex-live'
import type { CompileConfig, CompileOptions } from '@shared/types'

// Active compiles, keyed by project path. Lives at the IPC layer because
// it's tied to renderer-initiated lifecycle (compile:stop), not core logic.
const activeCompiles = new Map<string, AbortController>()

export function registerCompileIPC(store: Store): void {
  ipcMain.handle('compile:run', async (event, projectPath: string, opts?: CompileOptions) => {
    const settings = store.get('settings') as { defaultEngine?: string } | undefined
    const latexmkPath = resolveLatexmkPath(store.get('latexmkPath') as string | undefined) ?? 'latexmk'
    const win = BrowserWindow.fromWebContents(event.sender)

    // Cancel any in-flight compile for this project before starting a new one.
    activeCompiles.get(projectPath)?.abort()
    const controller = new AbortController()
    activeCompiles.set(projectPath, controller)

    try {
      return await compile.runCompile({
        projectPath,
        file: opts?.file,
        engine: settings?.defaultEngine,
        latexmkPath,
        onProgress: (chunk) => win?.webContents.send('compile:progress', chunk),
        signal: controller.signal,
      })
    } finally {
      if (activeCompiles.get(projectPath) === controller) {
        activeCompiles.delete(projectPath)
      }
    }
  })

  ipcMain.handle('compile:stop', (_, projectPath: string) => {
    activeCompiles.get(projectPath)?.abort()
    activeCompiles.delete(projectPath)
  })

  ipcMain.handle('compile:getPdfPath', (_, projectPath: string) => compile.getPdfPath(projectPath))
  ipcMain.handle('compile:readPdf', (_, pdfPath: string) => compile.readPdf(pdfPath))
  ipcMain.handle('compile:detectMainDoc', (_, projectPath: string) => compile.detectMainDoc(projectPath))
  ipcMain.handle('compile:getConfig', (_, projectPath: string) => compile.readConfig(projectPath))
  ipcMain.handle('compile:setConfig', (_, projectPath: string, config: CompileConfig) =>
    compile.writeConfig(projectPath, config))

  // ── synctex ───────────────────────────────────────────────────────────────
  const synctexPathFor = () => {
    const latexmkPath = resolveLatexmkPath(store.get('latexmkPath') as string | undefined) ?? 'latexmk'
    return resolveSynctexPath(latexmkPath)
  }

  ipcMain.handle('synctex:forward', (_, projectPath: string, args: { file: string; line: number; column: number }) =>
    synctexForward({ projectPath, synctexPath: synctexPathFor(), ...args }))

  ipcMain.handle('synctex:inverse', (_, projectPath: string, args: { page: number; x: number; y: number }) =>
    synctexInverse({ projectPath, synctexPath: synctexPathFor(), ...args }))
}
