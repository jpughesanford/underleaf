import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { EditorState, Extension, Compartment, StateField, StateEffect, Text } from '@codemirror/state'
import {
  EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine,
  Decoration, DecorationSet,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab, insertNewline } from '@codemirror/commands'
import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, acceptCompletion } from '@codemirror/autocomplete'
import {
  bracketMatching, foldGutter, foldKeymap, syntaxHighlighting,
  LanguageSupport,
} from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { overleafLatexLanguage, overleafClassHighlighter } from './latexStyleTags'
import { latexCompletions } from './latexCompletions'
import { useTheme } from '../../context/ThemeContext'
import { UnderleafTheme } from '../../themes/schema'

interface Props {
  filePath: string
  content: string
  onChange: (content: string) => void
  onSave: () => void
}

export interface EditorPaneHandle {
  jump: (line: number) => void
}

// Overleaf-identical language pipeline lives in latexStyleTags.ts.
// Wrap the LRLanguage in a LanguageSupport so we can stuff it into the
// extension list like any other extension.
const overleafLatex = new LanguageSupport(overleafLatexLanguage)

// Selectors for the pure-CSS tooltips on the find/replace panel. Kept as
// constants so the giant compound selector strings stay readable and the theme
// object below isn't cluttered.
const FIND_REPLACE_TOOLTIP_ELEMENTS = [
  '.cm-panel.cm-search label:has(input[name="case"])',
  '.cm-panel.cm-search label:has(input[name="re"])',
  '.cm-panel.cm-search label:has(input[name="word"])',
  '.cm-panel.cm-search button[name="prev"]',
  '.cm-panel.cm-search button[name="next"]',
  '.cm-panel.cm-search button[name="replace"]',
  '.cm-panel.cm-search button[name="replaceAll"]',
  '.cm-panel.cm-search button[name="close"]',
]
const FIND_REPLACE_TOOLTIP_SELECTORS = FIND_REPLACE_TOOLTIP_ELEMENTS
  .map(s => `${s}::after`).join(', ')
const FIND_REPLACE_TOOLTIP_HOVER_SELECTORS = FIND_REPLACE_TOOLTIP_ELEMENTS
  .map(s => `${s}:hover::after`).join(', ')

