import React, { useState, useEffect, useCallback, useRef } from 'react'

interface FileNode {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  children?: FileNode[]
  extension?: string
}

interface ContextMenu {
  x: number
  y: number
  node: FileNode
}

interface Props {
  projectPath: string
  activeFile: string | null
  onOpenFile: (path: string) => void
  mainDoc?: string | null
  detectedMainDoc?: string | null
  onSetMainDoc?: (relativePath: string) => void
}

const FILE_ICONS: Record<string, string> = {
  tex: '📄',
  bib: '📚',
  pdf: '📕',
  png: '🖼️',
  jpg: '🖼️',
  jpeg: '🖼️',
  svg: '🖼️',
  md: '📝',
  txt: '📃',
  cls: '📋',
  sty: '📋',
  bst: '📋',
}

function FileIcon({ extension }: { extension?: string }) {
  const icon = extension ? FILE_ICONS[extension.toLowerCase()] : '📄'
  return <span style={{ fontSize: 12 }}>{icon || '📄'}</span>
}

function FileTreeNode({
  node,
  depth,
  activeFile,
  mainDoc,
  detectedMainDoc,
  showHidden,
  onOpenFile,
  onContextMenu,
}: {
  node: FileNode
  depth: number
  activeFile: string | null
  mainDoc?: string | null
  detectedMainDoc?: string | null
  showHidden: boolean
  onOpenFile: (path: string) => void
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isActive = node.path === activeFile
  const isMain = !!(mainDoc && node.relativePath === mainDoc)
  const isDetected = !isMain && !!(detectedMainDoc && node.relativePath === detectedMainDoc)

  if (!showHidden && node.name.startsWith('.')) return null

  if (node.isDirectory) {
    return (
      <div>
        <div
          onClick={() => setExpanded(v => !v)}
          onContextMenu={e => onContextMenu(e, node)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            paddingLeft: 8 + depth * 14,
            cursor: 'pointer',
            color: '#94a3b8',
            fontSize: 12,
            userSelect: 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms', flexShrink: 0 }}
          >
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: '#4CAF50' }}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
        </div>
        {expanded && node.children?.map(child => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFile={activeFile}
            mainDoc={mainDoc}
            detectedMainDoc={detectedMainDoc}
            showHidden={showHidden}
            onOpenFile={onOpenFile}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
    )
  }

  const BINARY_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'mp4', 'mp3', 'zip', 'tar', 'gz', 'dmg', 'exe'])
  const isEditable = !node.isDirectory && !BINARY_EXTENSIONS.has(node.extension?.toLowerCase() ?? '')

  return (
    <div
      onClick={() => isEditable && onOpenFile(node.path)}
      onContextMenu={e => onContextMenu(e, node)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        paddingLeft: 8 + depth * 14 + 14,
        cursor: isEditable ? 'pointer' : 'default',
        color: isActive ? '#e2e8f0' : '#94a3b8',
        background: isActive ? 'rgba(76,175,80,0.15)' : 'transparent',
        fontSize: 12,
        userSelect: 'none',
        borderLeft: isActive ? '2px solid #4CAF50' : '2px solid transparent',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      <FileIcon extension={node.extension} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {node.name}
      </span>
      {isMain && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: '#4CAF50',
          background: 'rgba(76,175,80,0.15)',
          border: '1px solid rgba(76,175,80,0.4)',
          borderRadius: 3, padding: '1px 4px',
          flexShrink: 0, letterSpacing: 0.3,
        }}>
          ROOT
        </span>
      )}
      {isDetected && (
        <span
          title="Auto-detected root document — right-click to set explicitly"
          style={{
            fontSize: 9, fontWeight: 600, color: '#64748b',
            background: 'transparent',
            border: '1px dashed #475569',
            borderRadius: 3, padding: '1px 4px',
            flexShrink: 0, letterSpacing: 0.3,
          }}
        >
          ROOT
        </span>
      )}
    </div>
  )
}

export default function FileExplorer({ projectPath, activeFile, onOpenFile, mainDoc, detectedMainDoc, onSetMainDoc }: Props) {
  const [tree, setTree] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(true)
  const [showHidden, setShowHidden] = useState(true)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const nodes = await window.api.fileTree(projectPath)
      setTree(nodes)
    } finally {
      setLoading(false)
    }
  }, [projectPath])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
    }
  }, [contextMenu])

  function handleContextMenu(e: React.MouseEvent, node: FileNode) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '8px 10px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Files
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setShowHidden(v => !v)}
            title={showHidden ? 'Hide dotfiles' : 'Show dotfiles'}
            style={{ width: 24, height: 24, color: showHidden ? '#64748b' : '#334155' }}
          >
            {showHidden ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            )}
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={refresh}
            title="Refresh"
            style={{ width: 24, height: 24, color: '#64748b' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflow: 'auto', paddingTop: 4, paddingBottom: 8 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div className="spinner" style={{ color: 'var(--color-brand)', width: 16, height: 16 }} />
          </div>
        ) : (
          tree.map(node => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              activeFile={activeFile}
              mainDoc={mainDoc}
              detectedMainDoc={detectedMainDoc}
              showHidden={showHidden}
              onOpenFile={onOpenFile}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--color-bg-modal)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 4,
            zIndex: 2000,
            minWidth: 180,
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {contextMenu.node.extension === 'tex' && onSetMainDoc && (
            <ContextMenuItem
              label="Set as Main Document"
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              }
              onClick={() => {
                onSetMainDoc(contextMenu.node.relativePath)
                setContextMenu(null)
              }}
            />
          )}
          <ContextMenuItem
            label="Open File"
            icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            }
            onClick={() => {
              onOpenFile(contextMenu.node.path)
              setContextMenu(null)
            }}
            disabled={contextMenu.node.isDirectory}
          />
          <div style={{ height: 1, background: 'var(--color-border)', margin: '3px 6px' }} />
          <ContextMenuItem
            label="Delete"
            icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            }
            onClick={async () => {
              try {
                await window.api.deleteFile(contextMenu.node.path)
                refresh()
              } catch (e) {
                console.error('Delete failed', e)
              }
              setContextMenu(null)
            }}
            danger
          />
        </div>
      )}
    </div>
  )
}

function ContextMenuItem({ label, icon, onClick, disabled, danger }: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', borderRadius: 5,
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#475569' : danger ? '#f87171' : '#e2e8f0',
        fontSize: 12,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = danger ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ color: disabled ? '#475569' : danger ? '#f87171' : '#64748b', flexShrink: 0 }}>{icon}</span>
      {label}
    </div>
  )
}
