import React, { useState, useEffect, useCallback, useRef } from 'react'
import FileExplorer from '../components/editor/FileExplorer'
import EditorPane from '../components/editor/EditorPane'
import PdfPane from '../components/pdf/PdfPane'
import GitPanel from '../components/git/GitPanel'
import CompilePanel from '../components/editor/CompilePanel'
import Toolbar, { CompileTarget } from '../components/editor/Toolbar'

export type SidebarTab = 'files' | 'git'

export interface OpenTab {
  path: string
  name: string
  content: string
  isDirty: boolean
  language?: string
}

interface CompileResult {
  success: boolean
  errors: CompileError[]
  warnings: CompileError[]
  rawLog: string
  pdfPath?: string
}

interface CompileError {
  type: 'error' | 'warning'
  file: string
  line: number | null
  message: string
}

interface Props {
  projectPath: string
  projectName: string
  onBack: () => void
}

export default function EditorPage({ projectPath, projectName, onBack }: Props) {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('files')
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [compiling, setCompiling] = useState(false)
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null)
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [pdfVersion, setPdfVersion] = useState(0)
  const [showCompilePanel, setShowCompilePanel] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [pdfWidth, setPdfWidth] = useState(420)
  const [compileTrigger, setCompileTrigger] = useState('manual')
  const [compileTarget, setCompileTarget] = useState<CompileTarget>('root')
  const [mainDoc, setMainDoc] = useState<string | null>(null)
  const [detectedMainDoc, setDetectedMainDoc] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tabsRef = useRef<OpenTab[]>([])
  const activeTabRef = useRef<string | null>(null)

  useEffect(() => {
    window.api.storeGet('settings').then((s: unknown) => {
      const settings = s as { compileTrigger?: string } | null
      if (settings?.compileTrigger) setCompileTrigger(settings.compileTrigger)
    })
    window.api.getPdfPath(projectPath).then(p => { if (p) setPdfPath(p) })
    // Load per-project config for main document, then fall back to auto-detection
    window.api.getCompileConfig(projectPath).then(async (cfg: unknown) => {
      const config = cfg as { rootDocument?: string } | null
      if (config?.rootDocument) {
        setMainDoc(config.rootDocument)
      } else {
        const detected = await window.api.detectMainDoc(projectPath)
        if (detected) setDetectedMainDoc(detected)
      }
    })
  }, [projectPath])

  // Keep refs current so compile can access latest state without stale closures
  tabsRef.current = tabs
  activeTabRef.current = activeTab

  const handleSetMainDoc = useCallback(async (relativePath: string) => {
    const cfg = (await window.api.getCompileConfig(projectPath)) as Record<string, unknown> || {}
    cfg.rootDocument = relativePath
    await window.api.setCompileConfig(projectPath, cfg)
    setMainDoc(relativePath)
    setDetectedMainDoc(null)
  }, [projectPath])

  const compile = useCallback(async () => {
    // Auto-save all dirty tabs before compiling so latexmk sees latest content
    const dirty = tabsRef.current.filter(t => t.isDirty)
    if (dirty.length > 0) {
      await Promise.all(dirty.map(t => window.api.writeFile(t.path, t.content)))
      setTabs(prev => prev.map(t => dirty.some(d => d.path === t.path) ? { ...t, isDirty: false } : t))
    }

    setCompiling(true)
    setShowCompilePanel(true)
    setCompileResult(null)
    try {
      const activeFile = activeTabRef.current
      const opts = compileTarget === 'active' && activeFile ? { file: activeFile } : undefined
      const result = await window.api.compile(projectPath, opts)
      setCompileResult(result)
      if (result.success) {
        const p = result.pdfPath ?? await window.api.getPdfPath(projectPath)
        setPdfPath(p)
        setPdfVersion(v => v + 1)
      }
    } finally {
      setCompiling(false)
    }
  }, [projectPath, compileTarget])

  const openFile = useCallback(async (filePath: string) => {
    // Check if already open
    const existing = tabs.find(t => t.path === filePath)
    if (existing) {
      setActiveTab(filePath)
      return
    }

    try {
      const content = await window.api.readFile(filePath)
      const name = filePath.split('/').pop() || filePath
      const newTab: OpenTab = { path: filePath, name, content, isDirty: false }
      setTabs(prev => [...prev, newTab])
      setActiveTab(filePath)
    } catch (e) {
      console.error('Failed to open file', e)
    }
  }, [tabs])

  const closeTab = useCallback((filePath: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.path === filePath)
      const next = prev.filter(t => t.path !== filePath)
      if (activeTab === filePath) {
        const newActive = next[Math.min(idx, next.length - 1)]?.path ?? null
        setActiveTab(newActive)
      }
      return next
    })
  }, [activeTab])

  const updateContent = useCallback((filePath: string, content: string) => {
    setTabs(prev => prev.map(t =>
      t.path === filePath ? { ...t, content, isDirty: true } : t
    ))

    // Trigger auto-compile if set
    if (compileTrigger === 'auto') {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => compile(), 1500)
    }
  }, [compileTrigger, compile])

  const saveFile = useCallback(async (filePath: string) => {
    const tab = tabs.find(t => t.path === filePath)
    if (!tab || !tab.isDirty) return
    await window.api.writeFile(filePath, tab.content)
    setTabs(prev => prev.map(t =>
      t.path === filePath ? { ...t, isDirty: false } : t
    ))
    if (compileTrigger === 'onsave') {
      compile()
    }
  }, [tabs, compileTrigger, compile])

  const jumpToError = useCallback((file: string, line: number | null) => {
    if (!line) return
    const targetPath = file.startsWith('/') ? file : `${projectPath}/${file}`
    openFile(targetPath)
    // Editor will handle scrolling via activeTab + line signal
  }, [projectPath, openFile])

  const activeTabData = tabs.find(t => t.path === activeTab) ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg-app)', overflow: 'hidden' }}>
      {/* Toolbar */}
      <Toolbar
        projectName={projectName}
        onBack={onBack}
        onCompile={compile}
        compiling={compiling}
        compileTrigger={compileTrigger}
        onChangeTrigger={setCompileTrigger}
        compileTarget={compileTarget}
        onChangeTarget={setCompileTarget}
        projectPath={projectPath}
        activeFilePath={activeTab}
        onSave={() => activeTab && saveFile(activeTab)}
      />

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left rail */}
        <div style={{
          width: 44,
          background: 'var(--color-bg-panel)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 8,
          gap: 4,
          flexShrink: 0,
        }}>
          <RailButton
            active={sidebarTab === 'files'}
            title="Files"
            onClick={() => setSidebarTab(prev => prev === 'files' ? prev : 'files')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M3 14h7v7H3z"/><path d="M14 14h7v7h-7z"/>
            </svg>
          </RailButton>

          <RailButton
            active={sidebarTab === 'git'}
            title="Source Control"
            onClick={() => setSidebarTab(prev => prev === 'git' ? prev : 'git')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <line x1="6" y1="3" x2="6" y2="15"/>
              <circle cx="18" cy="6" r="3"/>
              <circle cx="6" cy="18" r="3"/>
              <path d="M18 9a9 9 0 0 1-9 9"/>
            </svg>
          </RailButton>
        </div>

        {/* Sidebar */}
        <div style={{
          width: sidebarWidth,
          background: 'var(--color-bg-sidebar)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {sidebarTab === 'files' ? (
            <FileExplorer
              projectPath={projectPath}
              activeFile={activeTab}
              onOpenFile={openFile}
              mainDoc={mainDoc}
              detectedMainDoc={detectedMainDoc}
              onSetMainDoc={handleSetMainDoc}
            />
          ) : (
            <GitPanel
              projectPath={projectPath}
              onOpenFile={openFile}
            />
          )}
        </div>

        {/* Resize handle - sidebar */}
        <ResizeHandle
          onDrag={(dx) => setSidebarWidth(w => Math.max(180, Math.min(500, w + dx)))}
        />

        {/* Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Tab bar */}
          {tabs.length > 0 && (
            <div style={{
              display: 'flex',
              background: 'var(--color-bg-toolbar)',
              borderBottom: '1px solid var(--color-border)',
              overflowX: 'auto',
              flexShrink: 0,
            }}>
              {tabs.map(tab => (
                <TabItem
                  key={tab.path}
                  tab={tab}
                  active={tab.path === activeTab}
                  onActivate={() => setActiveTab(tab.path)}
                  onClose={() => closeTab(tab.path)}
                  onSave={() => saveFile(tab.path)}
                />
              ))}
            </div>
          )}

          {/* Editor content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTabData ? (
              <EditorPane
                key={activeTabData.path}
                filePath={activeTabData.path}
                content={activeTabData.content}
                onChange={(content) => updateContent(activeTabData.path, content)}
                onSave={() => saveFile(activeTabData.path)}
              />
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                userSelect: 'none',
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: 16, opacity: 0.4 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <p style={{ fontSize: 14 }}>Open a file from the explorer</p>
              </div>
            )}
          </div>

          {/* Compile panel */}
          {showCompilePanel && (
            <CompilePanel
              result={compileResult}
              compiling={compiling}
              onClose={() => setShowCompilePanel(false)}
              onJumpToError={jumpToError}
            />
          )}
        </div>

        {/* Resize handle - pdf */}
        {pdfPath && (
          <ResizeHandle
            onDrag={(dx) => setPdfWidth(w => Math.max(280, Math.min(800, w - dx)))}
          />
        )}

        {/* PDF pane */}
        {pdfPath && (
          <div style={{ width: pdfWidth, flexShrink: 0, borderLeft: '1px solid var(--color-border)' }}>
            <PdfPane pdfPath={pdfPath} version={pdfVersion} />
          </div>
        )}
      </div>
    </div>
  )
}

