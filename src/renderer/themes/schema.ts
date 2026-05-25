export interface SyntaxTokens {
  text: string
  command: string
  commandStructural: string
  commandCite: string
  beginEnd: string
  envName: string
  labelContent: string
  comment: string
  mathDelim: string
  mathCommand: string
  mathToken: string
  error: string
}

export interface EditorColors {
  bg: string
  fg: string
  cursor: string
  selection: string
  selectionFocused: string
  activeLine: string
  activeLineGutter: string
  gutterBg: string
  gutterFg: string
  gutterBorder: string
  bracketMatch: string
  foldPlaceholder: string
  searchMatch: string
  searchMatchSelected: string
  errorLine: string
  syntax: SyntaxTokens
}

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

export interface UnderleafTheme {
  id: string
  name: string
  dark: boolean
  chrome: ChromeColors
  editor: EditorColors
}
