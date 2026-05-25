import { contextBridge, ipcRenderer, webUtils } from 'electron'

const api = {
  // Store
  storeGet: (key: string) => ipcRenderer.invoke('store:get', key),
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),

  // Dialog
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  openFile: (opts?: { title?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('dialog:openFile', opts),
  showSaveDialog: (fileName: string) => ipcRenderer.invoke('dialog:showSave', fileName) as Promise<'save' | 'discard' | 'cancel'>,

  // Projects
  scanProjects: () => ipcRenderer.invoke('projects:scan'),
  setProjectsRoot: (path: string) => ipcRenderer.invoke('projects:setRoot', path),
  getProjectsRoot: () => ipcRenderer.invoke('projects:getRoot'),
  createFolder: (path: string) => ipcRenderer.invoke('projects:createFolder', path),
  checkLatexmk: () => ipcRenderer.invoke('projects:checkLatexmk'),
  setLatexmkPath: (path: string) => ipcRenderer.invoke('projects:setLatexmkPath', path),
  getLatexmkPath: () => ipcRenderer.invoke('projects:getLatexmkPath'),
  newProject: (opts: { root: string; name: string; template: string }) =>
    ipcRenderer.invoke('projects:newProject', opts),
  cloneProject: (opts: { root: string; url: string }) =>
    ipcRenderer.invoke('projects:clone', opts),
  deleteProject: (projectPath: string) => ipcRenderer.invoke('projects:delete', projectPath) as Promise<boolean>,

  // Files
  fileTree: (projectPath: string) => ipcRenderer.invoke('files:tree', projectPath),
  readFile: (filePath: string) => ipcRenderer.invoke('files:read', filePath) as Promise<string | null>,
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('files:write', filePath, content),
  deleteFile: (filePath: string) => ipcRenderer.invoke('files:delete', filePath),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('files:rename', oldPath, newPath),
  mkdir: (dirPath: string) => ipcRenderer.invoke('files:mkdir', dirPath),
  copyFile: (srcPath: string, destPath: string) => ipcRenderer.invoke('files:copy', srcPath, destPath),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  showInFinder: (filePath: string) => ipcRenderer.invoke('files:showInFinder', filePath),

  // Git
  gitStatus: (projectPath: string) => ipcRenderer.invoke('git:status', projectPath),
  gitStage: (projectPath: string, file: string) => ipcRenderer.invoke('git:stage', projectPath, file),
  gitUnstage: (projectPath: string, file: string) => ipcRenderer.invoke('git:unstage', projectPath, file),
  gitCommit: (projectPath: string, message: string) => ipcRenderer.invoke('git:commit', projectPath, message),
  gitPush: (projectPath: string) => ipcRenderer.invoke('git:push', projectPath),
  gitPull: (projectPath: string) => ipcRenderer.invoke('git:pull', projectPath),
  gitFetch: (projectPath: string) => ipcRenderer.invoke('git:fetch', projectPath),
  gitResetToRemote: (projectPath: string) => ipcRenderer.invoke('git:resetToRemote', projectPath) as Promise<{ success: boolean; error?: string }>,
  gitAddRemote: (projectPath: string, url: string) => ipcRenderer.invoke('git:addRemote', projectPath, url),
  gitForcePush: (projectPath: string) => ipcRenderer.invoke('git:forcePush', projectPath),
  gitLog: (projectPath: string, maxCount?: number) => ipcRenderer.invoke('git:log', projectPath, maxCount),
  gitDiff: (projectPath: string, file: string, staged: boolean) =>
    ipcRenderer.invoke('git:diff', projectPath, file, staged),
  gitResolveConflict: (projectPath: string, file: string, resolution: 'ours' | 'theirs') =>
    ipcRenderer.invoke('git:resolveConflict', projectPath, file, resolution),

  // Compile
  compile: (projectPath: string, opts?: { file?: string }) => ipcRenderer.invoke('compile:run', projectPath, opts),
  stopCompile: (projectPath: string) => ipcRenderer.invoke('compile:stop', projectPath),
  getPdfPath: (projectPath: string) => ipcRenderer.invoke('compile:getPdfPath', projectPath),
  readPdf: (pdfPath: string) => ipcRenderer.invoke('compile:readPdf', pdfPath),
  detectMainDoc: (projectPath: string) => ipcRenderer.invoke('compile:detectMainDoc', projectPath),
  getCompileConfig: (projectPath: string) => ipcRenderer.invoke('compile:getConfig', projectPath),
  setCompileConfig: (projectPath: string, config: Record<string, unknown>) =>
    ipcRenderer.invoke('compile:setConfig', projectPath, config),

  // Events
  onCompileProgress: (cb: (chunk: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, chunk: string) => cb(chunk)
    ipcRenderer.on('compile:progress', handler)
    return () => ipcRenderer.removeListener('compile:progress', handler)
  },
  onMenuAction: (cb: (action: string) => void) => {
    const channels = ['menu:save', 'menu:openSettings', 'menu:viewEditor', 'menu:viewSplit', 'menu:viewPdf']
    const handler = (_: Electron.IpcRendererEvent, ...args: unknown[]) => cb(args[0] as string)
    const handlers: Array<{ ch: string; fn: typeof handler }> = []
    for (const ch of channels) {
      const fn = (_evt: Electron.IpcRendererEvent) => cb(ch)
      ipcRenderer.on(ch, fn)
      handlers.push({ ch, fn })
    }
    return () => handlers.forEach(({ ch, fn }) => ipcRenderer.removeListener(ch, fn))
  },
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
