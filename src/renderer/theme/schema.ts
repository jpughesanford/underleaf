// Theme schema — the `theme` and `highlightStyle` blocks mirror Overleaf's CM6
// theme JSONs verbatim (see services/web/frontend/js/features/source-editor/themes/cm6/*).
// `chrome` is Underleaf-specific (app shell colors not present in Overleaf's pure-editor themes).

export interface ChromeColors {
  bgApp: string
  bgSidebar: string
  bgPanel: string
  bgCard: string
  bgCardHover: string
  bgToolbar: string
  bgInput: string
  bgModal: string
  bgOverlay: string
  brand: string
  brandDark: string
  brandHover: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textAccent: string
  textError: string
  textWarning: string
  border: string
  borderLight: string
  borderFocus: string
  error: string
  warning: string
  success: string
  info: string
  scrollbar: string
  scrollbarHover: string

  /** Text/glyph color on a brand-filled surface (primary button, checked box).
      Optional — defaults to white, which reads on every current brand green. */
  onBrand?: string

  /** Optional overrides — if omitted, defaults are chosen based on `dark`. */
  badges?: Partial<BadgeColors>
  toolbar?: Partial<ToolbarColors>
  gitpanelSelBg?: string
  gitpanelSelFg?: string
}

/** Status badge palette. Defaults vary between dark and light themes. */
export interface BadgeColors {
  syncColor:   string
  syncBg:      string
  syncBgHover: string
  syncBorder:  string
  warnColor:   string
  warnBg:      string
  warnBorder:  string
  errColor:    string
  errBg:       string
  errBorder:   string
  mutedColor:  string
  mutedBg:     string
  mutedBorder: string
  infoColor:   string
  infoBg:      string
  infoBorder:  string
}

/** Editor toolbar palette. Defaults vary between dark and light themes. */
export interface ToolbarColors {
  fg:           string
  fgActive:     string
  btnActiveBg:  string
}

// CSS selector → CSS-prop-bag, identical to Overleaf's theme JSON shape.
// Selectors use CodeMirror's EditorView.theme conventions:
//   '&' = the editor host element
//   '.cm-gutters' = the line-number gutter
//   '.cm-activeLine', '.cm-cursor', '.cm-selectionBackground', etc.
export type ThemeRules = Record<string, Record<string, string | number>>

// .tok-* selector → CSS-prop-bag. Identical to Overleaf's highlightStyle shape.
// Class names come from the tagHighlighter (see features/code-editor/extensions/latex-language.ts).
export type HighlightRules = Record<string, Record<string, string | number>>

export interface UnderleafTheme {
  id: string
  name: string
  dark: boolean
  chrome: ChromeColors
  theme: ThemeRules
  highlightStyle: HighlightRules
}
