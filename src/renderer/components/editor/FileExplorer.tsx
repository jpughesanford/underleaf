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
  node: FileNode | null  // null = background (project root) right-click
}

interface Creating {
  parentPath: string
  type: 'file' | 'folder'
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

const BINARY_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'mp4', 'mp3', 'zip', 'tar', 'gz', 'dmg', 'exe'])

function FileIcon({ extension }: { extension?: string }) {
  const icon = extension ? FILE_ICONS[extension.toLowerCase()] : '📄'
  return <span style={{ fontSize: 12 }}>{icon || '📄'}</span>
}

// Inline input for new file/folder creation
function InlineCreate({ type, onConfirm, onCancel }: {
  type: 'file' | 'folder'
  onConfirm: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function submit() {
    const trimmed = name.trim()
    if (trimmed) onConfirm(trimmed)
    else onCancel()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 22px' }}>
      <span style={{ fontSize: 12 }}>{type === 'folder' ? '📁' : '📄'}</span>
      <input
        ref={inputRef}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={submit}
        placeholder={type === 'folder' ? 'folder name' : 'filename.tex'}
        style={{
          flex: 1,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid var(--color-brand)',
          borderRadius: 4,
          color: '#e2e8f0',
          fontSize: 12,
          padding: '2px 6px',
          outline: 'none',
        }}
      />
    </div>
  )
}

function FileTreeNode({
  node,
  depth,
  activeFile,
  mainDoc,
  detectedMainDoc,
  showHidden,
  creating,
  draggingPath,
  dragOverPath,
  onOpenFile,
  onContextMenu,
  onCreate,
  onCancelCreate,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  node: FileNode
  depth: number
  activeFile: string | null
  mainDoc?: string | null
  detectedMainDoc?: string | null
  showHidden: boolean
  creating: Creating | null
  draggingPath: string | null
  dragOverPath: string | null
  onOpenFile: (path: string) => void
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void
  onCreate: (parentPath: string, type: 'file' | 'folder', name: string) => void
  onCancelCreate: () => void
  onDragStart: (path: string) => void
  onDragEnd: () => void
  onDragOver: (path: string | null) => void
  onDrop: (targetDirPath: string, e: React.DragEvent) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isActive = node.path === activeFile
  const isMain = !!(mainDoc && node.relativePath === mainDoc)
  const isDetected = !isMain && !!(detectedMainDoc && node.relativePath === detectedMainDoc)
  const isDragOver = dragOverPath === node.path

  if (!showHidden && node.name.startsWith('.')) return null

  if (node.isDirectory) {
    // Auto-expand when it's the drag target
    useEffect(() => {
      if (isDragOver) setExpanded(true)
    }, [isDragOver])

    return (
      <div>
        <div
          onClick={() => setExpanded(v => !v)}
          onContextMenu={e => onContextMenu(e, node)}
          draggable
          onDragStart={e => { e.stopPropagation(); onDragStart(node.path) }}
          onDragEnd={onDragEnd}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); onDragOver(node.path) }}
          onDragLeave={e => { e.stopPropagation(); onDragOver(null) }}
          onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop(node.path, e) }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            paddingLeft: 8 + depth * 14,
            cursor: 'pointer',
            color: isDragOver ? '#4CAF50' : '#94a3b8',
            fontSize: 12,
            userSelect: 'none',
            background: isDragOver ? 'rgba(76,175,80,0.1)' : 'transparent',
            borderRadius: isDragOver ? 4 : 0,
            outline: isDragOver ? '1px dashed rgba(76,175,80,0.5)' : 'none',
          }}
          onMouseEnter={e => { if (!isDragOver) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
          onMouseLeave={e => { if (!isDragOver) e.currentTarget.style.background = 'transparent' }}
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
        {expanded && (
          <>
            {creating?.parentPath === node.path && (
              <div style={{ paddingLeft: 8 + (depth + 1) * 14 }}>
                <InlineCreate
                  type={creating.type}
                  onConfirm={name => onCreate(node.path, creating.type, name)}
                  onCancel={onCancelCreate}
                />
              </div>
            )}
            {node.children?.map(child => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                activeFile={activeFile}
                mainDoc={mainDoc}
                detectedMainDoc={detectedMainDoc}
                showHidden={showHidden}
                creating={creating}
                draggingPath={draggingPath}
                dragOverPath={dragOverPath}
                onOpenFile={onOpenFile}
                onContextMenu={onContextMenu}
                onCreate={onCreate}
                onCancelCreate={onCancelCreate}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOver={onDragOver}
                onDrop={onDrop}
              />
            ))}
          </>
        )}
      </div>
    )
  }

  const isEditable = !BINARY_EXTENSIONS.has(node.extension?.toLowerCase() ?? '')
  const isBeingDragged = draggingPath === node.path

  return (
    <div
      onClick={() => isEditable && onOpenFile(node.path)}
      onContextMenu={e => onContextMenu(e, node)}
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart(node.path) }}
      onDragEnd={onDragEnd}
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
        opacity: isBeingDragged ? 0.4 : 1,
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
  const [creating, setCreating] = useState<Creating | null>(null)
  const [draggingPath, setDraggingPath] = useState<string | null>(null)
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)
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

  function handleContextMenu(e: React.MouseEvent, node: FileNode | null) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }

  async function handleCreate(parentPath: string, type: 'file' | 'folder', name: string) {
    const fullPath = `${parentPath}/${name}`
    try {
      if (type === 'folder') {
        await window.api.mkdir(fullPath)
      } else {
        await window.api.writeFile(fullPath, '')
        onOpenFile(fullPath)
      }
      await refresh()
    } catch (e) {
      console.error('Create failed', e)
    }
    setCreating(null)
  }

  async function handleDrop(targetDirPath: string, e: React.DragEvent) {
    // Capture draggingPath before clearing state
    const srcPath = draggingPath
    setDragOverPath(null)
    setDraggingPath(null)

    // External files dragged from OS (Finder)
    if (e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files)
      for (const file of files) {
        const filePath = window.api.getPathForFile(file)
        if (!filePath) continue
        const destPath = `${targetDirPath}/${file.name}`
        try {
          await window.api.copyFile(filePath, destPath)
        } catch (err) {
          console.error('Copy failed', err)
        }
      }
      await refresh()
      return
    }

    // Internal drag (move file/folder within explorer)
    if (srcPath && srcPath !== targetDirPath) {
      const name = srcPath.split('/').pop()!
      const destPath = `${targetDirPath}/${name}`
      try {
        await window.api.renameFile(srcPath, destPath)
        await refresh()
      } catch (err) {
        console.error('Move failed', err)
      }
    }
  }

  // Track drag-over depth to avoid flickering when crossing child element boundaries
  const rootDragDepth = useRef(0)

  function handleRootDragEnter(e: React.DragEvent) {
    e.preventDefault()
    rootDragDepth.current++
    setDragOverPath(projectPath)
  }

  function handleRootDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (dragOverPath === null) setDragOverPath(projectPath)
  }

  function handleRootDragLeave(e: React.DragEvent) {
    rootDragDepth.current--
    if (rootDragDepth.current <= 0) {
      rootDragDepth.current = 0
      setDragOverPath(null)
    }
  }

  function handleRootDrop(e: React.DragEvent) {
    e.preventDefault()
    rootDragDepth.current = 0
    // Only handle if the drop target is the root (not a child folder)
    if (dragOverPath === projectPath || dragOverPath === null) {
      handleDrop(projectPath, e)
    }
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
            onClick={() => { setCreating({ parentPath: projectPath, type: 'file' }) }}
            title="New File"
            style={{ width: 24, height: 24, color: '#64748b' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="13" x2="12" y2="19"/>
              <line x1="9" y1="16" x2="15" y2="16"/>
            </svg>
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => { setCreating({ parentPath: projectPath, type: 'folder' }) }}
            title="New Folder"
            style={{ width: 24, height: 24, color: '#64748b' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              <line x1="12" y1="11" x2="12" y2="17"/>
              <line x1="9" y1="14" x2="15" y2="14"/>
            </svg>
          </button>
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
      <div
        style={{
          flex: 1, overflow: 'auto', paddingTop: 4, paddingBottom: 8,
          outline: dragOverPath === projectPath ? '1px dashed rgba(76,175,80,0.4)' : 'none',
          background: dragOverPath === projectPath ? 'rgba(76,175,80,0.03)' : 'transparent',
        }}
        onDragEnter={handleRootDragEnter}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
        onContextMenu={e => handleContextMenu(e, null)}
      >
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div className="spinner" style={{ color: 'var(--color-brand)', width: 16, height: 16 }} />
          </div>
        ) : (
          <>
            {creating?.parentPath === projectPath && (
              <InlineCreate
                type={creating.type}
                onConfirm={name => handleCreate(projectPath, creating.type, name)}
                onCancel={() => setCreating(null)}
              />
            )}
            {tree.map(node => (
              <FileTreeNode
                key={node.path}
                node={node}
                depth={0}
                activeFile={activeFile}
                mainDoc={mainDoc}
                detectedMainDoc={detectedMainDoc}
                showHidden={showHidden}
                creating={creating}
                draggingPath={draggingPath}
                dragOverPath={dragOverPath}
                onOpenFile={onOpenFile}
                onContextMenu={handleContextMenu}
                onCreate={handleCreate}
                onCancelCreate={() => setCreating(null)}
                onDragStart={setDraggingPath}
                onDragEnd={() => { setDraggingPath(null); setDragOverPath(null) }}
                onDragOver={setDragOverPath}
                onDrop={handleDrop}
              />
            ))}
          </>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (() => {
        const node = contextMenu.node
        // The "parent" path for new file/folder creation: folder node's own path, file node's dir, or project root
        const createParent = node
          ? (node.isDirectory ? node.path : node.path.split('/').slice(0, -1).join('/'))
          : projectPath
        const finderPath = node ? node.path : projectPath
        const terminalPath = node && !node.isDirectory
          ? node.path.split('/').slice(0, -1).join('/')
          : (node ? node.path : projectPath)

        const newFileIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="13" x2="12" y2="19"/><line x1="9" y1="16" x2="15" y2="16"/></svg>
        const newFolderIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
        const finderIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        const terminalIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>

        return (
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
              minWidth: 200,
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {/* Set as main doc — only for .tex files */}
            {node && !node.isDirectory && node.extension === 'tex' && onSetMainDoc && (
              <>
                <ContextMenuItem
                  label="Set as Main Document"
                  icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
                  onClick={() => { onSetMainDoc(node.relativePath); setContextMenu(null) }}
                />
                <Separator />
              </>
            )}

            {/* Open file — only for non-directory nodes */}
            {node && !node.isDirectory && (
              <ContextMenuItem
                label="Open File"
                icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                onClick={() => { onOpenFile(node.path); setContextMenu(null) }}
              />
            )}

            {/* New file / folder — always available */}
            <ContextMenuItem
              label="New File"
              icon={newFileIcon}
              onClick={() => { setCreating({ parentPath: createParent, type: 'file' }); setContextMenu(null) }}
            />
            <ContextMenuItem
              label="New Folder"
              icon={newFolderIcon}
              onClick={() => { setCreating({ parentPath: createParent, type: 'folder' }); setContextMenu(null) }}
            />

            <Separator />

            {/* Open in Finder */}
            <ContextMenuItem
              label="Open in Finder"
              icon={finderIcon}
              onClick={() => { window.api.showInFinder(finderPath); setContextMenu(null) }}
            />
            <ContextMenuItem
              label="Open in Terminal"
              icon={terminalIcon}
              onClick={() => { window.api.openInTerminal(terminalPath); setContextMenu(null) }}
            />

            {/* Delete — only for actual nodes, not background */}
            {node && (
              <>
                <Separator />
                <ContextMenuItem
                  label="Delete"
                  icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>}
                  onClick={async () => {
                    try {
                      await window.api.deleteFile(node.path)
                      refresh()
                    } catch (e) {
                      console.error('Delete failed', e)
                    }
                    setContextMenu(null)
                  }}
                  danger
                />
              </>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function Separator() {
  return <div style={{ height: 1, background: 'var(--color-border)', margin: '3px 6px' }} />
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
