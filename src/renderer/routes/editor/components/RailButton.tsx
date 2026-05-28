import React from 'react'
import styles from './RailButton.module.css'

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
      className={`${styles.btn} ${active ? styles.active : ''}`}
    >
      {children}
      {badgeColor && <span className={styles.badge} style={{ background: badgeColor }} />}
    </button>
  )
}
