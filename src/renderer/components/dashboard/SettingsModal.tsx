import React, { useState, useEffect } from 'react'
import Modal from '../shared/Modal'
import { useTheme } from '../../context/ThemeContext'
import { UnderleafTheme } from '../../themes/schema'

interface Props {
  onClose: () => void
  onChangeRoot: () => void
}

export default function SettingsModal({ onClose, onChangeRoot }: Props) {
  const [engine, setEngine] = useState('pdflatex')
  const [compileOnSave, setCompileOnSave] = useState(true)
  const [root, setRoot] = useState('')
  const { themes, mode, darkThemeId, lightThemeId, setDarkThemeId, setLightThemeId } = useTheme()

  const darkThemes = themes.filter(t => t.dark)
  const lightThemes = themes.filter(t => !t.dark)

  useEffect(() => {
    Promise.all([
      window.api.storeGet('settings'),
      window.api.getProjectsRoot(),
    ]).then(([settings, r]) => {
      if (settings) {
        const s = settings as { defaultEngine?: string; compileOnSave?: boolean }
        setEngine(s.defaultEngine || 'pdflatex')
        setCompileOnSave(s.compileOnSave !== false)
      }
      setRoot(r || '')
    })
  }, [])

  async function save() {
    const existing = (await window.api.storeGet('settings')) as Record<string, unknown> | null ?? {}
    await window.api.storeSet('settings', { ...existing, defaultEngine: engine, compileOnSave })
    onClose()
  }

  return (
    <Modal title="Settings" onClose={onClose} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Appearance */}
        <section>
          <SectionLabel>Appearance</SectionLabel>

          {/* Dark themes */}
          <div style={{ marginBottom: 16 }}>
            <ThemeGroupLabel active={mode === 'dark'} icon="moon">Dark</ThemeGroupLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {darkThemes.map(theme => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  selected={theme.id === darkThemeId}
                  onClick={() => setDarkThemeId(theme.id)}
                />
              ))}
            </div>
          </div>

          {/* Light themes */}
          <div>
            <ThemeGroupLabel active={mode === 'light'} icon="sun">Light</ThemeGroupLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {lightThemes.map(theme => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  selected={theme.id === lightThemeId}
                  onClick={() => setLightThemeId(theme.id)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Projects */}
        <section>
          <SectionLabel>Projects</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input className="input" value={root} readOnly style={{ flex: 1, color: 'var(--color-text-muted)' }} />
            <button className="btn btn-secondary btn-sm" onClick={onChangeRoot}>Change</button>
          </div>
        </section>

        {/* Compilation */}
        <section>
          <SectionLabel>Compilation</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: 12, marginBottom: 6 }}>
                Default Engine
              </label>
              <select
                className="input"
                value={engine}
                onChange={e => setEngine(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="pdflatex">pdflatex</option>
                <option value="xelatex">xelatex</option>
                <option value="lualatex">lualatex</option>
              </select>
            </div>
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', padding: '4px 0',
                fontSize: 13, color: 'var(--color-text-primary)',
              }}
            >
              <input
                type="checkbox"
                checked={compileOnSave}
                onChange={e => setCompileOnSave(e.target.checked)}
                style={{ accentColor: 'var(--color-brand)', cursor: 'pointer' }}
              />
              Auto-compile on save
            </label>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </Modal>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--color-text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function ThemeGroupLabel({ children, active, icon }: { children: React.ReactNode; active: boolean; icon: 'moon' | 'sun' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 10.5, fontWeight: 600,
      color: active ? 'var(--color-brand)' : 'var(--color-text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      marginBottom: 8,
    }}>
      {icon === 'moon' ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      )}
      {children}
      {active && (
        <span style={{
          fontSize: 9, fontWeight: 500, letterSpacing: '0.03em',
          color: 'var(--color-brand)', opacity: 0.8,
          background: 'color-mix(in srgb, var(--color-brand) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-brand) 25%, transparent)',
          borderRadius: 4, padding: '1px 5px', textTransform: 'none',
        }}>
          active
        </span>
      )}
    </div>
  )
}

function ThemeCard({ theme, selected, onClick }: {
  theme: UnderleafTheme
  selected: boolean
  onClick: () => void
}) {
  // Pull preview swatches straight from the Overleaf-shaped theme blocks.
  // Match by .tok-* class — same mapping the live editor will use.
  const hs = theme.highlightStyle
  const colorOf = (cls: string, fallback?: string): string => {
    const v = hs[cls]?.color
    return typeof v === 'string' ? v : (fallback ?? '')
  }
  const editorBg = (theme.theme['&']?.backgroundColor as string) ?? '#ffffff'
  const editorFg = (theme.theme['&']?.color as string) ?? '#000000'
  const tagName       = colorOf('.tok-tagName', editorFg)        // generic \cmd, \begin/\end
  const keyword       = colorOf('.tok-keyword', tagName)         // \cite \ref \label \usepackage \documentclass
  const attributeVal  = colorOf('.tok-attributeValue', editorFg) // env names, label/ref/cite key contents
  const string        = colorOf('.tok-string', editorFg)         // math content, $...$
  const literal       = colorOf('.tok-literal', editorFg)        // math \left \right, ctrl syms
  const comment       = colorOf('.tok-comment', editorFg)
  const commentStyle  = (hs['.tok-comment']?.fontStyle as string) ?? 'normal'
  const attrValStyle  = (hs['.tok-attributeValue']?.fontStyle as string) ?? 'normal'

  return (
    <button
      onClick={onClick}
      style={{
        all: 'unset',
        cursor: 'pointer',
        borderRadius: 8,
        border: `2px solid ${selected ? theme.chrome.brand : theme.chrome.border}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 120ms',
        boxShadow: selected ? `0 0 0 1px ${theme.chrome.brand}` : 'none',
      }}
    >
      {/* Mini editor preview */}
      <div style={{
        background: editorBg,
        color: editorFg,
        padding: '9px 11px',
        fontFamily: 'monospace',
        fontSize: 8.5,
        lineHeight: 1.65,
        userSelect: 'none',
        minHeight: 72,
      }}>
        <div>
          <span style={{ color: tagName }}>\begin</span>
          <span>{'{'}</span>
          <span style={{ color: attributeVal, fontStyle: attrValStyle }}>document</span>
          <span>{'}'}</span>
        </div>
        <div>
          <span style={{ color: tagName }}>\section</span>
          <span>{'{'}</span>
          <span>Introduction</span>
          <span>{'}'}</span>
        </div>
        <div>
          <span>Prose with </span>
          <span style={{ color: keyword }}>\cite</span>
          <span>{'{'}</span>
          <span style={{ color: attributeVal, fontStyle: attrValStyle }}>ref23</span>
          <span>{'} '}</span>
          <span style={{ color: comment, fontStyle: commentStyle }}>% note</span>
        </div>
        <div>
          <span style={{ color: string }}>$</span>
          <span style={{ color: literal }}>\alpha </span>
          <span style={{ color: string }}>+ 1</span>
          <span style={{ color: string }}>$</span>
        </div>
      </div>

      {/* Theme name bar — fixed dark bar + off-white label so legibility is
          consistent across light and dark theme previews. Selection is still
          signaled by the card border ring and the check icon. */}
      <div style={{
        padding: '7px 11px',
        background: '#1a2332',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        fontSize: 13,
        color: '#e8edf2',
        fontWeight: selected ? 600 : 500,
        letterSpacing: '0.005em',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {selected && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ flexShrink: 0, color: theme.chrome.brand }}>
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{theme.name}</span>
      </div>
    </button>
  )
}
