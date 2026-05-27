import React from 'react'
import styles from './IconButton.module.css'

interface Props {
  title: string
  onClick?: () => void
  children: React.ReactNode
  /** Square edge length in px. Defaults to 24 (file/git toolbar size). */
  size?: number
  disabled?: boolean
  /** Toggled-on state — paints the active background. */
  active?: boolean
  /** Spin the icon while in flight (e.g. fetching, pulling). */
  spin?: boolean
  /** Optional override for the resting color (e.g. a status accent). */
  color?: string
}

/**
 * Square ghost button that wraps an inline SVG icon. Used in feature toolbars
 * (file explorer, git panel, PDF viewer). For the sidebar rail buttons see
 * routes/editor/components/RailButton.tsx — that variant has badges + a
 * different hover treatment.
 */
export default function IconButton({
  title, onClick, children, size = 24, disabled, active, spin, color,
}: Props) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        styles.btn,
        active && styles.active,
        spin && styles.spin,
      ].filter(Boolean).join(' ')}
      style={{ width: size, height: size, color }}
    >
      {children}
    </button>
  )
}
