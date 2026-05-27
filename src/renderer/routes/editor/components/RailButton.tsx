import React from 'react'

interface Props {
  active: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
  badge?: 'error' | 'warn'
}

export default function RailButton({ active, title, onClick, children, badge }: Props) {
  const badgeColor = badge === 'error' ? 'var(--color-error)'
    : badge === 'warn' ? 'var(--color-warning)'
    : null

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
