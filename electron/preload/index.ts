import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  IpcChannel,
  IpcArgs,
  IpcReturn,
  MenuAction,
} from '@shared/ipc-contract'
import type {
  CommitOptions,
  CompileConfig,
  CompileOptions,
  ConflictResolution,
  OpenFileOptions,
  ProjectTemplate,
} from '@shared/types'

// Strongly-typed invoke. Channel name and argument tuple are constrained by
// the contract in src/shared/ipc-contract.ts; main and renderer can't drift.
function invoke<K extends IpcChannel>(channel: K, ...args: IpcArgs<K>): IpcReturn<K> {
  return ipcRenderer.invoke(channel, ...args) as IpcReturn<K>
}

const api = {
  store: {
    get: (key: string) => invoke('store:get', key),
    set: (key: string, value: unknown) => invoke('store:set', key, value),
  },

  dialog: {
    openFolder: () => invoke('dialog:openFolder'),
    openFile: (opts: OpenFileOptions = {}) => invoke('dialog:openFile', opts),
    showSave: (fileName: string) => invoke('dialog:showSave', fileName),
  },

  app: {
    openExternal: (url: string) => invoke('app:openExternal', url),
    openPath: (filePath: string) => invoke('app:openPath', filePath),
  },

  projects: {
    scan: () => invoke('projects:scan'),
    getRoot: () => invoke('projects:getRoot'),
    setRoot: (rootPath: string) => invoke('projects:setRoot', rootPath),
    createFolder: (folderPath: string) => invoke('projects:createFolder', folderPath),
    checkLatexmk: () => invoke('projects:checkLatexmk'),
    getLatexmkPath: () => invoke('projects:getLatexmkPath'),
    setLatexmkPath: (path: string) => invoke('projects:setLatexmkPath', path),
    create: (opts: { root: string; name: string; template: ProjectTemplate }) =>
      invoke('projects:newProject', opts),
    clone: (opts: { root: string; url: string; name?: string }) =>
      invoke('projects:clone', opts),
    rename: (opts: { oldPath: string; newName: string }) =>
      invoke('projects:rename', opts),
    delete: (projectPath: string) => invoke('projects:delete', projectPath),
  },

  files: {
    tree: (projectPath: string) => invoke('files:tree', projectPath),
    read: (filePath: string) => invoke('files:read', filePath),
    write: (filePath: string, content: string) => invoke('files:write', filePath, content),
    delete: (filePath: string) => invoke('files:delete', filePath),
    rename: (oldPath: string, newPath: string) => invoke('files:rename', oldPath, newPath),
    mkdir: (dirPath: string) => invoke('files:mkdir', dirPath),
    copy: (srcPath: string, destPath: string) => invoke('files:copy', srcPath, destPath),
    showInFinder: (filePath: string) => invoke('files:showInFinder', filePath),
    openInTerminal: (dirPath: string) => invoke('files:openInTerminal', dirPath),
    // Special: webUtils is preload-only (not an IPC call). Returns the OS path
    // for a File object dragged in from the OS.
    getPathFor: (file: File) => webUtils.getPathForFile(file),
  },

  git: {
    status: (projectPath: string) => invoke('git:status', projectPath),
    stage: (projectPath: string, file: string) => invoke('git:stage', projectPath, file),
    unstage: (projectPath: string, file: string) => invoke('git:unstage', projectPath, file),
    commit: (projectPath: string, message: string, opts?: CommitOptions) =>
      invoke('git:commit', projectPath, message, opts),
    push: (projectPath: string) => invoke('git:push', projectPath),
    pull: (projectPath: string) => invoke('git:pull', projectPath),
    fetch: (projectPath: string) => invoke('git:fetch', projectPath),
    resetToRemote: (projectPath: string) => invoke('git:resetToRemote', projectPath),
    addRemote: (projectPath: string, url: string) => invoke('git:addRemote', projectPath, url),
    forcePush: (projectPath: string) => invoke('git:forcePush', projectPath),
    log: (projectPath: string, maxCount?: number) => invoke('git:log', projectPath, maxCount),
    diff: (projectPath: string, file: string, staged: boolean) =>
      invoke('git:diff', projectPath, file, staged),
    showStaged: (projectPath: string, file: string) =>
      invoke('git:showStaged', projectPath, file),
    resolveConflict: (projectPath: string, file: string, resolution: ConflictResolution) =>
      invoke('git:resolveConflict', projectPath, file, resolution),
  },

  compile: {
    run: (projectPath: string, opts?: CompileOptions) => invoke('compile:run', projectPath, opts),
    stop: (projectPath: string) => invoke('compile:stop', projectPath),
    getPdfPath: (projectPath: string) => invoke('compile:getPdfPath', projectPath),
    readPdf: (pdfPath: string) => invoke('compile:readPdf', pdfPath),
    detectMainDoc: (projectPath: string) => invoke('compile:detectMainDoc', projectPath),
    getConfig: (projectPath: string) => invoke('compile:getConfig', projectPath),
    setConfig: (projectPath: string, config: CompileConfig) =>
      invoke('compile:setConfig', projectPath, config),
  },

  events: {
    onCompileProgress: (cb: (chunk: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, chunk: string) => cb(chunk)
      ipcRenderer.on('compile:progress', handler)
      return () => ipcRenderer.removeListener('compile:progress', handler)
    },
    onMenuAction: (cb: (action: MenuAction) => void) => {
      const channels: MenuAction[] = [
        'menu:save', 'menu:openSettings',
        'menu:viewEditor', 'menu:viewSplit', 'menu:viewPdf',
      ]
      const handlers: Array<{ ch: MenuAction; fn: () => void }> = []
      for (const ch of channels) {
        const fn = () => cb(ch)
        ipcRenderer.on(ch, fn)
        handlers.push({ ch, fn })
      }
      return () => handlers.forEach(({ ch, fn }) => ipcRenderer.removeListener(ch, fn))
    },
  },
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
