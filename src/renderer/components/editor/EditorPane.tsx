import React, { useEffect, useRef, useCallback } from 'react'
import { EditorState, Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { latexCompletions } from './latexCompletions'

interface Props {
  filePath: string
  content: string
  onChange: (content: string) => void
  onSave: () => void
}

const underleafTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
    backgroundColor: '#1e1e2e',
  },
  '.cm-content': {
    caretColor: '#4CAF50',
    padding: '8px 0',
  },
  '.cm-cursor': { borderLeftColor: '#4CAF50' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(76,175,80,0.2) !important' },
  '.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(76,175,80,0.25) !important' },
  '.cm-gutters': {
    backgroundColor: '#181825',
    color: '#4a5568',
    border: 'none',
    borderRight: '1px solid #2d3f55',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 4px' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(76,175,80,0.08)' },
  '.cm-activeLine': { backgroundColor: 'rgba(76,175,80,0.05)' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(76,175,80,0.2)', outline: '1px solid rgba(76,175,80,0.4)' },
  '.cm-tooltip': { backgroundColor: '#1e293b', border: '1px solid #2d3f55', borderRadius: '6px' },
  '.cm-tooltip-autocomplete': { backgroundColor: '#1e293b' },
  '.cm-tooltip-autocomplete ul li': { color: '#e2e8f0' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'rgba(76,175,80,0.2)', color: '#4CAF50' },
  '.cm-foldGutter': { padding: '0 4px' },
  '.cm-foldPlaceholder': { backgroundColor: 'rgba(76,175,80,0.15)', border: 'none', color: '#4CAF50' },
}, { dark: true })

// Conflict marker decoration
import { Decoration, DecorationSet } from '@codemirror/view'
import { StateField, StateEffect, Text } from '@codemirror/state'
import { RangeSetBuilder } from '@codemirror/state'

const conflictOursMark = Decoration.line({ attributes: { style: 'background: rgba(76,175,80,0.12); border-left: 3px solid #4CAF50;' } })
const conflictTheirsMark = Decoration.line({ attributes: { style: 'background: rgba(239,68,68,0.12); border-left: 3px solid #ef4444;' } })
const conflictMarkerMark = Decoration.line({ attributes: { style: 'background: rgba(251,191,36,0.1); border-left: 3px solid #fbbf24;' } })

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
      inOurs = false
      inTheirs = true
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

function buildExtensions(onChange: (val: string) => void, onSave: () => void): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    autocompletion({ override: [latexCompletions] }),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      indentWithTab,
      { key: 'Mod-s', run: () => { onSave(); return true } },
    ]),
    oneDark,
    underleafTheme,
    conflictHighlighter,
    EditorView.updateListener.of(update => {
      if (update.docChanged) {
        onChange(update.state.doc.toString())
      }
    }),
    EditorView.lineWrapping,
  ]
}

export default function EditorPane({ filePath, content, onChange, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const contentRef = useRef(content)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)

  // Keep refs pointing at the latest callbacks without recreating the editor
  onChangeRef.current = onChange
  onSaveRef.current = onSave

  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: buildExtensions(
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

  // Sync external content changes (e.g. initial load) without recreating
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
}
