import React, { useState } from 'react'
import AppIcon from '../shared/AppIcon'

export type CompileTarget = 'root' | 'active'
export type ViewMode = 'editor' | 'split' | 'pdf'

interface Props {
  projectName: string
  onBack: () => void
  onCompile: () => void
  compiling: boolean
  compileTrigger: string
  onChangeTrigger: (t: string) => void
  compileTarget: CompileTarget
  onChangeTarget: (t: CompileTarget) => void
  viewMode: ViewMode
  onChangeView: (v: ViewMode) => void
  projectPath: string
  onOpenSettings: () => void
}

export default function Toolbar({
  projectName,
  onBack,
  onCompile,
  compiling,
  compileTrigger,
  onChangeTrigger,
  compileTarget,
  onChangeTarget,
  viewMode,
  onChangeView,
  projectPath,
  onOpenSettings,
}: Props) {
  const [showTriggerMenu, setShowTriggerMenu] = useState(false)
  const [showTargetMenu, setShowTargetMenu] = useState(false)

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
          style={{ color: '#64748b' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#e2e8f0' }}>
          <AppIcon size={18} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{projectName}</span>
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right actions */}
      <div className="titlebar-no-drag" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Settings */}
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={onOpenSettings}
          title="Settings"
          style={{ color: '#64748b' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

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
                background: viewMode === value ? 'rgba(76,175,80,0.15)' : 'transparent',
                color: viewMode === value ? '#4CAF50' : '#64748b',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 120ms ease',
              }}
              onMouseEnter={e => { if (viewMode !== value) e.currentTarget.style.color = '#94a3b8' }}
              onMouseLeave={e => { if (viewMode !== value) e.currentTarget.style.color = '#64748b' }}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* Compile trigger dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => setShowTriggerMenu(v => !v)}
            title="Compilation trigger"
            style={{ color: '#64748b', paddingRight: 2 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showTriggerMenu && (
            <div
              style={{
                position: 'absolute', top: '100%', right: 0,
                background: 'var(--color-bg-modal)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: 4,
                zIndex: 100,
                minWidth: 160,
                boxShadow: 'var(--shadow-md)',
              }}
              onMouseLeave={() => setShowTriggerMenu(false)}
            >
              {[
                { value: 'manual', label: 'Manual' },
                { value: 'onsave', label: 'On Save' },
                { value: 'auto', label: 'Auto' },
              ].map(opt => (
                <div
                  key={opt.value}
                  onClick={() => { onChangeTrigger(opt.value); setShowTriggerMenu(false) }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                    color: compileTrigger === opt.value ? '#4CAF50' : '#94a3b8',
                    background: compileTrigger === opt.value ? 'rgba(76,175,80,0.1)' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  {compileTrigger === opt.value && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                  {compileTrigger !== opt.value && <div style={{ width: 12 }} />}
                  {opt.label}
                </div>
              ))}
            </div>
          )}
        </div>

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
              <div style={{ fontSize: 10, color: '#475569', padding: '4px 10px 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: compileTarget === opt.value ? '#4CAF50' : '#e2e8f0' }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{opt.desc}</div>
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
