import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { UnderleafTheme } from '../theme/schema'
import { THEMES, getTheme } from '../theme/registry'

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
    window.api.store.get('settings').then((s: unknown) => {
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
    const existing = (await window.api.store.get('settings')) as Record<string, unknown> | null ?? {}
    await window.api.store.set('settings', { ...existing, ...updates })
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

// Convert a #rrggbb / #rgb brand color into an rgba() string at the given alpha.
// Used to derive the brand-tint ladder so translucent "selected/active" fills
// track each theme's own brand instead of a hardcoded green.
function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith('#')) return hex
  const h = hex.slice(1)
  const full = h.length === 3 ? h.split('').map(ch => ch + ch).join('') : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Defaults for the per-mode chrome (badges, toolbar accents, git-panel selection).
// Themes can override individual entries via chrome.badges / chrome.toolbar.

const DEFAULT_DARK_BADGES = {
  syncColor:   '#4ade80', syncBg: 'rgba(74,222,128,0.08)', syncBgHover: 'rgba(74,222,128,0.13)', syncBorder: 'rgba(74,222,128,0.25)',
  warnColor:   '#fbbf24', warnBg: 'rgba(251,191,36,0.1)', warnBorder: 'rgba(251,191,36,0.3)',
  errColor:    '#f87171', errBg:  'rgba(248,113,113,0.12)', errBorder: 'rgba(248,113,113,0.35)',
  mutedColor:  '#64748b', mutedBg: 'rgba(100,116,139,0.1)', mutedBorder: 'rgba(100,116,139,0.25)',
  infoColor:   '#60a5fa', infoBg: 'rgba(59,130,246,0.15)', infoBorder: 'rgba(59,130,246,0.3)',
}

const DEFAULT_LIGHT_BADGES = {
  syncColor:   '#16a34a', syncBg: 'rgba(22,163,74,0.1)', syncBgHover: 'rgba(22,163,74,0.17)', syncBorder: 'rgba(22,163,74,0.35)',
  warnColor:   '#c2680a', warnBg: 'rgba(194,104,10,0.1)', warnBorder: 'rgba(194,104,10,0.35)',
  errColor:    '#dc2626', errBg:  'rgba(220,38,38,0.09)', errBorder: 'rgba(220,38,38,0.32)',
  mutedColor:  '#64748b', mutedBg: 'rgba(100,116,139,0.1)', mutedBorder: 'rgba(100,116,139,0.28)',
  infoColor:   '#2563eb', infoBg: 'rgba(37,99,235,0.1)', infoBorder: 'rgba(37,99,235,0.3)',
}

// Toolbar icon overlay. Dark themes have navy/slate toolbars where the brand
// color reads as the active accent; light themes have brand-colored toolbars
// where only white provides enough contrast.
function defaultToolbar(dark: boolean, brand: string) {
  return dark
    ? { fg: 'rgba(255,255,255,0.62)', fgActive: brand,     btnActiveBg: 'rgba(255,255,255,0.12)' }
    : { fg: 'rgba(255,255,255,0.85)', fgActive: '#ffffff', btnActiveBg: 'rgba(255,255,255,0.22)' }
}

function applyTheme(theme: UnderleafTheme) {
  const root = document.documentElement
  const c = theme.chrome
  const set = (key: string, value: string) => root.style.setProperty(key, value)

  set('--color-brand',          c.brand)
  set('--color-brand-dark',     c.brandDark)
  set('--color-brand-hover',    c.brandHover)
  set('--color-bg-app',         c.bgApp)
  set('--color-bg-sidebar',     c.bgSidebar)
  set('--color-bg-panel',       c.bgPanel)
  set('--color-bg-card',        c.bgCard)
  set('--color-bg-card-hover',  c.bgCardHover)
  set('--color-bg-toolbar',     c.bgToolbar)
  set('--color-bg-input',       c.bgInput)
  set('--color-bg-modal',       c.bgModal)
  set('--color-bg-overlay',     c.bgOverlay)
  set('--color-text-primary',   c.textPrimary)
  set('--color-text-secondary', c.textSecondary)
  set('--color-text-muted',     c.textMuted)
  set('--color-text-accent',    c.textAccent)
  set('--color-text-error',     c.textError)
  set('--color-text-warning',   c.textWarning)
  set('--color-border',         c.border)
  set('--color-border-light',   c.borderLight)
  set('--color-border-focus',   c.borderFocus)
  set('--color-error',          c.error)
  set('--color-warning',        c.warning)
  set('--color-success',        c.success)
  set('--color-info',           c.info)
  set('--scrollbar-thumb',      c.scrollbar)
  set('--scrollbar-thumb-hover',c.scrollbarHover)

  // Brand-tint ladder — translucent brand fills for selected/active/drag states.
  // Derived from the theme's own brand so tints match the accent in every theme.
  const tint = (a: number) => hexToRgba(c.brand, a)
  set('--color-brand-tint',        tint(0.15)) // active / selected row fill
  set('--color-brand-tint-soft',   tint(0.1))  // softer selected / drag-over fill
  set('--color-brand-tint-faint',  tint(0.04)) // very subtle drop-zone wash
  set('--color-brand-tint-strong', tint(0.18)) // emphasized hover (e.g. PDF link)
  set('--color-brand-edge',        tint(0.4))  // dashed drop outline / chip border
  set('--color-brand-edge-strong', tint(0.5))  // drop outline / ring over a tint

  // Hover overlay for ghost/transparent surfaces — a translucent wash that works
  // over any background (white in dark themes, black in light themes).
  set('--color-overlay-hover', theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
  // Pressed/hover state for the danger button (a step darker than --color-error).
  set('--color-error-hover',   theme.dark ? '#dc2626' : '#b71c1c')
  // Text/glyph on a brand-filled surface (primary button, checked checkbox).
  set('--color-on-brand',      c.onBrand ?? '#ffffff')

  // Editor surface — CodeMirror handles its own colors via theme.theme; we expose
  // bg/fg as CSS vars so the surrounding chrome can paint matching backgrounds.
  const editorBg = readBg(theme.theme)
  const editorFg = readFg(theme.theme)
  if (editorBg) { set('--color-bg-editor', editorBg); set('--editor-bg', editorBg) }
  if (editorFg) { set('--editor-fg', editorFg) }

  // Toolbar — defaults from defaultToolbar(), themes may override individual keys.
  const toolbar = { ...defaultToolbar(theme.dark, c.brand), ...(c.toolbar ?? {}) }
  set('--color-toolbar-fg',            toolbar.fg)
  set('--color-toolbar-fg-active',     toolbar.fgActive)
  set('--color-toolbar-btn-active-bg', toolbar.btnActiveBg)

  // Badges — defaults from per-mode palette, themes may override individual keys.
  const badges = { ...(theme.dark ? DEFAULT_DARK_BADGES : DEFAULT_LIGHT_BADGES), ...(c.badges ?? {}) }
  set('--badge-sync-color',    badges.syncColor)
  set('--badge-sync-bg',       badges.syncBg)
  set('--badge-sync-bg-hover', badges.syncBgHover)
  set('--badge-sync-border',   badges.syncBorder)
  set('--badge-warn-color',    badges.warnColor)
  set('--badge-warn-bg',       badges.warnBg)
  set('--badge-warn-border',   badges.warnBorder)
  set('--badge-err-color',     badges.errColor)
  set('--badge-err-bg',        badges.errBg)
  set('--badge-err-border',    badges.errBorder)
  set('--badge-muted-color',   badges.mutedColor)
  set('--badge-muted-bg',      badges.mutedBg)
  set('--badge-muted-border',  badges.mutedBorder)
  set('--badge-info-color',    badges.infoColor)
  set('--badge-info-bg',       badges.infoBg)
  set('--badge-info-border',   badges.infoBorder)

  // Git panel focused-row highlight (PyCharm Darcula indigo for dark, IntelliJ blue for light).
  set('--gitpanel-sel-bg', c.gitpanelSelBg ?? (theme.dark ? 'rgba(75, 110, 175, 0.38)' : '#3574F0'))
  set('--gitpanel-sel-fg', c.gitpanelSelFg ?? '#ffffff')
  // Dimmed secondary text on a selected row (the selection bg is always a
  // saturated highlight, so a translucent white reads in every theme).
  set('--gitpanel-sel-fg-muted', 'rgba(255,255,255,0.6)')
}
