import { useCallback, useEffect, useRef, useState } from 'react'
import type { OpenTab } from '@shared/types'

interface UseOpenTabsOptions {
  projectPath: string
  /** Resolved path of the root document; when it becomes available we auto-open it once per project. */
  rootDocRelative: string | null
}

interface UseOpenTabsResult {
  tabs: OpenTab[]
  activeTab: string | null
  activeTabData: OpenTab | null
  setActiveTab: (path: string | null) => void
  openFile: (filePath: string) => Promise<void>
  closeTab: (filePath: string) => Promise<void>
  updateContent: (filePath: string, content: string) => void
  /** Save a specific file. Returns true if a write happened. */
  saveFile: (filePath: string) => Promise<boolean>
  /** Save every dirty tab. Returns paths of files that were written. */
  saveAllDirty: () => Promise<string[]>
  /** Always-current snapshots, useful inside non-reactive callbacks. */
  tabsRef: React.MutableRefObject<OpenTab[]>
  activeTabRef: React.MutableRefObject<string | null>
}

export function useOpenTabs({ projectPath, rootDocRelative }: UseOpenTabsOptions): UseOpenTabsResult {
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)

  // Refs mirror state so callbacks invoked from non-React contexts (menu
  // listener, IPC events) read the latest values without re-binding.
  const tabsRef = useRef<OpenTab[]>([])
  const activeTabRef = useRef<string | null>(null)
  tabsRef.current = tabs
  activeTabRef.current = activeTab

  const openFile = useCallback(async (filePath: string) => {
    if (tabsRef.current.some(t => t.path === filePath)) {
      setActiveTab(filePath)
      return
    }
    try {
      const content = await window.api.files.read(filePath)
      // files.read returns null for missing files. Don't create a tab for one —
      // that just hides a real failure (e.g. compile panel pointing at a bogus path).
      if (content === null) {
        console.warn('openFile: file not found', filePath)
        return
      }
      const name = filePath.split('/').pop() || filePath
      setTabs(prev => [...prev, { path: filePath, name, content, isDirty: false }])
      setActiveTab(filePath)
    } catch (e) {
      console.error('Failed to open file', e)
    }
  }, [])

  // Auto-open the root document once per project, the first time we learn
  // what it is. autoOpenedRef guards against re-firing on mainDoc updates.
  const autoOpenedRef = useRef<string | null>(null)
  useEffect(() => {
    if (autoOpenedRef.current === projectPath) return
    if (!rootDocRelative) return
    autoOpenedRef.current = projectPath
    const fullPath = rootDocRelative.startsWith('/')
      ? rootDocRelative
      : `${projectPath}/${rootDocRelative}`
    openFile(fullPath)
  }, [projectPath, rootDocRelative, openFile])

  const closeTab = useCallback(async (filePath: string) => {
    const tab = tabsRef.current.find(t => t.path === filePath)
    if (tab?.isDirty) {
      const choice = await window.api.dialog.showSave(tab.name)
      if (choice === 'cancel') return
      if (choice === 'save') await window.api.files.write(tab.path, tab.content)
      // 'discard' falls through to close
    }
    setTabs(prev => {
      const idx = prev.findIndex(t => t.path === filePath)
      const next = prev.filter(t => t.path !== filePath)
      if (activeTabRef.current === filePath) {
        setActiveTab(next[Math.min(idx, next.length - 1)]?.path ?? null)
      }
      return next
    })
  }, [])

  const updateContent = useCallback((filePath: string, content: string) => {
    setTabs(prev => prev.map(t =>
      t.path === filePath ? { ...t, content, isDirty: true } : t,
    ))
  }, [])

  const saveFile = useCallback(async (filePath: string): Promise<boolean> => {
    const tab = tabsRef.current.find(t => t.path === filePath)
    if (!tab || !tab.isDirty) return false
    await window.api.files.write(filePath, tab.content)
    setTabs(prev => prev.map(t =>
      t.path === filePath ? { ...t, isDirty: false } : t,
    ))
    return true
  }, [])

  const saveAllDirty = useCallback(async (): Promise<string[]> => {
    const dirty = tabsRef.current.filter(t => t.isDirty)
    if (dirty.length === 0) return []
    await Promise.all(dirty.map(t => window.api.files.write(t.path, t.content)))
    setTabs(prev => prev.map(t =>
      dirty.some(d => d.path === t.path) ? { ...t, isDirty: false } : t,
    ))
    return dirty.map(t => t.path)
  }, [])

  const activeTabData = tabs.find(t => t.path === activeTab) ?? null

  return {
    tabs, activeTab, activeTabData, setActiveTab,
    openFile, closeTab, updateContent,
    saveFile, saveAllDirty,
    tabsRef, activeTabRef,
  }
}
