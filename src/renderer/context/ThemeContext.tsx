import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { UnderleafTheme } from '../themes/schema'
import { THEMES, getTheme } from '../themes/registry'

const DEFAULT_DARK_THEME_ID = 'underleaf-dark'
const DEFAULT_LIGHT_THEME_ID = 'underleaf-light'

export type ColorMode = 'dark' | 'light'

interface ThemeContextValue {
  theme: UnderleafTheme
  themeId: string
  themes: UnderleafTheme[]
  mode: ColorMode
  darkThemeId: string
  lightThemeId: string
  toggleMode: () => void
  setDarkThemeId: (id: string) => Promise<void>
  setLightThemeId: (id: string) => Promise<void>
  setThemeId: (id: string) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue>(null!)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ColorMode>('dark')
  const [darkThemeId, setDarkThemeIdState] = useState(DEFAULT_DARK_THEME_ID)
  const [lightThemeId, setLightThemeIdState] = useState(DEFAULT_LIGHT_THEME_ID)

  useEffect(() => {
    window.api.storeGet('settings').then((s: unknown) => {
      const settings = s as {
        theme?: string
        darkThemeId?: string
        lightThemeId?: string
        colorMode?: string
      } | null

      if (settings?.colorMode === 'light') setMode('light')
      if (settings?.darkThemeId) setDarkThemeIdState(settings.darkThemeId)
      if (settings?.lightThemeId) setLightThemeIdState(settings.lightThemeId)

      // Migrate legacy single `theme` key
      if (!settings?.darkThemeId && !settings?.lightThemeId && settings?.theme) {
        const t = getTheme(settings.theme)
        if (t.dark) setDarkThemeIdState(settings.theme)
        else setLightThemeIdState(settings.theme)
      }
    })
  }, [])

  const themeId = mode === 'dark' ? darkThemeId : lightThemeId
  const theme = getTheme(themeId)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const persist = useCallback(async (updates: Record<string, unknown>) => {
    const existing = (await window.api.storeGet('settings')) as Record<string, unknown> | null ?? {}
    await window.api.storeSet('settings', { ...existing, ...updates })
  }, [])

