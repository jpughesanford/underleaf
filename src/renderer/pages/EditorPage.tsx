import React, { useState, useEffect, useCallback, useRef } from 'react'
import SettingsModal from '../components/dashboard/SettingsModal'
import FileExplorer from '../components/editor/FileExplorer'
import EditorPane, { EditorPaneHandle } from '../components/editor/EditorPane'
import PdfPane from '../components/pdf/PdfPane'
import GitPanel from '../components/git/GitPanel'
import CompilePanel from '../components/editor/CompilePanel'
import Toolbar, { CompileTarget, ViewMode } from '../components/editor/Toolbar'

export type SidebarTab = 'files' | 'git' | 'compile'

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
  onRename: (newPath: string, newName: string) => void
}

export default function EditorPage({ projectPath, projectName, onBack, onRename }: Props) {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('files')
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [compiling, setCompiling] = useState(false)
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null)
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [pdfVersion, setPdfVersion] = useState(0)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [pdfWidth, setPdfWidth] = useState(420)
  const [compileOnSave, setCompileOnSave] = useState(true)
  const [compileTarget, setCompileTarget] = useState<CompileTarget>('root')
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [mainDoc, setMainDoc] = useState<string | null>(null)
  const [detectedMainDoc, setDetectedMainDoc] = useState<string | null>(null)
  const editorRef = useRef<EditorPaneHandle>(null)
  const tabsRef = useRef<OpenTab[]>([])
  // Live handle on the body flex container — read at drag time to cap
  // pdfWidth so the editor's minWidth is never violated. Without this the
  // PDF drag clamps to a static [280, 800] range that ignores the actual
  // container size, letting pdfWidth state grow past what's renderable.
  const bodyRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<string | null>(null)
  const autoOpenedRef = useRef<string | null>(null)

  useEffect(() => {
    window.api.storeGet('settings').then((s: unknown) => {
      const settings = s as { compileOnSave?: boolean } | null
      if (settings && settings.compileOnSave !== undefined) setCompileOnSave(settings.compileOnSave)
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

  const handleProjectRename = useCallback(async (newName: string) => {
    if (!newName || newName === projectName) return
    // Save dirty tabs before renaming the enclosing folder so no edits are lost.
    const dirty = tabsRef.current.filter(t => t.isDirty)
    if (dirty.length > 0) {
      await Promise.all(dirty.map(t => window.api.writeFile(t.path, t.content)))
    }
    try {
      const newPath = await window.api.renameProject({ oldPath: projectPath, newName })
      // App.tsx re-keys EditorPage on projectPath, so we'll get a clean remount.
      onRename(newPath, newName)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Rename failed')
    }
  }, [projectPath, projectName, onRename])

  const compile = useCallback(async () => {
    // Auto-save all dirty tabs before compiling so latexmk sees latest content
    const dirty = tabsRef.current.filter(t => t.isDirty)
    if (dirty.length > 0) {
      await Promise.all(dirty.map(t => window.api.writeFile(t.path, t.content)))
      setTabs(prev => prev.map(t => dirty.some(d => d.path === t.path) ? { ...t, isDirty: false } : t))
    }

    setCompiling(true)
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
        setViewMode(v => v === 'editor' ? 'split' : v)
      } else if (result.errors.length > 0) {
        // Auto-jump to the compile tab on errors so the user sees them without hunting.
        setSidebarTab('compile')
        setSidebarOpen(true)
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
      const content = (await window.api.readFile(filePath)) ?? ''
      const name = filePath.split('/').pop() || filePath
      const newTab: OpenTab = { path: filePath, name, content, isDirty: false }
      setTabs(prev => [...prev, newTab])
      setActiveTab(filePath)
    } catch (e) {
      console.error('Failed to open file', e)
    }
  }, [tabs])

  // Auto-open the root document the first time we learn what it is for this project.
  // Guarded by projectPath so re-mounting onto a different project re-triggers exactly once.
  useEffect(() => {
    if (autoOpenedRef.current === projectPath) return
    const rootDoc = mainDoc ?? detectedMainDoc
    if (!rootDoc) return
    autoOpenedRef.current = projectPath
    const fullPath = rootDoc.startsWith('/') ? rootDoc : `${projectPath}/${rootDoc}`
    openFile(fullPath)
  }, [projectPath, mainDoc, detectedMainDoc, openFile])

  const closeTab = useCallback(async (filePath: string) => {
    const tab = tabsRef.current.find(t => t.path === filePath)
    if (tab?.isDirty) {
      const choice = await window.api.showSaveDialog(tab.name)
      if (choice === 'save') {
        await window.api.writeFile(tab.path, tab.content)
      } else if (choice === 'cancel') {
        return
      }
      // 'discard' falls through to close
    }
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
  }, [])

  const saveFile = useCallback(async (filePath: string) => {
    const tab = tabs.find(t => t.path === filePath)
    if (!tab) return
    if (tab.isDirty) {
      await window.api.writeFile(filePath, tab.content)
      setTabs(prev => prev.map(t =>
        t.path === filePath ? { ...t, isDirty: false } : t
      ))
    }
    if (compileOnSave) compile()
  }, [tabs, compileOnSave, compile])

  const jumpToError = useCallback(async (file: string, line: number | null) => {
    if (!line) return
    let targetPath: string
    if (file.startsWith('/')) {
      targetPath = file
    } else {
      // Normalize ../.. segments from LaTeX log relative paths
      const segments = `${projectPath}/${file}`.split('/')
      const resolved: string[] = []
      for (const seg of segments) {
        if (seg === '..') resolved.pop()
        else if (seg !== '.') resolved.push(seg)
      }
      const normalized = resolved.join('/')
      // If normalization escaped the project directory, LaTeX reported an outside path —
      // just look for the bare filename inside the project instead
      targetPath = normalized.startsWith(projectPath)
        ? normalized
        : `${projectPath}/${file.split('/').pop() ?? file}`
    }
    await openFile(targetPath)
    // rAF ensures React has committed the (possibly new) EditorPane before we call jump
    requestAnimationFrame(() => editorRef.current?.jump(line))
  }, [projectPath, openFile])

  // Menu bar actions — must come after all callbacks/refs are defined.
  // compileOnSaveRef + compileRef stay live across renders so the menu listener
  // can use the latest values without re-binding.
  const compileRef = useRef(compile)
  compileRef.current = compile
  const compileOnSaveRef = useRef(compileOnSave)
  compileOnSaveRef.current = compileOnSave
  useEffect(() => {
    return window.api.onMenuAction((action) => {
      if (action === 'menu:save') {
        const active = activeTabRef.current
        const tab = active ? tabsRef.current.find(t => t.path === active) : null
        const shouldCompile = compileOnSaveRef.current
        if (tab?.isDirty) {
          window.api.writeFile(tab.path, tab.content).then(() => {
            setTabs(prev => prev.map(t => t.path === active ? { ...t, isDirty: false } : t))
            if (shouldCompile) compileRef.current()
          })
        } else if (shouldCompile) {
          compileRef.current()
        }
      } else if (action === 'menu:openSettings') {
        setShowSettings(true)
      } else if (action === 'menu:viewEditor') {
        setViewMode('editor')
      } else if (action === 'menu:viewSplit') {
        setViewMode('split')
      } else if (action === 'menu:viewPdf') {
        setViewMode('pdf')
      }
    })
  }, []) // refs always current; setState setters are stable

  // When the window (or sidebar) shrinks, an existing large pdfWidth state
  // would still overflow the body and reproduce the same off-center bug
  // the drag-time clamp prevents. Observe the body and re-clamp on every
  // resize so state stays within renderable bounds at all times.
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const ro = new ResizeObserver(() => {
      const sidebarTotal = sidebarOpen ? sidebarWidth + 8 : 0
      const maxPdf = body.clientWidth - 44 - sidebarTotal - 8 - 320
      setPdfWidth(w => Math.min(w, Math.max(280, maxPdf)))
    })
    ro.observe(body)
    return () => ro.disconnect()
  }, [sidebarOpen, sidebarWidth])

  const activeTabData = tabs.find(t => t.path === activeTab) ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg-app)', overflow: 'hidden' }}>
      {showSettings && (
        <SettingsModal
          onClose={async () => {
            setShowSettings(false)
            const s = await window.api.storeGet('settings') as { compileTrigger?: string } | null
            if (s?.compileTrigger) setCompileTrigger(s.compileTrigger)
          }}
          onChangeRoot={() => setShowSettings(false)}
        />
      )}
      {/* Toolbar */}
      <Toolbar
        projectName={projectName}
        onRenameProject={handleProjectRename}
        onBack={onBack}
        onCompile={compile}
        compiling={compiling}
        compileTarget={compileTarget}
        onChangeTarget={setCompileTarget}
        viewMode={viewMode}
        onChangeView={setViewMode}
        projectPath={projectPath}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Body */}
      <div ref={bodyRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left rail */}
        <div style={{
          width: 44,
          background: 'var(--color-bg-app)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 8,
          gap: 4,
          flexShrink: 0,
        }}>
          <RailButton
            active={sidebarTab === 'files' && sidebarOpen}
            title="Files"
            onClick={() => {
              if (sidebarTab === 'files') {
                setSidebarOpen(v => !v)
              } else {
                setSidebarTab('files')
                setSidebarOpen(true)
              }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M3 14h7v7H3z"/><path d="M14 14h7v7h-7z"/>
            </svg>
          </RailButton>

          <RailButton
            active={sidebarTab === 'git' && sidebarOpen}
            title="Source Control"
            onClick={() => {
              if (sidebarTab === 'git') {
                setSidebarOpen(v => !v)
              } else {
                setSidebarTab('git')
                setSidebarOpen(true)
              }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <line x1="6" y1="3" x2="6" y2="15"/>
              <circle cx="18" cy="6" r="3"/>
              <circle cx="6" cy="18" r="3"/>
              <path d="M18 9a9 9 0 0 1-9 9"/>
            </svg>
          </RailButton>

          {/* Compile tab — only present after the user has compiled at least once this session.
              Auto-activates on errors via the compile() effect above. */}
          {(compiling || compileResult) && (
            <RailButton
              active={sidebarTab === 'compile' && sidebarOpen}
              title="Build Output"
              badge={compileResult && compileResult.errors.length > 0 ? 'error' : compileResult && compileResult.warnings.length > 0 ? 'warn' : undefined}
              onClick={() => {
                if (sidebarTab === 'compile') {
                  setSidebarOpen(v => !v)
                } else {
                  setSidebarTab('compile')
                  setSidebarOpen(true)
                }
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </RailButton>
          )}
        </div>

        {/* Sidebar */}
        {sidebarOpen && viewMode !== 'pdf' && (
          <div style={{
            width: sidebarWidth,
            background: 'var(--color-bg-app)',
            borderRight: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {sidebarTab === 'files' && (
              <FileExplorer
                projectPath={projectPath}
                activeFile={activeTab}
                onOpenFile={openFile}
                mainDoc={mainDoc}
                detectedMainDoc={detectedMainDoc}
                onSetMainDoc={handleSetMainDoc}
              />
            )}
            {sidebarTab === 'git' && (
              <GitPanel
                projectPath={projectPath}
                onOpenFile={openFile}
              />
            )}
            {sidebarTab === 'compile' && (
              <CompilePanel
                result={compileResult}
                compiling={compiling}
                onJumpToError={jumpToError}
              />
            )}
          </div>
        )}

        {/* Resize handle - sidebar */}
        {sidebarOpen && viewMode !== 'pdf' && (
          <ResizeHandle
            onDrag={(dx) => setSidebarWidth(w => Math.max(180, Math.min(500, w + dx)))}
            onCollapse={() => setSidebarOpen(false)}
            collapseDirection="left"
          />
        )}

        {/* Editor */}
        {viewMode !== 'pdf' && (
        // 320px is the smallest width at which the search panel still
        // composes legibly (input + nav pill + close fit on one row).
        // Below that the PDF resize handle starts pushing the panel into
        // a broken layout, so the flex item refuses to shrink past it.
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 320 }}>
          {/* Tab bar */}
          {tabs.length > 0 && (
            <div style={{
              display: 'flex',
              background: 'var(--color-bg-app)',
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
                ref={editorRef}
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
                color: 'var(--color-text-muted)',
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

        </div>
        )}

        {/* Resize handle - pdf */}
        {pdfPath && viewMode === 'split' && (
          <ResizeHandle
            onDrag={(dx) => setPdfWidth(w => {
              // Cap the PDF at what the body can actually give us, so the
              // editor's minWidth (320) is honored and the drag stops
              // responding instead of letting pdfWidth state diverge from
              // the rendered width. Layout constants mirror the static
              // sizes used in this file: 44px rail, 8px each resize handle.
              const bodyW = bodyRef.current?.clientWidth ?? Infinity
              const sidebarTotal = sidebarOpen ? sidebarWidth + 8 : 0
              const maxPdf = bodyW - 44 - sidebarTotal - 8 - 320
              return Math.max(280, Math.min(800, maxPdf, w - dx))
            })}
            onCollapse={() => setViewMode('editor')}
            collapseDirection="right"
          />
        )}

        {/* PDF pane */}
        {pdfPath && (viewMode === 'split' || viewMode === 'pdf') && (
          <div style={{ width: viewMode === 'pdf' ? undefined : pdfWidth, flex: viewMode === 'pdf' ? 1 : undefined, flexShrink: 0, borderLeft: '1px solid var(--color-border)' }}>
            <PdfPane pdfPath={pdfPath} version={pdfVersion} />
          </div>
        )}
      </div>
    </div>
  )
}

function RailButton({ active, title, onClick, children, badge }: {
  active: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
  badge?: 'error' | 'warn'
}) {
  const badgeColor = badge === 'error' ? 'var(--color-error)' : badge === 'warn' ? 'var(--color-warning)' : null
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        position: 'relative',
        width: 36, height: 36,
        borderRadius: 8,
        border: 'none',
        background: active ? 'rgba(76,175,80,0.15)' : 'transparent',
        color: active ? 'var(--color-brand)' : 'var(--color-text-muted)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--color-text-secondary)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--color-text-muted)' }}
    >
      {children}
      {badgeColor && (
        <span
          style={{
            position: 'absolute',
            top: 6, right: 6,
            width: 7, height: 7, borderRadius: '50%',
            background: badgeColor,
            boxShadow: '0 0 0 1.5px var(--color-bg-app)',
          }}
        />
      )}
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
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onActivate}
      onKeyDown={e => { if (e.key === 's' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSave() } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 12px',
        height: 'var(--header-h)',
        cursor: 'pointer',
        borderRight: '1px solid var(--color-border)',
        background: active ? 'var(--color-bg-editor)' : 'transparent',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
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
      <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {tab.name}
      </span>
      {/* VS Code-style close/dirty button: shows × always on hover, dot when dirty and not hovering */}
      <button
        onClick={e => {
          e.stopPropagation()
          if (tab.isDirty && !hovered) return
          onClose()
        }}
        title={tab.isDirty ? 'Unsaved changes — click to close' : 'Close'}
        style={{
          width: 16, height: 16,
          borderRadius: 3,
          border: 'none',
          background: 'transparent',
          color: tab.isDirty && !hovered ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
          marginLeft: 2,
          flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(128,128,128,0.15)'; e.currentTarget.style.color = 'var(--color-text-primary)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = tab.isDirty ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
      >
        {tab.isDirty && !hovered ? (
          // White dot when dirty and not hovering
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-text-primary)' }} />
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        )}
      </button>
    </div>
  )
}

function ResizeHandle({ onDrag, onCollapse, collapseDirection }: {
  onDrag: (dx: number) => void
  onCollapse?: () => void
  collapseDirection?: 'left' | 'right'
}) {
  const dragging = useRef(false)
  const lastX = useRef(0)
  const [hovered, setHovered] = useState(false)

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width: 8, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Drag track */}
      <div
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute', inset: 0,
          background: hovered ? 'var(--color-brand)' : 'var(--color-border)',
          cursor: 'col-resize',
          width: 4,
          left: 2,
          transition: 'background 150ms ease',
        }}
      />
      {/* Collapse chevron */}
      {onCollapse && hovered && (
        <button
          onClick={onCollapse}
          title={collapseDirection === 'left' ? 'Collapse sidebar' : 'Collapse PDF'}
          style={{
            position: 'absolute',
            zIndex: 10,
            width: 16, height: 28,
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            background: 'var(--color-bg-modal)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0,
            boxShadow: 'var(--shadow-md)',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text-primary)'; e.stopPropagation() }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-secondary)' }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {collapseDirection === 'left'
              ? <polyline points="15 18 9 12 15 6"/>
              : <polyline points="9 18 15 12 9 6"/>}
          </svg>
        </button>
      )}
    </div>
  )
}