function RailButton({ active, title, onClick, children }: {
  active: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 36, height: 36,
        borderRadius: 8,
        border: 'none',
        background: active ? 'rgba(76,175,80,0.15)' : 'transparent',
        color: active ? '#4CAF50' : '#64748b',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#94a3b8' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#64748b' }}
    >
      {children}
    </button>
  )
}

function TabItem({ tab, active, onActivate, onClose, onSave }: {
  tab: OpenTab
  active: boolean
  onActivate: () => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div
      onClick={onActivate}
      onKeyDown={e => { if (e.key === 's' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSave() } }}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 12px',
        height: 34,
        cursor: 'pointer',
        borderRight: '1px solid var(--color-border)',
        background: active ? 'var(--color-bg-editor)' : 'transparent',
        color: active ? '#e2e8f0' : '#64748b',
        fontSize: 12,
        flexShrink: 0,
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {active && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 2,
          background: 'var(--color-brand)',
        }} />
      )}
      {tab.isDirty && (
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fbbf24', flexShrink: 0 }} />
      )}
      <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {tab.name}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onClose() }}
        style={{
          width: 16, height: 16,
          borderRadius: 3,
          border: 'none',
          background: 'transparent',
          color: '#64748b',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
          marginLeft: 2,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#e2e8f0' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

function ResizeHandle({ onDrag }: { onDrag: (dx: number) => void }) {
  const dragging = useRef(false)
  const lastX = useRef(0)

  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true
    lastX.current = e.clientX
    e.preventDefault()

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      onDrag(ev.clientX - lastX.current)
      lastX.current = ev.clientX
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 4,
        background: 'var(--color-border)',
        cursor: 'col-resize',
        flexShrink: 0,
        transition: 'background 150ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-brand)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-border)' }}
    />
  )
}
