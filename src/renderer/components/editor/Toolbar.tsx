import React, { useState } from 'react'
import AppIcon from '../shared/AppIcon'

interface Props {
  projectName: string
  onBack: () => void
  onCompile: () => void
  compiling: boolean
  compileTrigger: string
  onChangeTrigger: (t: string) => void
  projectPath: string
  activeFilePath: string | null
  onSave: () => void
}

export default function Toolbar({
  projectName,
  onBack,
  onCompile,
  compiling,
  compileTrigger,
  onChangeTrigger,
  projectPath,
  activeFilePath,
  onSave,
}: Props) {
  const [showTriggerMenu, setShowTriggerMenu] = useState(false)

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
        {/* Save */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={onSave}
          disabled={!activeFilePath}
          title="Save (⌘S)"
          style={{ fontSize: 12, gap: 4 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          Save
        </button>

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

        {/* Recompile button */}
        <button
          className="btn btn-primary btn-sm"
          onClick={onCompile}
          disabled={compiling}
          style={{ gap: 6, minWidth: 110 }}
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
              Recompile
            </>
          )}
        </button>
      </div>
    </div>
  )
}
