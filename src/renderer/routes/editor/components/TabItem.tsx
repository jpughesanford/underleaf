import React, { useState } from 'react'
import type { OpenTab } from '@shared/types'

interface Props {
  tab: OpenTab
  active: boolean
  onActivate: () => void
  onClose: () => void
  onSave: () => void
}

export default function TabItem({ tab, active, onActivate, onClose, onSave }: Props) {
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
      {/* VS Code-style close/dirty button: × on hover, dot when dirty and not hovering. */}
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
