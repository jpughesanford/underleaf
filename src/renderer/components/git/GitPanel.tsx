import React, { useState, useEffect, useCallback } from 'react'
import AddRemoteModal from './AddRemoteModal'

interface FileStatus {
  path: string
  status: string
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
  M: { label: 'M', color: '#fbbf24' },
  A: { label: 'A', color: '#4ade80' },
  D: { label: 'D', color: '#f87171' },
  R: { label: 'R', color: '#60a5fa' },
  '?': { label: 'U', color: '#94a3b8' },
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
        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Source Control
        </span>
        <button className="btn btn-ghost btn-icon" onClick={refresh} title="Refresh" style={{ width: 24, height: 24, color: '#64748b' }}>
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
              <div style={{ padding: '8px 10px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#f87171', marginBottom: 6 }}>
                  ⚠ MERGE CONFLICTS
                </div>
                {status!.conflicted.map(f => (
                  <div
                    key={f}
                    onClick={() => onOpenFile(`${projectPath}/${f}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', cursor: 'pointer', borderRadius: 4, fontSize: 12, color: '#f87171' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
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
              />
            ))}
            {status?.staged.length === 0 && (
              <div style={{ padding: '4px 12px', fontSize: 11, color: '#475569', fontStyle: 'italic' }}>No staged changes</div>
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
              />
            ))}
            {status?.unstaged.length === 0 && (
              <div style={{ padding: '4px 12px', fontSize: 11, color: '#475569', fontStyle: 'italic' }}>No unstaged changes</div>
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
        <div style={{
          padding: '8px 12px',
          fontSize: 12,
          color: message.type === 'success' ? '#4ade80' : '#f87171',
          background: message.type === 'success' ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
          borderTop: `1px solid ${message.type === 'success' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
          flexShrink: 0,
        }}>
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
      <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title} {count !== undefined && count > 0 && `(${count})`}
      </span>
      {onAction && (
        <button className="btn btn-ghost btn-sm" onClick={onAction} style={{ fontSize: 10, padding: '2px 6px', color: '#64748b' }}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function FileRow({ file, action, onAction, onClick }: {
  file: FileStatus
  action: 'stage' | 'unstage'
  onAction: () => void
  onClick: () => void
}) {
  const meta = STATUS_LABELS[file.status] || { label: '?', color: '#94a3b8' }

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 10px',
        fontSize: 12,
        cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ color: meta.color, fontWeight: 700, fontSize: 11, minWidth: 12, flexShrink: 0 }}>
        {meta.label}
      </span>
      <span
        onClick={onClick}
        style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#94a3b8' }}
      >
        {file.path}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onAction() }}
        title={action === 'stage' ? 'Stage' : 'Unstage'}
        style={{
          width: 18, height: 18, border: 'none',
          background: 'transparent', cursor: 'pointer',
          color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 3, padding: 0, flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#e2e8f0' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' }}
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