// ─── Base editor theme (font/padding only — colors come from per-theme JSON) ──
const baseEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
  },
  '.cm-content': { padding: '8px 0' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 4px' },
  '.cm-foldGutter': { padding: '0 4px' },
  '.cm-tooltip': {
    backgroundColor: 'var(--color-bg-modal)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  '.cm-tooltip-autocomplete': { backgroundColor: 'var(--color-bg-modal)' },
  '.cm-tooltip-autocomplete ul li': { color: 'var(--color-text-primary)' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'rgba(76,175,80,0.15)',
    color: 'var(--color-brand)',
  },
  // CodeMirror prepends a glyph for each completion type via ::before. Hide it
  // so the icons we deliberately omit don't render as default unicode (e.g. 🔑).
  '.cm-tooltip-autocomplete .cm-completionIcon': { display: 'none' },

  // ─── Search & replace panel (Overleaf-style 2-row layout) ───────────────
  // CodeMirror produces flat siblings + a <br> separator. We use display: flex
  // with `flex-wrap: wrap`, force the <br> to break the row, and use `order`
  // to rearrange the natural DOM order into Overleaf's visual layout.
  '.cm-panels': {
    backgroundColor: 'var(--color-bg-panel)',
    color: 'var(--color-text-primary)',
    borderColor: 'var(--color-border)',
  },
  '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--color-border)' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--color-border)' },

  '.cm-panel.cm-search': {
    // 6-col grid. Col 1 shrinks down to 40px so the inputs never push the
    // toggles or buttons off-screen. Cols 5/6 each hold one half of a paired
    // pill — the arrows pill on row 1 and the Replace/Replace All pill on
    // row 2. Both pills span the same two columns so they have identical width.
    display: 'grid',
    gridTemplateColumns:
      'minmax(40px, 1fr) auto auto auto minmax(72px, max-content) minmax(72px, max-content)',
    gridTemplateRows: 'auto auto',
    alignItems: 'center',
    rowGap: '10px',
    columnGap: '4px',
    padding: '12px 48px 12px 14px',
    fontSize: '12px',
    fontFamily: 'var(--font-sans)',
    position: 'relative',
  },
  '.cm-panel.cm-search br': { display: 'none' },
  '.cm-panel.cm-search button[name="select"]': { display: 'none' },

  // ── Grid placement ───────────────────────────────────────────────────────
  // Row 1: search input | Aa | [.*] | W | prev | next
  // Row 2: replace input (spans cols 1-4)         | Replace | Replace All
  '.cm-panel.cm-search input[name="search"]':          { gridRow: '1', gridColumn: '1' },
  '.cm-panel.cm-search label:has(input[name="case"])': { gridRow: '1', gridColumn: '2', marginLeft: '6px' },
  '.cm-panel.cm-search label:has(input[name="re"])':   { gridRow: '1', gridColumn: '3' },
  '.cm-panel.cm-search label:has(input[name="word"])': { gridRow: '1', gridColumn: '4', marginRight: '4px' },
  '.cm-panel.cm-search input[name="replace"]':         { gridRow: '2', gridColumn: '1 / 5' },

  // ── Text fields (pill-shaped, shrinkable) ────────────────────────────────
  '.cm-panel.cm-search input.cm-textfield': {
    width: '100%',
    minWidth: '0', // allow the input to shrink below its intrinsic content width
    backgroundColor: 'var(--color-bg-input)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: '999px',
    padding: '7px 16px',
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 120ms',
  },
  '.cm-panel.cm-search input.cm-textfield:focus': {
    borderColor: 'var(--color-brand)',
  },

  // ── Toggle pills (Aa / .* / W) ───────────────────────────────────────────
  '.cm-panel.cm-search label': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '30px',
    borderRadius: '999px',
    cursor: 'pointer',
    fontSize: '0',
    backgroundColor: 'var(--color-bg-input)',
    border: '1px solid var(--color-border)',
    userSelect: 'none',
    transition: 'background 120ms, border-color 120ms',
    position: 'relative',
    flexShrink: 0,
  },
  '.cm-panel.cm-search label input[type="checkbox"]': { display: 'none' },
  '.cm-panel.cm-search label::before': {
    fontSize: '11px',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    color: 'var(--color-text-secondary)',
    transition: 'color 120ms',
  },
  '.cm-panel.cm-search label:has(input[name="case"])::before': { content: '"Aa"' },
  '.cm-panel.cm-search label:has(input[name="re"])::before':   { content: '"[.*]"' },
  '.cm-panel.cm-search label:has(input[name="word"])::before': { content: '"W"' },
  '.cm-panel.cm-search label:hover': {
    backgroundColor: 'var(--color-bg-card-hover)',
  },
  '.cm-panel.cm-search label:has(input:checked)': {
    backgroundColor: 'rgba(76, 175, 80, 0.18)',
    borderColor: 'var(--color-brand)',
  },
  '.cm-panel.cm-search label:has(input:checked)::before': {
    color: 'var(--color-brand)',
  },

  // ── Connected pills (arrows on row 1, Replace/Replace All on row 2) ──────
  // Both pills share the SAME grid columns (5 + 6), so they end up with
  // identical width. Each half fills its cell via justify-self: stretch; the
  // right half uses margin-left: -4px to absorb the column gap and fuse the
  // two halves into one continuous pill divided by a 1px internal border.
  '.cm-panel.cm-search button[name="prev"]':       { gridRow: '1', gridColumn: '5' },
  '.cm-panel.cm-search button[name="next"]':       { gridRow: '1', gridColumn: '6' },
  '.cm-panel.cm-search button[name="replace"]':    { gridRow: '2', gridColumn: '5' },
  '.cm-panel.cm-search button[name="replaceAll"]': { gridRow: '2', gridColumn: '6' },

  // Shared half styling — both pills, both halves
  [[
    '.cm-panel.cm-search button[name="prev"]',
    '.cm-panel.cm-search button[name="next"]',
    '.cm-panel.cm-search button[name="replace"]',
    '.cm-panel.cm-search button[name="replaceAll"]',
  ].join(', ')]: {
    justifySelf: 'stretch',
    height: '32px',
    padding: '0 12px',
    fontSize: '12px',
    fontFamily: 'var(--font-sans)',
    fontWeight: '600',
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-bg-input)',
    backgroundImage: 'none',
    border: '1px solid var(--color-border)',
    cursor: 'pointer',
    transition: 'background 120ms',
    position: 'relative',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Left half: rounded only on the left, internal divider on the right
  [[
    '.cm-panel.cm-search button[name="prev"]',
    '.cm-panel.cm-search button[name="replace"]',
  ].join(', ')]: {
    borderRadius: '999px 0 0 999px',
  },

  // Right half: rounded only on the right, no left border, pulled left to
  // close the column gap so the two halves visually touch.
  [[
    '.cm-panel.cm-search button[name="next"]',
    '.cm-panel.cm-search button[name="replaceAll"]',
  ].join(', ')]: {
    borderRadius: '0 999px 999px 0',
    borderLeft: 'none',
    marginLeft: '-4px',
  },

  // Arrows are CSS triangles — guaranteed identical dimensions regardless of font
  '.cm-panel.cm-search button[name="prev"], .cm-panel.cm-search button[name="next"]': {
    padding: '0',
    fontSize: '0',
  },
  '.cm-panel.cm-search button[name="prev"]::before': {
    content: '""',
    width: '0',
    height: '0',
    borderLeft: '5px solid transparent',
    borderRight: '5px solid transparent',
    borderBottom: '6px solid var(--color-text-primary)',
  },
  '.cm-panel.cm-search button[name="next"]::before': {
    content: '""',
    width: '0',
    height: '0',
    borderLeft: '5px solid transparent',
    borderRight: '5px solid transparent',
    borderTop: '6px solid var(--color-text-primary)',
  },

  // Hover for the pill halves
  [[
    '.cm-panel.cm-search button[name="prev"]:hover',
    '.cm-panel.cm-search button[name="next"]:hover',
    '.cm-panel.cm-search button[name="replace"]:hover',
    '.cm-panel.cm-search button[name="replaceAll"]:hover',
  ].join(', ')]: {
    backgroundColor: 'var(--color-bg-card-hover)',
  },

  // ── Close X (absolutely positioned top-right of the panel) ───────────────
  '.cm-panel.cm-search button[name="close"]': {
    position: 'absolute',
    top: '12px',
    right: '12px',
    width: '28px',
    height: '28px',
    padding: '0',
    fontSize: '18px',
    lineHeight: '1',
    color: 'var(--color-text-muted)',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  '.cm-panel.cm-search button[name="close"]:hover': {
    backgroundColor: 'var(--color-bg-card-hover)',
    color: 'var(--color-text-primary)',
  },

  // ── Tooltips ─────────────────────────────────────────────────────────────
  // Pure-CSS tooltips via ::after — content is set per-control so they don't
  // depend on title= attributes (which CodeMirror doesn't expose).
  [FIND_REPLACE_TOOLTIP_SELECTORS]: {
    position: 'absolute',
    bottom: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--color-bg-modal)',
    color: 'var(--color-text-primary)',
    padding: '4px 8px',
    borderRadius: '5px',
    border: '1px solid var(--color-border)',
    fontSize: '11px',
    fontFamily: 'var(--font-sans)',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    opacity: '0',
    pointerEvents: 'none',
    transition: 'opacity 120ms 250ms',
    zIndex: '10',
    boxShadow: 'var(--shadow-sm)',
  },
  [FIND_REPLACE_TOOLTIP_HOVER_SELECTORS]: {
    opacity: '1',
  },
  '.cm-panel.cm-search label:has(input[name="case"])::after':  { content: '"Match case"' },
  '.cm-panel.cm-search label:has(input[name="re"])::after':    { content: '"Use regex"' },
  '.cm-panel.cm-search label:has(input[name="word"])::after':  { content: '"Match whole word"' },
  '.cm-panel.cm-search button[name="prev"]::after':            { content: '"Previous match"' },
  '.cm-panel.cm-search button[name="next"]::after':            { content: '"Next match"' },
  '.cm-panel.cm-search button[name="replace"]::after':         { content: '"Replace"' },
  '.cm-panel.cm-search button[name="replaceAll"]::after':      { content: '"Replace all"' },
  '.cm-panel.cm-search button[name="close"]::after':           { content: '"Close"' },
})

