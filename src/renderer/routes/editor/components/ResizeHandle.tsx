import React, { useRef, useState } from 'react'

interface SyncButtons {
  /** Forward: editor cursor → PDF location (arrow points toward the PDF). */
  onForward: () => void
  /** Inverse: current PDF location → editor (arrow points toward the editor). */
  onInverse: () => void
}

interface Props {
  onDrag: (dx: number) => void
  onCollapse?: () => void
  collapseDirection?: 'left' | 'right'
  /** When set, the handle shows two always-visible SyncTeX jump buttons instead
      of the hover-only collapse button (used on the editor/PDF divider). */
  syncButtons?: SyncButtons
}

export default function ResizeHandle({ onDrag, onCollapse, collapseDirection, syncButtons }: Props) {
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
      {/* SyncTeX jump buttons — a stacked pair pinned to the divider, always
          visible (the editor/PDF divider no longer offers collapse: ⌘1 does
          that). Forward arrow points at the PDF, inverse arrow at the editor. */}
      {syncButtons && (
        <div
          style={{
            position: 'absolute', zIndex: 10,
            display: 'flex', flexDirection: 'column',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            overflow: 'hidden',
            background: 'var(--color-bg-modal)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <SyncBtn
            title="Go to code location in PDF"
            onClick={syncButtons.onForward}
            divider={false}
          >
            <polyline points="13 18 19 12 13 6"/><line x1="5" y1="12" x2="19" y2="12"/>
          </SyncBtn>
          <SyncBtn
            title="Go to PDF location in code (tip: ⌘-click the PDF)"
            onClick={syncButtons.onInverse}
            divider
          >
            <polyline points="11 18 5 12 11 6"/><line x1="19" y1="12" x2="5" y2="12"/>
          </SyncBtn>
        </div>
      )}

      {onCollapse && !syncButtons && hovered && (
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

function SyncBtn({ title, onClick, divider, children }: {
  title: string
  onClick: () => void
  divider: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 20, height: 24,
        border: 'none',
        borderTop: divider ? '1px solid var(--color-border)' : 'none',
        background: 'transparent',
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-brand)'; e.currentTarget.style.color = 'var(--color-on-brand)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}
