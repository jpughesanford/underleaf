import React, { useState, useEffect, useRef } from 'react'
import Modal from '@/ui/Modal'
import { useTheme } from '@/theme/ThemeProvider'
import { UnderleafTheme } from '@/theme/schema'
import { SPELL_LANGUAGES, DEFAULT_SPELL_LANGUAGE } from '@shared/spell-languages'

interface Props {
  onClose: () => void
  onChangeRoot: () => void
}

export default function SettingsModal({ onClose, onChangeRoot }: Props) {
  const [engine, setEngine] = useState('pdflatex')
  const [compileOnSave, setCompileOnSave] = useState(true)
  const [spellCheck, setSpellCheck] = useState(true)
  const [spellLanguage, setSpellLanguage] = useState(DEFAULT_SPELL_LANGUAGE)
  const [root, setRoot] = useState('')
  const { themes, mode, darkThemeId, lightThemeId, setDarkThemeId, setLightThemeId } = useTheme()

  const darkThemes = themes.filter(t => t.dark)
  const lightThemes = themes.filter(t => !t.dark)

  const darkTrackRef = useRef<HTMLDivElement>(null)
  const lightTrackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      window.api.store.get('settings'),
      window.api.projects.getRoot(),
    ]).then(([settings, r]) => {
      if (settings) {
        const s = settings as { defaultEngine?: string; compileOnSave?: boolean; spellCheck?: boolean; spellLanguage?: string }
        setEngine(s.defaultEngine || 'pdflatex')
        setCompileOnSave(s.compileOnSave !== false)
        setSpellCheck(s.spellCheck !== false)
        if (s.spellLanguage) setSpellLanguage(s.spellLanguage)
      }
      setRoot(r || '')
    })
  }, [])

  // Center the active theme card in each album when the modal opens.
  // Browsers clamp scrollLeft to [0, scrollLeftMax] so cards near the ends
  // just stay at their natural snap position — no special-casing needed.
  useEffect(() => {
    const centerActive = (track: HTMLDivElement | null, themeId: string) => {
      if (!track) return
      const card = track.querySelector<HTMLElement>(`[data-theme-id="${themeId}"]`)
      if (!card) return
      const target = card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2
      track.scrollTo({ left: target, behavior: 'auto' })
    }
    centerActive(darkTrackRef.current, darkThemeId)
    centerActive(lightTrackRef.current, lightThemeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    const existing = (await window.api.store.get('settings')) as Record<string, unknown> | null ?? {}
    await window.api.store.set('settings', { ...existing, defaultEngine: engine, compileOnSave, spellCheck, spellLanguage })
    onClose()
  }

  return (
    <Modal title="Settings" onClose={onClose} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Appearance — horizontal album carousel per mode */}
        <section>
          <SectionLabel>Appearance</SectionLabel>

          <div style={{ marginBottom: 14 }}>
            <ThemeGroupLabel active={mode === 'dark'} icon="moon">Dark</ThemeGroupLabel>
            <div className="theme-album">
              <div className="theme-track" ref={darkTrackRef}>
                {darkThemes.map(theme => (
                  <AlbumCard
                    key={theme.id}
                    theme={theme}
                    selected={theme.id === darkThemeId}
                    onClick={() => setDarkThemeId(theme.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <ThemeGroupLabel active={mode === 'light'} icon="sun">Light</ThemeGroupLabel>
            <div className="theme-album">
              <div className="theme-track" ref={lightTrackRef}>
                {lightThemes.map(theme => (
                  <AlbumCard
                    key={theme.id}
                    theme={theme}
                    selected={theme.id === lightThemeId}
                    onClick={() => setLightThemeId(theme.id)}
                  />
                ))}
              </div>
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

        {/* Editor */}
        <section>
          <SectionLabel>Editor</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', padding: '4px 0',
                fontSize: 13, color: 'var(--color-text-primary)',
              }}
            >
              <input
                type="checkbox"
                checked={spellCheck}
                onChange={e => setSpellCheck(e.target.checked)}
                style={{ accentColor: 'var(--color-brand)', cursor: 'pointer' }}
              />
              Check spelling
            </label>
            <div style={{ opacity: spellCheck ? 1 : 0.5, transition: 'opacity 120ms' }}>
              <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: 12, marginBottom: 6 }}>
                Dictionary language
              </label>
              <select
                className="input"
                value={spellLanguage}
                onChange={e => setSpellLanguage(e.target.value)}
                disabled={!spellCheck}
                style={{ cursor: spellCheck ? 'pointer' : 'default' }}
              >
                {SPELL_LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
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

function AlbumCard({ theme, selected, onClick }: {
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
  // Generic \cmd, \begin/\end are tagged t.tagName but fall through to tok-typeName
  // (see features/code-editor/extensions/latex-language.ts) — read tok-typeName so the preview matches the live editor.
  const tagName       = colorOf('.tok-typeName', editorFg)
  const keyword       = colorOf('.tok-keyword', tagName)
  const attributeVal  = colorOf('.tok-attributeValue', editorFg)
  const string        = colorOf('.tok-string', editorFg)
  const literal       = colorOf('.tok-literal', editorFg)
  const comment       = colorOf('.tok-comment', editorFg)
  const commentStyle  = (hs['.tok-comment']?.fontStyle as string) ?? 'normal'
  const attrValStyle  = (hs['.tok-attributeValue']?.fontStyle as string) ?? 'normal'

  const c = theme.chrome

  return (
    <button
      type="button"
      data-theme-id={theme.id}
      onClick={onClick}
      aria-pressed={selected}
      title={theme.name}
      className={`album-card${selected ? ' selected' : ''}`}
    >
      <div className="preview-wrap">
        <span className="check" aria-hidden="true">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>

        {/* Homepage mockup — shown at rest */}
        <div className="preview-home" style={{ background: c.bgApp }}>
          <div className="ph-top" style={{ background: c.bgToolbar }}>
            <span className="ph-logo" style={{ background: c.brand }} />
            <span className="ph-title">Underleaf</span>
          </div>
          <div className="ph-grid">
            {[0, 1].map(i => (
              <div
                key={i}
                className="ph-card"
                style={{ background: c.bgCard, borderColor: c.border }}
              >
                <span
                  className="ph-folder"
                  style={{ background: c.brand, opacity: 0.22 }}
                />
                <span
                  className="ph-bar"
                  style={{ background: c.textPrimary, opacity: 0.55 }}
                />
                <span
                  className="ph-bar2"
                  style={{ background: c.textMuted }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Code sample — revealed on hover */}
        <div
          className="preview-body"
          style={{ background: editorBg, color: editorFg }}
        >
          <div>
            <span style={{ color: tagName }}>\begin</span>
            <span>{'{'}</span>
            <span style={{ color: attributeVal, fontStyle: attrValStyle }}>document</span>
            <span>{'}'}</span>
          </div>
          <div>
            <span style={{ color: tagName }}>\section</span>
            <span>{'{Intro}'}</span>
          </div>
          <div>
            <span style={{ color: keyword }}>\cite</span>
            <span>{'{'}</span>
            <span style={{ color: attributeVal, fontStyle: attrValStyle }}>r23</span>
            <span>{'} '}</span>
            <span style={{ color: comment, fontStyle: commentStyle }}>%</span>
          </div>
          <div>
            <span style={{ color: string }}>$</span>
            <span style={{ color: literal }}>\alpha </span>
            <span style={{ color: string }}>+ 1$</span>
          </div>
        </div>
      </div>
      <div className="name">{theme.name}</div>
    </button>
  )
}
