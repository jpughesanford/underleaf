import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { registerProjectIPC } from './ipc/projects'
import { registerFileIPC } from './ipc/files'
import { registerGitIPC } from './ipc/git'
import { registerCompileIPC } from './ipc/compile'

const store = new Store<{
  projectsRoot: string | null
  settings: {
    defaultEngine: string
    compileTrigger: string
  }
}>({
  defaults: {
    projectsRoot: null,
    settings: {
      defaultEngine: 'pdflatex',
      compileTrigger: 'manual',
    }
  }
})

export function getStore() { return store }

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a2332',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
    show: false,
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.underleaf.app')

  app.on('browser-window-created', (_, win) => {
    optimizer.watchWindowShortcuts(win)
  })

  registerProjectIPC(store)
  registerFileIPC()
  registerGitIPC()
  registerCompileIPC(store)

  // Store IPC
  ipcMain.handle('store:get', (_, key: string) => store.get(key))
  ipcMain.handle('store:set', (_, key: string, value: unknown) => { store.set(key, value) })

  // Dialog IPC
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  mainWindow = createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

export { mainWindow }
