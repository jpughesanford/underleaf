import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { EditorState, Extension, Compartment, StateField, StateEffect, Text } from '@codemirror/state'
import {
  EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine,
  Decoration, DecorationSet,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab, insertNewline } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
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
    autocompletion({ override: [latexCompletions] }),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      { key: 'Enter', run: insertNewline },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
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