  const toggleMode = useCallback(() => {
    setMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      persist({ colorMode: next })
      return next
    })
  }, [persist])

  const setDarkThemeId = useCallback(async (id: string) => {
    setDarkThemeIdState(id)
    await persist({ darkThemeId: id })
  }, [persist])

  const setLightThemeId = useCallback(async (id: string) => {
    setLightThemeIdState(id)
    await persist({ lightThemeId: id })
  }, [persist])

  // Routes to the right slot based on the theme's own dark flag
  const setThemeId = useCallback(async (id: string) => {
    const t = getTheme(id)
    if (t.dark) await setDarkThemeId(id)
    else await setLightThemeId(id)
  }, [setDarkThemeId, setLightThemeId])

  return (
    <ThemeContext.Provider value={{
      theme, themeId, themes: THEMES,
      mode, darkThemeId, lightThemeId,
      toggleMode, setDarkThemeId, setLightThemeId, setThemeId,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

// Extract editor bg/fg from the Overleaf-shaped `theme` block (the `&` selector
// sets backgroundColor / color on the editor root element).
function readBg(theme: UnderleafTheme['theme']): string | undefined {
  const ampersand = theme['&']
  const v = ampersand?.backgroundColor
  return typeof v === 'string' ? v : undefined
}
function readFg(theme: UnderleafTheme['theme']): string | undefined {
  const ampersand = theme['&']
  const v = ampersand?.color
  return typeof v === 'string' ? v : undefined
}

function applyTheme(theme: UnderleafTheme) {
  const root = document.documentElement
  const c = theme.chrome

  root.style.setProperty('--color-brand',          c.brand)
  root.style.setProperty('--color-brand-dark',     c.brandDark)
  root.style.setProperty('--color-brand-hover',    c.brandHover)
  root.style.setProperty('--color-bg-app',         c.bgApp)
  root.style.setProperty('--color-bg-sidebar',     c.bgSidebar)
  root.style.setProperty('--color-bg-panel',       c.bgPanel)
  root.style.setProperty('--color-bg-card',        c.bgCard)
  root.style.setProperty('--color-bg-card-hover',  c.bgCardHover)
  root.style.setProperty('--color-bg-toolbar',     c.bgToolbar)
  root.style.setProperty('--color-bg-input',       c.bgInput)
  root.style.setProperty('--color-bg-modal',       c.bgModal)
  root.style.setProperty('--color-bg-overlay',     c.bgOverlay)
  root.style.setProperty('--color-text-primary',   c.textPrimary)
  root.style.setProperty('--color-text-secondary', c.textSecondary)
  root.style.setProperty('--color-text-muted',     c.textMuted)
  root.style.setProperty('--color-text-accent',    c.textAccent)
  root.style.setProperty('--color-text-error',     c.textError)
  root.style.setProperty('--color-text-warning',   c.textWarning)
  root.style.setProperty('--color-border',         c.border)
  root.style.setProperty('--color-border-light',   c.borderLight)
  root.style.setProperty('--color-border-focus',   c.borderFocus)
  root.style.setProperty('--color-error',          c.error)
  root.style.setProperty('--color-warning',        c.warning)
  root.style.setProperty('--color-success',        c.success)
  root.style.setProperty('--color-info',           c.info)
  root.style.setProperty('--scrollbar-thumb',      c.scrollbar)
  root.style.setProperty('--scrollbar-thumb-hover',c.scrollbarHover)

  // Editor + syntax colors are applied INSIDE CodeMirror via EditorView.theme
  // (see EditorPane.tsx), driven directly from theme.theme + theme.highlightStyle.
  // For the rest of the chrome that wants a hint of the editor bg color, expose
  // bg/fg as CSS vars.
  const editorBg = readBg(theme.theme)
  const editorFg = readFg(theme.theme)
  if (editorBg) root.style.setProperty('--color-bg-editor', editorBg)
  if (editorBg) root.style.setProperty('--editor-bg',       editorBg)
  if (editorFg) root.style.setProperty('--editor-fg',       editorFg)

  // Toolbar icon colors — must be legible on bgToolbar regardless of theme hue.
  // Dark themes have navy/slate toolbars; brand color works as active accent there.
  // Light themes have colored (green/teal) toolbars; white is the only reliable contrast color.
  if (theme.dark) {
    root.style.setProperty('--color-toolbar-fg',        'rgba(255,255,255,0.62)')
    root.style.setProperty('--color-toolbar-fg-active', c.brand)
    root.style.setProperty('--color-toolbar-btn-active-bg', 'rgba(255,255,255,0.12)')
  } else {
    root.style.setProperty('--color-toolbar-fg',        'rgba(255,255,255,0.85)')
    root.style.setProperty('--color-toolbar-fg-active', '#ffffff')
    root.style.setProperty('--color-toolbar-btn-active-bg', 'rgba(255,255,255,0.22)')
  }

  // Badge colors — bright pastels for dark themes, rich saturated for light themes
  if (theme.dark) {
    root.style.setProperty('--badge-sync-color',    '#4ade80')
    root.style.setProperty('--badge-sync-bg',       'rgba(74,222,128,0.08)')
    root.style.setProperty('--badge-sync-bg-hover', 'rgba(74,222,128,0.13)')
    root.style.setProperty('--badge-sync-border',   'rgba(74,222,128,0.25)')
    root.style.setProperty('--badge-warn-color',    '#fbbf24')
    root.style.setProperty('--badge-warn-bg',       'rgba(251,191,36,0.1)')
    root.style.setProperty('--badge-warn-border',   'rgba(251,191,36,0.3)')
    root.style.setProperty('--badge-err-color',     '#f87171')
    root.style.setProperty('--badge-err-bg',        'rgba(248,113,113,0.12)')
    root.style.setProperty('--badge-err-border',    'rgba(248,113,113,0.35)')
    root.style.setProperty('--badge-muted-color',   '#64748b')
    root.style.setProperty('--badge-muted-bg',      'rgba(100,116,139,0.1)')
    root.style.setProperty('--badge-muted-border',  'rgba(100,116,139,0.25)')
    root.style.setProperty('--badge-info-color',    '#60a5fa')
    root.style.setProperty('--badge-info-bg',       'rgba(59,130,246,0.15)')
    root.style.setProperty('--badge-info-border',   'rgba(59,130,246,0.3)')
  } else {
    root.style.setProperty('--badge-sync-color',    '#16a34a')
    root.style.setProperty('--badge-sync-bg',       'rgba(22,163,74,0.1)')
    root.style.setProperty('--badge-sync-bg-hover', 'rgba(22,163,74,0.17)')
    root.style.setProperty('--badge-sync-border',   'rgba(22,163,74,0.35)')
    root.style.setProperty('--badge-warn-color',    '#c2680a')
    root.style.setProperty('--badge-warn-bg',       'rgba(194,104,10,0.1)')
    root.style.setProperty('--badge-warn-border',   'rgba(194,104,10,0.35)')
    root.style.setProperty('--badge-err-color',     '#dc2626')
    root.style.setProperty('--badge-err-bg',        'rgba(220,38,38,0.09)')
    root.style.setProperty('--badge-err-border',    'rgba(220,38,38,0.32)')
    root.style.setProperty('--badge-muted-color',   '#64748b')
    root.style.setProperty('--badge-muted-bg',      'rgba(100,116,139,0.1)')
    root.style.setProperty('--badge-muted-border',  'rgba(100,116,139,0.28)')
    root.style.setProperty('--badge-info-color',    '#2563eb')
    root.style.setProperty('--badge-info-bg',       'rgba(37,99,235,0.1)')
    root.style.setProperty('--badge-info-border',   'rgba(37,99,235,0.3)')
  }
}
