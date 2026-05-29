import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './ContextMenu.module.css'

// Keep a floating menu fully on screen. Clamps the click point so the menu's far
// edge stays inside the window (with a small margin) instead of bleeding off.
const EDGE_MARGIN = 8
function clamp(value: number, size: number, viewport: number) {
  return Math.max(EDGE_MARGIN, Math.min(value, viewport - size - EDGE_MARGIN))
}

interface ContextMenuProps {
  /** Click x in viewport coordinates (e.g. from event.clientX). */
  x: number
  /** Click y in viewport coordinates. */
  y: number
  onClose: () => void
  /** Optional header label rendered above the items, divider beneath. */
  header?: React.ReactNode
  children: React.ReactNode
}

/**
 * Floating right-click menu. Closes on outside click or Escape. Children are
 * expected to be `<ContextMenu.Item>` and `<ContextMenu.Separator>` elements.
 */
function ContextMenu({ x, y, onClose, header, children }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Start at the raw click point, then correct before paint once we can measure
  // the menu, so it never extends past the right/bottom edge of the window.
  const [pos, setPos] = useState({ x, y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPos({
      x: clamp(x, width, window.innerWidth),
      y: clamp(y, height, window.innerHeight),
    })
  }, [x, y])

  // Close on outside click. mousedown (not click) so it beats child handlers
  // that stopPropagation on their own click — those handlers still fire.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className={styles.menu}
      style={{ top: pos.y, left: pos.x }}
      onMouseDown={e => e.stopPropagation()}
    >
      {header && <div className={styles.header}>{header}</div>}
      {children}
    </div>
  )
}

interface ItemProps {
  icon?: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

function Item({ icon, label, onClick, danger, disabled }: ItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${styles.item} ${danger ? styles.itemDanger : ''}`}
    >
      {icon && <span className={styles.itemIcon}>{icon}</span>}
      {label}
    </button>
  )
}

function Separator() {
  return <div className={styles.separator} />
}

ContextMenu.Item = Item
ContextMenu.Separator = Separator

export default ContextMenu
