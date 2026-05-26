import React, { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import AddRemoteModal from './AddRemoteModal'

interface FileStatus {
  path: string
  status: string
}

interface ContextMenu {
  x: number
  y: number
  file: FileStatus
}

interface GitStatus {
  staged: FileStatus[]
  unstaged: FileStatus[]
  conflicted: string[]
}

interface Props {
  projectPath: string
  onOpenFile: (path: string) => void
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  M: { label: 'M', color: 'var(--badge-warn-color)' },
  A: { label: 'A', color: 'var(--badge-sync-color)' },
  D: { label: 'D', color: 'var(--badge-err-color)' },
  R: { label: 'R', color: 'var(--badge-info-color)' },
  '?': { label: 'U', color: 'var(--badge-muted-color)' },
}

export default function GitPanel({ projectPath, onOpenFile }: Props) {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [commitMsg, setCommitMsg] = useState('')
  const [pushing, setPushing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [showAddRemote, setShowAddRemote] = useState(false)
  const [hasRemote, setHasRemote] = useState(true)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const s = await window.api.gitStatus(projectPath)
      setStatus(s)
    } catch (e) {
      console.error('git status failed', e)
    } finally {
      setLoading(false)
    }
  }, [projectPath])

  useEffect(() => { refresh() }, [refresh])

  function showMsg(text: string, type: 'success' | 'error') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  async function stage(file: string) {
    await window.api.gitStage(projectPath, file)
    refresh()
  }

  async function unstage(file: string) {
    await window.api.gitUnstage(projectPath, file)
    refresh()
  }

  async function stageAll() {
    if (!status) return
    for (const f of status.unstaged) {
      await window.api.gitStage(projectPath, f.path)
    }
    refresh()
  }

  async function unstageAll() {
    if (!status) return
    for (const f of status.staged) {
      await window.api.gitUnstage(projectPath, f.path)
    }
    refresh()
  }

  async function commit() {
    if (!commitMsg.trim()) return
    setCommitting(true)
    try {
      await window.api.gitCommit(projectPath, commitMsg.trim())
      setCommitMsg('')
      showMsg('Commit successful', 'success')
      refresh()
    } catch (e) {
      showMsg(`Commit failed: ${e instanceof Error ? e.message : e}`, 'error')
    } finally {
      setCommitting(false)
    }
  }

  async function push() {
    setPushing(true)
    try {
      const result = await window.api.gitPush(projectPath)
      if (result.success) {
        showMsg('Pushed successfully', 'success')
      } else {
        const isAuthFail = result.error?.includes('Authentication') || result.error?.includes('403') || result.error?.includes('Permission')
        showMsg(isAuthFail ? 'Auth failed — check SSH keys or credentials in system git' : result.error || 'Push failed', 'error')
      }
    } finally {
      setPushing(false)
    }
  }

  async function pull() {
    setPulling(true)
    try {
      const result = await window.api.gitPull(projectPath)
      if (result.success) {
        showMsg('Pulled successfully', 'success')
        refresh()
      } else if (result.hasConflicts) {
        showMsg('Pull succeeded with conflicts — resolve them in the editor', 'error')
        refresh()
      } else {
        showMsg(result.error || 'Pull failed', 'error')
      }
    } finally {
      setPulling(false)
    }
  }

  async function fetch_() {
    setFetching(true)
    try {
      const result = await window.api.gitFetch(projectPath)
      if (result.success) {
        showMsg('Fetched successfully', 'success')
      } else {
        showMsg(result.error || 'Fetch failed', 'error')
      }
    } finally {
      setFetching(false)
    }
  }

  async function addToGitignore(pattern: string) {
    const gitignorePath = `${projectPath}/.gitignore`
    const content = (await window.api.readFile(gitignorePath)) ?? ''
    const lines = content.split('\n').map(l => l.trim())
    if (!lines.includes(pattern)) {
      const sep = content.length > 0 && !content.endsWith('\n') ? '\n' : ''
      await window.api.writeFile(gitignorePath, content + sep + pattern + '\n')
    }
    refresh()
  }

  async function deleteFile(filePath: string) {
    try {
      await window.api.deleteFile(`${projectPath}/${filePath}`)
      refresh()
    } catch (e) {
      showMsg(`Delete failed: ${e instanceof Error ? e.message : e}`, 'error')
    }
  }

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => { window.removeEventListener('click', close); window.removeEventListener('contextmenu', close) }
  }, [contextMenu])

  const hasStaged = (status?.staged.length ?? 0) > 0
  const hasUnstaged = (status?.unstaged.length ?? 0) > 0
  const hasConflicts = (status?.conflicted.length ?? 0) > 0

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
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Source Control
        </span>
        <button className="btn btn-ghost btn-icon" onClick={refresh} title="Refresh" style={{ width: 24, height: 24, color: 'var(--color-text-muted)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div className="spinner" style={{ color: 'var(--color-brand)', width: 16, height: 16 }} />
          </div>
        ) : (
          <>
            {/* Conflicts */}
            {hasConflicts && (
              <div style={{ padding: '8px 10px', background: 'var(--badge-err-bg)', borderBottom: '1px solid var(--badge-err-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-error)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertTriangle size={11} strokeWidth={2.5} />
                  MERGE CONFLICTS
                </div>
                {status!.conflicted.map(f => (
                  <div
                    key={f}
                    onClick={() => onOpenFile(`${projectPath}/${f}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', cursor: 'pointer', borderRadius: 4, fontSize: 12, color: 'var(--color-text-error)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--badge-err-bg-hover, var(--badge-err-bg))' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    {f}
                  </div>
                ))}
              </div>
            )}

            {/* Staged */}
            <SectionHeader
              title="Staged Changes"
              count={status?.staged.length}
              onAction={hasStaged ? unstageAll : undefined}
              actionLabel="Unstage All"
            />
            {status?.staged.map(f => (
              <FileRow
                key={`s_${f.path}`}
                file={f}
                action="unstage"
                onAction={() => unstage(f.path)}
                onClick={() => onOpenFile(`${projectPath}/${f.path}`)}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, file: f }) }}
              />
            ))}
            {status?.staged.length === 0 && (
              <div style={{ padding: '4px 12px', fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No staged changes</div>
            )}

            {/* Unstaged */}
            <SectionHeader
              title="Changes"
              count={status?.unstaged.length}
              onAction={hasUnstaged ? stageAll : undefined}
              actionLabel="Stage All"
            />
            {status?.unstaged.map(f => (
              <FileRow
                key={`u_${f.path}`}
                file={f}
                action="stage"
                onAction={() => stage(f.path)}
                onClick={() => onOpenFile(`${projectPath}/${f.path}`)}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, file: f }) }}
              />
            ))}
            {status?.unstaged.length === 0 && (
              <div style={{ padding: '4px 12px', fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No unstaged changes</div>
            )}
          </>
        )}
      </div>

      {/* Commit area */}
      <div style={{ borderTop: '1px solid var(--color-border)', padding: 10, flexShrink: 0 }}>
        <textarea
          className="input"
          placeholder="Commit message…"
          value={commitMsg}
          onChange={e => setCommitMsg(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) commit() }}
          style={{ marginBottom: 8, minHeight: 60, fontSize: 12, resize: 'vertical' }}
        />
        <button
          className="btn btn-primary w-full"
          onClick={commit}
          disabled={!hasStaged || !commitMsg.trim() || committing}
          style={{ marginBottom: 6 }}
        >
          {committing ? <><div className="spinner" style={{ width: 12, height: 12 }} /> Committing...</> : 'Commit'}
        </button>

        {/* Remote actions */}
        {!hasRemote ? (
          <button
            className="btn btn-secondary w-full btn-sm"
            onClick={() => setShowAddRemote(true)}
          >
            Connect to Remote
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={fetch_} disabled={fetching}>
              {fetching ? '...' : 'Fetch'}
            </button>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={pull} disabled={pulling}>
              {pulling ? '...' : 'Pull'}
            </button>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={push} disabled={pushing}>
              {pushing ? '...' : 'Push'}
            </button>
          </div>
        )}
      </div>

      {/* Status message */}
      {message && (
        <div
          className="selectable"
          style={{
            padding: '8px 12px',
            fontSize: 12,
            color: message.type === 'success' ? 'var(--badge-sync-color)' : 'var(--color-text-error)',
            background: message.type === 'success' ? 'var(--badge-sync-bg)' : 'var(--badge-err-bg)',
            borderTop: `1px solid ${message.type === 'success' ? 'var(--badge-sync-border)' : 'var(--badge-err-border)'}`,
            flexShrink: 0,
          }}
        >
          {message.text}
        </div>
      )}

      {showAddRemote && (
        <AddRemoteModal
          projectPath={projectPath}
          onClose={() => setShowAddRemote(false)}
          onAdded={() => { setShowAddRemote(false); setHasRemote(true); refresh() }}
        />
      )}

      {contextMenu && (() => {
        const filePath = contextMenu.file.path
        const fileName = filePath.split('/').pop() ?? filePath
        const ext = fileName.includes('.') ? fileName.split('.').pop() : null
        const enclosingDir = filePath.includes('/') ? filePath.split('/').slice(0, -1).join('/') + '/' : null
        const ignoreIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        const trashIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        return (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: contextMenu.y, left: contextMenu.x,
              background: 'var(--color-bg-modal)',
              border: '1px solid var(--color-border)',
              borderRadius: 8, padding: 4, zIndex: 2000,
              minWidth: 210, boxShadow: 'var(--shadow-md)',
            }}
          >
            <GitContextMenuItem
              label="Add file to .gitignore"
              icon={ignoreIcon}
              onClick={() => { addToGitignore(filePath); setContextMenu(null) }}
            />
            {ext && (
              <GitContextMenuItem
                label={`Add *.${ext} to .gitignore`}
                icon={ignoreIcon}
                onClick={() => { addToGitignore(`*.${ext}`); setContextMenu(null) }}
              />
            )}
            {enclosingDir && (
              <GitContextMenuItem
                label="Add enclosing folder to .gitignore"
                icon={ignoreIcon}
                onClick={() => { addToGitignore(enclosingDir); setContextMenu(null) }}
              />
            )}
            <div style={{ height: 1, background: 'var(--color-border)', margin: '3px 6px' }} />
            <GitContextMenuItem
              label="Delete file"
              icon={trashIcon}
              onClick={() => { deleteFile(filePath); setContextMenu(null) }}
              danger
            />
          </div>
        )
      })()}
    </div>
  )
}

function SectionHeader({ title, count, onAction, actionLabel }: {
  title: string
  count?: number
  onAction?: () => void
  actionLabel?: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 10px 3px',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title} {count !== undefined && count > 0 && `(${count})`}
      </span>
      {onAction && (
        <button className="btn btn-ghost btn-sm" onClick={onAction} style={{ fontSize: 10, padding: '2px 6px', color: 'var(--color-text-muted)' }}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function FileRow({ file, action, onAction, onClick, onContextMenu }: {
  file: FileStatus
  action: 'stage' | 'unstage'
  onAction: () => void
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const meta = STATUS_LABELS[file.status] || { label: '?', color: 'var(--badge-muted-color)' }

  return (
    <div
      onContextMenu={onContextMenu}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 10px',
        fontSize: 12,
        cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-card-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ color: meta.color, fontWeight: 700, fontSize: 11, minWidth: 12, flexShrink: 0 }}>
        {meta.label}
      </span>
      <span
        onClick={onClick}
        style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}
      >
        {file.path}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onAction() }}
        title={action === 'stage' ? 'Stage' : 'Unstage'}
        style={{
          width: 18, height: 18, border: 'none',
          background: 'transparent', cursor: 'pointer',
          color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 3, padding: 0, flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-card-hover)'; e.currentTarget.style.color = 'var(--color-text-primary)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)' }}
      >
        {action === 'stage' ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        )}
      </button>
    </div>
  )
}

function GitContextMenuItem({ label, icon, onClick, danger }: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', borderRadius: 5, cursor: 'pointer',
        color: danger ? 'var(--color-text-error)' : 'var(--color-text-primary)', fontSize: 12,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? 'var(--badge-err-bg)' : 'var(--color-bg-card-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ color: danger ? 'var(--color-text-error)' : 'var(--color-text-muted)', flexShrink: 0 }}>{icon}</span>
      {label}
    </div>
  )
}
