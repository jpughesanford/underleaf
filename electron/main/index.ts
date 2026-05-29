import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { registerProjectIPC } from './ipc/projects'
import { registerFileIPC } from './ipc/files'
import { registerGitIPC } from './ipc/git'
import { registerCompileIPC } from './ipc/compile'
import { loadDictionary } from './services/spellcheck'

const store = new Store<Record<string, unknown>>({
  defaults: {
    projectsRoot: null,
    settings: {
      defaultEngine: 'pdflatex',
      compileOnSave: true,
    },
  },
})

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
      sandbox: true,
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
  registerFileIPC(store)
  registerGitIPC()
  registerCompileIPC(store)

  // Store IPC
  ipcMain.handle('store:get', (_, key: string) => store.get(key))
  ipcMain.handle('store:set', (_, key: string, value: unknown) => { store.set(key, value) })

  // Hunspell dictionary for the renderer's spell checker (cached per language).
  ipcMain.handle('spellcheck:dictionary', (_, lang: string) => loadDictionary(lang))

  // Dialog IPC
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:showSave', async (_, fileName: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return 'discard'
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      message: `Do you want to save the changes you made to ${fileName}?`,
      detail: "Your changes will be lost if you don't save them.",
      buttons: ['Save', 'Discard', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
    })
    return response === 0 ? 'save' : response === 1 ? 'discard' : 'cancel'
  })

  ipcMain.handle('dialog:openFile', async (_, opts: { title?: string; filters?: Electron.FileFilter[] }) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: opts?.title,
      filters: opts?.filters,
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Open an http(s) URL in the OS default browser. Reject anything else so a
  // malicious .tex file can't open file:// or javascript: URIs.
  ipcMain.handle('app:openExternal', (_, url: string) => {
    if (typeof url !== 'string') return
    if (!/^https?:\/\//i.test(url)) return
    shell.openExternal(url)
  })

  // Open a local file path in the OS default app (Preview for PDFs on macOS).
  ipcMain.handle('app:openPath', async (_, filePath: string) => {
    if (typeof filePath !== 'string' || !filePath) return ''
    return shell.openPath(filePath)
  })

  createWindow()

  buildMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

function sendToFocused(channel: string) {
  BrowserWindow.getFocusedWindow()?.webContents.send(channel)
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS)
    {
      label: app.name,
      submenu: [
        { label: `About ${app.name}`, role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences…',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendToFocused('menu:openSettings'),
        },
        { type: 'separator' },
        { label: 'Services', role: 'services' },
        { type: 'separator' },
        { label: `Hide ${app.name}`, role: 'hide' },
        { label: 'Hide Others', role: 'hideOthers' },
        { label: 'Show All', role: 'unhide' },
        { type: 'separator' },
        { label: `Quit ${app.name}`, role: 'quit' },
      ],
    },
    // File
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => createWindow(),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToFocused('menu:save'),
        },
        { type: 'separator' },
        { label: 'Close Window', role: 'close' },
      ],
    },
    // Edit
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', role: 'undo' },
        { label: 'Redo', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', role: 'cut' },
        { label: 'Copy', role: 'copy' },
        { label: 'Paste', role: 'paste' },
        { label: 'Select All', role: 'selectAll' },
      ],
    },
    // View
    {
      label: 'View',
      submenu: [
        {
          label: 'Editor Only',
          accelerator: 'CmdOrCtrl+1',
          click: () => sendToFocused('menu:viewEditor'),
        },
        {
          label: 'Split View',
          accelerator: 'CmdOrCtrl+2',
          click: () => sendToFocused('menu:viewSplit'),
        },
        {
          label: 'PDF Only',
          accelerator: 'CmdOrCtrl+3',
          click: () => sendToFocused('menu:viewPdf'),
        },
        { type: 'separator' },
        { label: 'Toggle Full Screen', role: 'togglefullscreen' },
        ...(is.dev ? [
          { type: 'separator' as const },
          { label: 'Reload', role: 'reload' as const },
          { label: 'Toggle Developer Tools', role: 'toggleDevTools' as const },
        ] : []),
      ],
    },
    // Window
    {
      label: 'Window',
      role: 'window',
      submenu: [
        { label: 'Minimize', role: 'minimize' },
        { label: 'Zoom', role: 'zoom' },
        { type: 'separator' },
        { label: 'Bring All to Front', role: 'front' },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