// ─── Theme + highlight extensions, built from a UnderleafTheme JSON ──────────
// Mirrors Overleaf's services/web/.../extensions/theme.ts: two EditorView.theme
// extensions, one for the `theme` block and one for the `highlightStyle` block.
function buildThemeExtension(theme: UnderleafTheme): Extension {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EditorView.theme(theme.theme as any, { dark: theme.dark }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EditorView.theme(theme.highlightStyle as any, { dark: theme.dark }),
  ]
}

const themeCompartment = new Compartment()

// ─── Error line highlight ─────────────────────────────────────────────────────
const setErrorLine = StateEffect.define<number | null>()
const errorLineDeco = Decoration.line({ attributes: { class: 'cm-error-line' } })
const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(setErrorLine)) {
        if (e.value === null) return Decoration.none
        try {
          const line = tr.state.doc.line(e.value)
          return Decoration.set([errorLineDeco.range(line.from)])
        } catch { return Decoration.none }
      }
    }
    return decos.map(tr.changes)
  },
  provide: f => EditorView.decorations.from(f),
})

// ─── Conflict highlight ────────────────────────────────────────────────────────
const conflictOursMark    = Decoration.line({ attributes: { style: 'background: rgba(76,175,80,0.15); border-left: 3px solid #2e7d32;' } })
const conflictTheirsMark  = Decoration.line({ attributes: { style: 'background: rgba(239,68,68,0.1); border-left: 3px solid #c62828;' } })
const conflictMarkerMark  = Decoration.line({ attributes: { style: 'background: rgba(245,158,11,0.12); border-left: 3px solid #f59e0b;' } })

