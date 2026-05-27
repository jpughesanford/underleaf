import React, { useEffect, useRef, useState } from 'react'
import AppIcon from '@/ui/AppIcon'
import ModeToggle from '@/ui/ModeToggle'
import type { CompileTarget, ViewMode } from '@shared/types'

interface Props {
  projectName: string
  onRenameProject?: (newName: string) => void
  onBack: () => void
  onCompile: () => void
  compiling: boolean
  compileTarget: CompileTarget
  onChangeTarget: (t: CompileTarget) => void
  viewMode: ViewMode
  onChangeView: (v: ViewMode) => void
  onOpenSettings: () => void
}

export default function Toolbar({
  projectName,
  onRenameProject,
  onBack,
  onCompile,
  compiling,
  compileTarget,
  onChangeTarget,
  viewMode,
  onChangeView,
  onOpenSettings,
}: Props) {
  const [showTargetMenu, setShowTargetMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(projectName)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!renaming) return
    setRenameValue(projectName)
    const input = renameInputRef.current
    if (input) {
      input.focus()
      input.select()
    }
  }, [renaming, projectName])

  function commitRename() {
    const trimmed = renameValue.trim()
    setRenaming(false)
    if (trimmed && trimmed !== projectName) onRenameProject?.(trimmed)
  }

  return (
    <div
      className="titlebar-drag"
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 76,
        paddingRight: 16,
        gap: 8,
        background: 'var(--color-bg-toolbar)',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}
    >
      <div className="titlebar-no-drag" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={onBack}
          title="Back to Dashboard"
          style={{ color: 'var(--color-toolbar-fg)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--color-toolbar-fg-active)' }}>
          <AppIcon size={18} />
          {renaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setRenaming(false)
              }}
              style={{
                fontSize: 13,
                fontWeight: 600,
                background: 'var(--color-bg-input)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-brand)',
                borderRadius: 4,
                padding: '2px 6px',
                outline: 'none',
                fontFamily: 'inherit',
                minWidth: 140,
              }}
            />
          ) : (
            <span
              onClick={() => onRenameProject && setRenaming(true)}
              title={onRenameProject ? 'Click to rename' : undefined}
              style={{
                fontSize: 13,
                fontWeight: 600,
                cursor: onRenameProject ? 'text' : 'default',
                padding: '2px 4px',
                borderRadius: 4,
                transition: 'background 120ms',
              }}
              onMouseEnter={e => { if (onRenameProject) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {projectName}
            </span>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right actions — order: view selector | mode toggle | settings | compile */}
      <div className="titlebar-no-drag" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* View mode toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          overflow: 'hidden',
        }}>
          {([
            { value: 'editor' as ViewMode, title: 'Editor only', icon: (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
            )},
            { value: 'split' as ViewMode, title: 'Split view', icon: (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="12" y1="3" x2="12" y2="21"/>
              </svg>
            )},
            { value: 'pdf' as ViewMode, title: 'PDF only', icon: (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
            )},
          ]).map(({ value, title, icon }) => (
            <button
              key={value}
              title={title}
              onClick={() => onChangeView(value)}
              style={{
                width: 28, height: 26,
                border: 'none',
                borderRight: value !== 'pdf' ? '1px solid var(--color-border)' : 'none',
                background: viewMode === value ? 'var(--color-toolbar-btn-active-bg)' : 'transparent',
                color: viewMode === value ? 'var(--color-toolbar-fg-active)' : 'var(--color-toolbar-fg)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 120ms ease',
              }}
              onMouseEnter={e => { if (viewMode !== value) e.currentTarget.style.color = 'var(--color-toolbar-fg-active)' }}
              onMouseLeave={e => { if (viewMode !== value) e.currentTarget.style.color = 'var(--color-toolbar-fg)' }}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* Mode (dark/light) toggle */}
        <ModeToggle style={{ color: 'var(--color-toolbar-fg)' }} />

        {/* Settings */}
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={onOpenSettings}
          title="Settings"
          style={{ color: 'var(--color-toolbar-fg)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        {/* Recompile split button */}
        <div style={{ display: 'flex', alignItems: 'stretch', position: 'relative' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={onCompile}
            disabled={compiling}
            style={{ gap: 6, borderRadius: '6px 0 0 6px', borderRight: '1px solid rgba(255,255,255,0.15)', minWidth: 110 }}
          >
            {compiling ? (
              <>
                <div className="spinner" style={{ width: 12, height: 12 }} />
                Compiling…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                {compileTarget === 'active' ? 'Compile File' : 'Recompile'}
              </>
            )}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowTargetMenu(v => !v)}
            disabled={compiling}
            style={{ borderRadius: '0 6px 6px 0', padding: '0 6px' }}
            title="Compile target"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showTargetMenu && (
            <div
              style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                background: 'var(--color-bg-modal)',
                border: '1px solid var(--color-border)',
                borderRadius: 8, padding: 4, zIndex: 100,
                minWidth: 190, boxShadow: 'var(--shadow-md)',
              }}
              onMouseLeave={() => setShowTargetMenu(false)}
            >
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', padding: '4px 10px 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Compile target
              </div>
              {([
                { value: 'root' as CompileTarget, label: 'Root document', desc: 'Always compile the main .tex file' },
                { value: 'active' as CompileTarget, label: 'Active file', desc: 'Compile the currently open file' },
              ]).map(opt => (
                <div
                  key={opt.value}
                  onClick={() => { onChangeTarget(opt.value); setShowTargetMenu(false) }}
                  style={{
                    padding: '7px 10px', borderRadius: 4, cursor: 'pointer',
                    background: compileTarget === opt.value ? 'rgba(76,175,80,0.1)' : 'transparent',
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}
                >
                  <div style={{ width: 14, paddingTop: 1, flexShrink: 0 }}>
                    {compileTarget === opt.value && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: compileTarget === opt.value ? 'var(--color-brand)' : 'var(--color-text-primary)' }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
