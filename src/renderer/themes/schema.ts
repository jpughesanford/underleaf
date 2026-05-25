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
}

// CSS selector → CSS-prop-bag, identical to Overleaf's theme JSON shape.
// Selectors use CodeMirror's EditorView.theme conventions:
//   '&' = the editor host element
//   '.cm-gutters' = the line-number gutter
//   '.cm-activeLine', '.cm-cursor', '.cm-selectionBackground', etc.
export type ThemeRules = Record<string, Record<string, string | number>>

// .tok-* selector → CSS-prop-bag. Identical to Overleaf's highlightStyle shape.
// Class names come from the tagHighlighter (see latexStyleTags.ts).
export type HighlightRules = Record<string, Record<string, string | number>>

export interface UnderleafTheme {
  id: string
  name: string
  dark: boolean
  chrome: ChromeColors
  theme: ThemeRules
  highlightStyle: HighlightRules
}
