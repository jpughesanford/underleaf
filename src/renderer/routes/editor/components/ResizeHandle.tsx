import React, { useRef, useState } from 'react'

interface Props {
  onDrag: (dx: number) => void
  onCollapse?: () => void
  collapseDirection?: 'left' | 'right'
}

export default function ResizeHandle({ onDrag, onCollapse, collapseDirection }: Props) {
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
      {onCollapse && hovered && (
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