function conflictDecorations(doc: Text): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  let inOurs = false, inTheirs = false

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const text = line.text
    const from = line.from
    if (text.startsWith('<<<<<<<')) {
      inOurs = true
      builder.add(from, from, conflictMarkerMark)
    } else if (text.startsWith('=======') && inOurs) {
      inOurs = false; inTheirs = true
      builder.add(from, from, conflictMarkerMark)
    } else if (text.startsWith('>>>>>>>') && inTheirs) {
      inTheirs = false
      builder.add(from, from, conflictMarkerMark)
    } else if (inOurs) {
      builder.add(from, from, conflictOursMark)
    } else if (inTheirs) {
      builder.add(from, from, conflictTheirsMark)
    }
  }

  return builder.finish()
}

const conflictHighlighter = StateField.define<DecorationSet>({
  create(state) { return conflictDecorations(state.doc) },
  update(decos, tr) {
    if (tr.docChanged) return conflictDecorations(tr.newDoc)
    return decos
  },
  provide: f => EditorView.decorations.from(f),
})

// ─── Extension builder ────────────────────────────────────────────────────────
function buildExtensions(
  initialTheme: UnderleafTheme,
  onChange: (val: string) => void,
  onSave: () => void,
): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    overleafLatex,
    syntaxHighlighting(overleafClassHighlighter),
    bracketMatching(),
    closeBrackets(),
    // defaultKeymap: false disables autocompletion's high-priority Enter→accept
    // binding, so Enter just inserts a newline. Tab is bound below via acceptCompletion.
    autocompletion({ override: [latexCompletions], defaultKeymap: false }),
    // literal: true makes \r / \n / \t in the search field be treated as those
    // literal characters instead of escape sequences. Without this, searching
    // for "$\rho$" interprets \r as a carriage return and finds no matches —
    // critical for LaTeX where \-prefixed tokens are everywhere.
    search({ literal: true }),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      { key: 'Enter', run: insertNewline },
      // Tab accepts an active completion; falls through to indentWithTab otherwise.
      { key: 'Tab', run: acceptCompletion },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      // Strip Enter from the popup keymap so it can never re-accept the completion.
      // Arrow / PageUp/Down / Escape navigation for the popup stays.
      ...completionKeymap.filter(k => k.key !== 'Enter'),
      indentWithTab,
      { key: 'Mod-s', run: () => { onSave(); return true } },
    ]),
    baseEditorTheme,
    themeCompartment.of(buildThemeExtension(initialTheme)),
    conflictHighlighter,
    errorLineField,
    EditorView.updateListener.of(update => {
      if (update.docChanged) onChange(update.state.doc.toString())
    }),
    EditorView.lineWrapping,
  ]
}

// ─── Component ────────────────────────────────────────────────────────────────
const EditorPane = forwardRef<EditorPaneHandle, Props>(function EditorPane(
  { filePath, content, onChange, onSave },
  ref,
) {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const contentRef = useRef(content)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  const themeRef = useRef(theme)

  onChangeRef.current = onChange
  onSaveRef.current = onSave
  themeRef.current = theme

  useImperativeHandle(ref, () => ({
    jump(line: number) {
      const view = viewRef.current
      if (!view || line < 1 || line > view.state.doc.lines) return
      const pos = view.state.doc.line(line).from
      view.dispatch({
        effects: [
          setErrorLine.of(line),
          EditorView.scrollIntoView(pos, { y: 'center' }),
        ],
        selection: { anchor: pos },
      })
      view.focus()
      setTimeout(() => {
        viewRef.current?.dispatch({ effects: setErrorLine.of(null) })
      }, 4000)
    },
  }), [])

  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: buildExtensions(
          themeRef.current,
          (v) => onChangeRef.current(v),
          () => onSaveRef.current(),
        ),
      }),
      parent: containerRef.current,
    })

    viewRef.current = view
    contentRef.current = content

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [filePath]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reactively swap theme without rebuilding the editor
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: themeCompartment.reconfigure(buildThemeExtension(theme)),
    })
  }, [theme])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== content && content !== contentRef.current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content },
      })
      contentRef.current = content
    }
  }, [content])

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', overflow: 'hidden' }}
      className="cm-editor-container"
    />
  )
})

export default EditorPane
