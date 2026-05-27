import React, { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { ProjectInfo } from '@shared/types'

interface Props {
  project: ProjectInfo
  onOpen: () => void
  onContextMenu: (e: React.MouseEvent) => void
  badgeFlashKey?: number
  isRenaming?: boolean
  onRenameCommit?: (newName: string) => void
  onRenameCancel?: () => void
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 30) return d.toLocaleDateString()
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}

const badgeBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  fontSize: 11, fontWeight: 600,
  borderRadius: 5, padding: '2px 8px',
  flexShrink: 0,
}

function SyncBadge({ project, flashKey }: { project: ProjectInfo; flashKey: number }) {
  const flash = flashKey > 0
  if (!project.hasRemote) {
    return <span style={{ ...badgeBase, visibility: 'hidden' }}>x</span>
  }

  const cls = flash ? 'sync-badge-flash' : ''

  if (project.hasConflicts) {
    return (
      <span key={flashKey} className={cls} style={{ ...badgeBase, color: 'var(--badge-err-color)', background: 'var(--badge-err-bg)', border: '1px solid var(--badge-err-border)' }}>
        <AlertTriangle size={9} strokeWidth={2.5} />
        Conflict
      </span>
    )
  }

  if (!project.syncStatusKnown) {
    return (
      <span key={flashKey} className={cls} style={{ ...badgeBase, fontWeight: 500, color: 'var(--badge-muted-color)', background: 'var(--badge-muted-bg)', border: '1px solid var(--badge-muted-border)' }}>
        Not fetched
      </span>
    )
  }

  if (project.behindBy === 0 && project.aheadBy === 0) {
    return (
      <span key={flashKey} className={cls} style={{ ...badgeBase, fontWeight: 500, color: 'var(--badge-sync-color)', background: 'var(--badge-sync-bg)', border: '1px solid var(--badge-sync-border)' }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Synced
      </span>
    )
  }

  // ↑ = remote ahead of you (need to pull); ↓ = you ahead of remote (need to push)
  const parts: React.ReactNode[] = []
  if (project.behindBy > 0) {
    parts.push(
      <span key="behind" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
        </svg>
        {project.behindBy} behind
      </span>
    )
  }
  if (project.aheadBy > 0) {
    parts.push(
      <span key="ahead" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
        </svg>
        {project.aheadBy} ahead
      </span>
    )
  }

  return (
    <span key={flashKey} className={cls} style={{ ...badgeBase, color: 'var(--badge-warn-color)', background: 'var(--badge-warn-bg)', border: '1px solid var(--badge-warn-border)' }}>
      {parts}
    </span>
  )
}

export default function ProjectCard({
  project,
  onOpen,
  onContextMenu,
  badgeFlashKey = 0,
  isRenaming = false,
  onRenameCommit,
  onRenameCancel,
}: Props) {
  return (
    <div
      onClick={isRenaming ? undefined : onOpen}
      onContextMenu={onContextMenu}
      style={{
        background: isRenaming ? 'var(--color-bg-card-hover)' : 'var(--color-bg-card)',
        border: `1px solid ${isRenaming ? 'var(--color-brand)' : 'var(--color-border)'}`,
        borderRadius: 10,
        padding: 20,
        cursor: isRenaming ? 'default' : 'pointer',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={e => {
        if (isRenaming) return
        e.currentTarget.style.background = 'var(--color-bg-card-hover)'
        e.currentTarget.style.borderColor = 'var(--color-brand-dark)'
      }}
      onMouseLeave={e => {
        if (isRenaming) return
        e.currentTarget.style.background = 'var(--color-bg-card)'
        e.currentTarget.style.borderColor = 'var(--color-border)'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(76,175,80,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: '#4CAF50',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            {isRenaming ? (
              <RenameInput
                initial={project.name}
                onCommit={name => onRenameCommit?.(name)}
                onCancel={() => onRenameCancel?.()}
              />
            ) : (
              <div style={{
                fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {project.name}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', visibility: project.remoteUrl ? 'visible' : 'hidden' }}>
              {project.remoteUrl || 'x'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4, flexShrink: 0 }}>
          <SyncBadge project={project} flashKey={badgeFlashKey} />
          <span className={project.dirtyCount > 0 ? 'badge badge-blue' : ''} style={{ justifyContent: 'center', visibility: project.dirtyCount > 0 ? 'visible' : 'hidden', fontSize: 11, padding: '2px 8px' }}>
            {project.dirtyCount > 0 ? `${project.dirtyCount} change${project.dirtyCount !== 1 ? 's' : ''}` : 'x'}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: 12 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="6" y1="3" x2="6" y2="15"/>
            <circle cx="18" cy="6" r="3"/>
            <circle cx="6" cy="18" r="3"/>
            <path d="M18 9a9 9 0 0 1-9 9"/>
          </svg>
          {project.branch}
        </span>

        {project.lastCommitDate && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {timeAgo(project.lastCommitDate)}
          </span>
        )}

        {!project.hasRemote && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="2" y1="2" x2="22" y2="22"/>
              <path d="M10.59 10.59a2 2 0 1 1 2.83 2.83"/>
              <path d="M13.73 7.27A2 2 0 1 0 10.9 10.1"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
            Local only
          </span>
        )}
      </div>

      <div style={{
        marginTop: 10, paddingTop: 10,
        borderTop: project.lastCommit ? '1px solid var(--color-border)' : '1px solid transparent',
        fontSize: 12, color: 'var(--color-text-secondary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        visibility: project.lastCommit ? 'visible' : 'hidden',
      }}>
        {project.lastCommit || 'x'}
      </div>
    </div>
  )
}

function RenameInput({ initial, onCommit, onCancel }: {
  initial: string
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [])

  function commit() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === initial) onCancel()
    else onCommit(trimmed)
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => setValue(e.target.value)}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        e.stopPropagation()
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={commit}
      style={{
        width: '100%',
        background: 'var(--color-bg-input)',
        border: '1px solid var(--color-brand)',
        borderRadius: 5,
        color: 'var(--color-text-primary)',
        fontSize: 14,
        fontWeight: 600,
        padding: '3px 7px',
        outline: 'none',
        fontFamily: 'inherit',
      }}
    />
  )
}
