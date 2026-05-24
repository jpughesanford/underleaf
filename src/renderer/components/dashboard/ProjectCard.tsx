import React from 'react'

interface ProjectInfo {
  id: string
  name: string
  path: string
  branch: string
  lastCommit: string | null
  lastCommitDate: string | null
  dirtyCount: number
  remoteUrl: string | null
  hasRemote: boolean
}

interface Props {
  project: ProjectInfo
  onOpen: () => void
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

export default function ProjectCard({ project, onOpen }: Props) {
  return (
    <div
      onClick={onOpen}
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: 20,
        cursor: 'pointer',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--color-bg-card-hover)'
        e.currentTarget.style.borderColor = 'rgba(76,175,80,0.4)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--color-bg-card)'
        e.currentTarget.style.borderColor = 'var(--color-border)'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(76,175,80,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            color: '#4CAF50',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontWeight: 600,
              fontSize: 14,
              color: '#e2e8f0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {project.name}
            </div>
            {project.remoteUrl && (
              <div style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.remoteUrl}
              </div>
            )}
          </div>
        </div>

        {project.dirtyCount > 0 && (
          <span className="badge badge-yellow" style={{ flexShrink: 0 }}>
            {project.dirtyCount} change{project.dirtyCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', fontSize: 12 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="6" y1="3" x2="6" y2="15"/>
            <circle cx="18" cy="6" r="3"/>
            <circle cx="6" cy="18" r="3"/>
            <path d="M18 9a9 9 0 0 1-9 9"/>
          </svg>
          {project.branch}
        </span>

        {project.lastCommitDate && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {timeAgo(project.lastCommitDate)}
          </span>
        )}

        {!project.hasRemote && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="2" y1="2" x2="22" y2="22"/><path d="M10.59 10.59a2 2 0 1 1 2.83 2.83"/>
              <path d="M13.73 7.27A2 2 0 1 0 10.9 10.1"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
            Local only
          </span>
        )}
      </div>

      {project.lastCommit && (
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid var(--color-border)',
          fontSize: 12,
          color: '#475569',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {project.lastCommit}
        </div>
      )}
    </div>
  )
}
