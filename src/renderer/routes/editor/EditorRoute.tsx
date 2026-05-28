import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { CompileTarget } from '@shared/types'
import { resolveErrorPath } from '@shared/error-path'

import { SettingsModal } from '@/features/settings'
import { EditorPane, type EditorPaneHandle } from '@/features/code-editor'
import { FileExplorer } from '@/features/file-explorer'
import { GitPanel } from '@/features/git-panel'
import { CompilePanel } from '@/features/compile-panel'
import { PdfPane } from '@/features/pdf-viewer'

import Toolbar from './components/Toolbar'
import RailButton from './components/RailButton'
import TabItem from './components/TabItem'
import ResizeHandle from './components/ResizeHandle'
import EmptyEditor from './components/EmptyEditor'
import { CompileIcon, FilesIcon, GitIcon } from './components/RailIcons'

import { useMainDoc } from './hooks/useMainDoc'
import { useOpenTabs } from './hooks/useOpenTabs'
import { useCompile } from './hooks/useCompile'
import { useEditorLayout } from './hooks/useEditorLayout'

interface Props {
  projectPath: string
  projectName: string
  onBack: () => void
  onRename: (newPath: string, newName: string) => void
}

export default function EditorRoute({ projectPath, projectName, onBack, onRename }: Props) {
  const [compileTarget, setCompileTarget] = useState<CompileTarget>('root')
  const [compileOnSave, setCompileOnSave] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const editorRef = useRef<EditorPaneHandle>(null)

  // Load compile-on-save preference; reloaded after the settings modal closes.
  useEffect(() => {
    window.api.store.get('settings').then((s) => {
      const settings = s as { compileOnSave?: boolean } | null
      if (settings?.compileOnSave !== undefined) setCompileOnSave(settings.compileOnSave)
    })
  }, [])

  // ── Feature hooks ──────────────────────────────────────────────────────
  const { mainDoc, detectedMainDoc, setMainDoc } = useMainDoc(projectPath)
  const tabs = useOpenTabs({
    projectPath,
    rootDocRelative: mainDoc ?? detectedMainDoc,
  })
  const layout = useEditorLayout()
  const { compiling, compileResult, pdfPath, pdfVersion, compile } = useCompile({
    projectPath,
    compileTarget,
    getActiveFile: () => tabs.activeTabRef.current,
    onBeforeCompile: tabs.saveAllDirty,
    onCompileErrored: () => {
      // Auto-jump to the compile tab on errors so the user sees them.
      layout.setSidebarTab('compile')
      layout.setSidebarOpen(true)
    },
  })

  // After a successful compile, swing the split view in if user was editor-only.
  useEffect(() => {
    if (compileResult?.success) {
      layout.setViewMode(v => v === 'editor' ? 'split' : v)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compileResult?.success, pdfVersion])

  // ── Save-then-maybe-compile (used by Cmd-S in the tab + the menu listener) ──
  const saveAndMaybeCompile = useCallback(async (filePath: string) => {
    await tabs.saveFile(filePath)
    if (compileOnSave) await compile()
  }, [tabs, compileOnSave, compile])

  // ── Project rename, with dirty-tab safety ──────────────────────────────
  const handleProjectRename = useCallback(async (newName: string) => {
    if (!newName || newName === projectName) return
    await tabs.saveAllDirty()
    try {
      const newPath = await window.api.projects.rename({ oldPath: projectPath, newName })
      onRename(newPath, newName)  // app.tsx re-keys EditorRoute → clean remount
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Rename failed')
    }
  }, [projectPath, projectName, onRename, tabs])

  // ── Jump-to-error from the compile panel ───────────────────────────────
  const jumpToError = useCallback(async (file: string, line: number | null) => {
    if (!line) return
    await tabs.openFile(resolveErrorPath(projectPath, file))
    // rAF lets React commit a fresh EditorPane (if a new tab opened) before jump.
    requestAnimationFrame(() => editorRef.current?.jump(line))
  }, [projectPath, tabs])

  // ── Menu actions (refs keep latest fns without re-binding the listener) ─
  const compileRef = useRef(compile)
  const compileOnSaveRef = useRef(compileOnSave)
  compileRef.current = compile
  compileOnSaveRef.current = compileOnSave

  useEffect(() => {
    return window.api.events.onMenuAction((action) => {
      switch (action) {
        case 'menu:save': {
          const active = tabs.activeTabRef.current
          if (!active) {
            if (compileOnSaveRef.current) compileRef.current()
            return
          }
          tabs.saveFile(active).then(() => {
            if (compileOnSaveRef.current) compileRef.current()
          })
          return
        }
        case 'menu:openSettings':  setShowSettings(true); return
        case 'menu:viewEditor':    layout.setViewMode('editor'); return
        case 'menu:viewSplit':     layout.setViewMode('split'); return
        case 'menu:viewPdf':       layout.setViewMode('pdf'); return
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg-app)', overflow: 'hidden' }}>
      {showSettings && (
        <SettingsModal
          onClose={async () => {
            setShowSettings(false)
            const s = await window.api.store.get('settings') as { compileOnSave?: boolean } | null
            if (s?.compileOnSave !== undefined) setCompileOnSave(s.compileOnSave)
          }}
          onChangeRoot={() => setShowSettings(false)}
        />
      )}

      <Toolbar
        projectName={projectName}
        onRenameProject={handleProjectRename}
        onBack={onBack}
        onCompile={compile}
        compiling={compiling}
        compileTarget={compileTarget}
        onChangeTarget={setCompileTarget}
        viewMode={layout.viewMode}
        onChangeView={layout.setViewMode}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div ref={layout.bodyRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left rail */}
        <div style={{
          width: 44,
          background: 'var(--color-bg-app)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: 8, gap: 4, flexShrink: 0,
        }}>
          <RailButton
            active={layout.sidebarTab === 'files' && layout.sidebarOpen}
            title="Files"
            onClick={() => layout.toggleSidebarTab('files')}
          >
            <FilesIcon />
          </RailButton>
          <RailButton
            active={layout.sidebarTab === 'git' && layout.sidebarOpen}
            title="Source Control"
            onClick={() => layout.toggleSidebarTab('git')}
          >
            <GitIcon />
          </RailButton>
          {/* Compile tab is only present after the first compile this session.
              Auto-activates on errors via useCompile's onCompileErrored hook. */}
          {(compiling || compileResult) && (
            <RailButton
              active={layout.sidebarTab === 'compile' && layout.sidebarOpen}
              title="Build Output"
              badge={compileResult && compileResult.errors.length > 0 ? 'error'
                : compileResult && compileResult.warnings.length > 0 ? 'warn'
                : undefined}
              onClick={() => layout.toggleSidebarTab('compile')}
            >
              <CompileIcon />
            </RailButton>
          )}
        </div>

        {/* Sidebar panel */}
        {layout.sidebarOpen && layout.viewMode !== 'pdf' && (
          <div style={{
            width: layout.sidebarWidth,
            background: 'var(--color-bg-app)',
            borderRight: '1px solid var(--color-border)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', flexShrink: 0,
          }}>
            {layout.sidebarTab === 'files' && (
              <FileExplorer
                projectPath={projectPath}
                activeFile={tabs.activeTab}
                onOpenFile={tabs.openFile}
                mainDoc={mainDoc}
                detectedMainDoc={detectedMainDoc}
                onSetMainDoc={setMainDoc}
              />
            )}
            {layout.sidebarTab === 'git' && (
              <GitPanel projectPath={projectPath} onOpenFile={tabs.openFile} />
            )}
            {layout.sidebarTab === 'compile' && (
              <CompilePanel result={compileResult} compiling={compiling} onJumpToError={jumpToError} />
            )}
          </div>
        )}

        {layout.sidebarOpen && layout.viewMode !== 'pdf' && (
          <ResizeHandle
            onDrag={layout.onSidebarDrag}
            onCollapse={() => layout.setSidebarOpen(false)}
            collapseDirection="left"
          />
        )}

        {/* Editor */}
        {layout.viewMode !== 'pdf' && (
          // 320px minWidth = the search panel's smallest legible width.
          // Below that the PDF resize handle starts breaking the layout,
          // so the flex item refuses to shrink past it.
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 320 }}>
            {tabs.tabs.length > 0 && (
              <div style={{
                display: 'flex',
                background: 'var(--color-bg-app)',
                borderBottom: '1px solid var(--color-border)',
                overflowX: 'auto', flexShrink: 0,
              }}>
                {tabs.tabs.map(tab => (
                  <TabItem
                    key={tab.path}
                    tab={tab}
                    active={tab.path === tabs.activeTab}
                    onActivate={() => tabs.setActiveTab(tab.path)}
                    onClose={() => tabs.closeTab(tab.path)}
                    onSave={() => saveAndMaybeCompile(tab.path)}
                  />
                ))}
              </div>
            )}

            <div style={{ flex: 1, overflow: 'hidden' }}>
              {tabs.activeTabData ? (
                <EditorPane
                  ref={editorRef}
                  key={tabs.activeTabData.path}
                  filePath={tabs.activeTabData.path}
                  content={tabs.activeTabData.content}
                  onChange={(content) => tabs.updateContent(tabs.activeTabData!.path, content)}
                  onSave={() => saveAndMaybeCompile(tabs.activeTabData!.path)}
                />
              ) : (
                <EmptyEditor />
              )}
            </div>
          </div>
        )}

        {pdfPath && layout.viewMode === 'split' && (
          <ResizeHandle
            onDrag={layout.onPdfDrag}
            onCollapse={() => layout.setViewMode('editor')}
            collapseDirection="right"
          />
        )}

        {pdfPath && (layout.viewMode === 'split' || layout.viewMode === 'pdf') && (
          <div style={{
            width: layout.viewMode === 'pdf' ? undefined : layout.pdfWidth,
            flex: layout.viewMode === 'pdf' ? 1 : undefined,
            flexShrink: 0,
            borderLeft: '1px solid var(--color-border)',
          }}>
            <PdfPane pdfPath={pdfPath} version={pdfVersion} />
          </div>
        )}
      </div>
    </div>
  )
}
