import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { EditorState, Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting, HighlightStyle, syntaxTree } from '@codemirror/language'
import { latex } from 'codemirror-lang-latex'
import { tags as t } from '@lezer/highlight'
import { Decoration, DecorationSet } from '@codemirror/view'
import { StateField, StateEffect, Text } from '@codemirror/state'
import { RangeSetBuilder } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'
import { latexCompletions } from './latexCompletions'

interface Props {
  filePath: string
  content: string
  onChange: (content: string) => void
  onSave: () => void
}

export interface EditorPaneHandle {
  jump: (line: number) => void
}

// All colors via CSS variables — defined once, updated by ThemeContext on :root
const underleafTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--editor-fg)',
  },
  '.cm-content': {
    caretColor: 'var(--editor-cursor)',
    padding: '8px 0',
  },
  '.cm-cursor': { borderLeftColor: 'var(--editor-cursor)' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--editor-selection) !important' },
  '.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--editor-selection-focused) !important' },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-gutter-bg)',
    color: 'var(--editor-gutter-fg)',
    border: 'none',
    borderRight: '1px solid var(--editor-gutter-border)',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 4px' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--editor-active-line-gutter)', color: 'var(--editor-gutter-fg)' },
  '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
  '.cm-matchingBracket': { backgroundColor: 'var(--editor-bracket-match)', outline: '1px solid var(--editor-bracket-match)' },
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
  '.cm-foldGutter': { padding: '0 4px' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--editor-fold-placeholder)',
    border: '1px solid var(--editor-bracket-match)',
    color: 'var(--color-brand)',
  },
  '.cm-error-line': {
    backgroundColor: 'var(--editor-error-line) !important',
    borderLeft: '3px solid var(--syntax-error)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'var(--editor-search-match)',
    outline: '1px solid var(--editor-search-match)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--editor-search-match-sel)' },
  // LaTeX syntax CSS classes
  '.cm-latex-cmd':            { color: 'var(--syntax-command)' },
  '.cm-latex-cmd-structural': { color: 'var(--syntax-structural)', fontWeight: '500' },
  '.cm-latex-cmd-cite':       { color: 'var(--syntax-cite)' },
  '.cm-latex-math-cmd':       { color: 'var(--syntax-math-cmd)' },
  '.cm-latex-math-token':     { color: 'var(--syntax-math-token)' },
  '.cm-latex-env':            { color: 'var(--syntax-env-name)', fontStyle: 'italic' },
  '.cm-latex-label-content':  { color: 'var(--syntax-label)' },
}, { dark: false })

const latexHighlight = HighlightStyle.define([
  { tag: t.keyword,               color: 'var(--syntax-begin-end)' },
  { tag: t.definitionKeyword,     color: 'var(--syntax-command)' },
  { tag: t.heading,               color: 'var(--syntax-structural)' },
  { tag: t.quote,                 color: 'var(--syntax-command)' },
  { tag: t.monospace,             color: 'var(--syntax-command)' },
  { tag: t.className,             color: 'var(--syntax-env-name)', fontStyle: 'italic' },
  { tag: t.comment,               color: 'var(--syntax-comment)', fontStyle: 'italic' },
  { tag: t.processingInstruction, color: 'var(--syntax-math-delim)' },
  { tag: t.meta,                  color: 'var(--syntax-text)' },
  { tag: t.string,                color: 'var(--syntax-text)', fontStyle: 'italic' },
  { tag: t.strong,                color: 'var(--syntax-text)' },
  { tag: t.emphasis,              color: 'var(--syntax-text)' },
  { tag: t.bracket,               color: 'var(--syntax-text)' },
  { tag: t.content,               color: 'var(--syntax-text)' },
  { tag: t.invalid,               color: 'var(--syntax-error)' },
])

// ─── Decorator marks ──────────────────────────────────────────────────────────

const cmdMark       = Decoration.mark({ class: 'cm-latex-cmd' })
const structMark    = Decoration.mark({ class: 'cm-latex-cmd-structural' })
const citeMark      = Decoration.mark({ class: 'cm-latex-cmd-cite' })
const mathCmdMark   = Decoration.mark({ class: 'cm-latex-math-cmd' })
const mathTokenMark = Decoration.mark({ class: 'cm-latex-math-token' })
const envMark       = Decoration.mark({ class: 'cm-latex-env' })
const labelMark     = Decoration.mark({ class: 'cm-latex-label-content' })

const MATH_CONTAINERS = new Set([
  'DollarMath', 'InlineMath', 'DisplayMath', 'BracketMath', 'ParenMath', 'Math',
  'EquationEnvironment', 'EquationArrayEnvironment',
])

// LabelArgument / RefArgument have dedicated parser node types
const LABEL_ARG_CONTAINERS = new Set(['LabelArgument', 'RefArgument'])

const MATH_SKIP_LEAVES = new Set([
  'OpenBrace', 'CloseBrace',
  'Begin', 'End',
  'Comment',
  'Whitespace', 'BlankLine', 'NewLine',
])

const STRUCTURAL_CMDS = new Set([
  'chapter', 'section', 'subsection', 'subsubsection',
  'paragraph', 'subparagraph', 'part', 'appendix',
])

// Commands that reference external keys — colored as "cite/link"
const REFERENCE_CMDS = new Set([
  'cite', 'citep', 'citet', 'citealt', 'citealp', 'citenum', 'nocite',
  'ref', 'eqref', 'pageref', 'vref', 'autoref', 'nameref', 'cref',
  'label',
  'input', 'include', 'includeonly',
  'includegraphics', 'includepdf',
  'usepackage', 'documentclass',
  'bibliography', 'bibliographystyle',
])

function getCmdMark(cmdText: string): typeof cmdMark {
  if (STRUCTURAL_CMDS.has(cmdText)) return structMark
  if (REFERENCE_CMDS.has(cmdText)) return citeMark
  return cmdMark
}

// Returns true if the leaf node is inside a TextArgument of a reference command
function isRefTextArg(
  leafParent: SyntaxNode,
  cache: Map<number, boolean>,
  state: EditorState,
): boolean {
  if (leafParent.name !== 'TextArgument') return false
  const key = leafParent.from
  if (cache.has(key)) return cache.get(key)!
  const cmd = leafParent.parent
  if (!cmd) { cache.set(key, false); return false }
  let child = cmd.firstChild
  while (child && !child.name.endsWith('CtrlSeq')) child = child.nextSibling
  if (!child) { cache.set(key, false); return false }
  const name = state.sliceDoc(child.from + 1, child.to)
  const result = REFERENCE_CMDS.has(name)
  cache.set(key, result)
  return result
}

const latexCmdDecorator = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = this.build(view) }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view)
    }
    build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>()
      const state = view.state
      let mathDepth = 0
      let labelDepth = 0
      const refArgCache = new Map<number, boolean>()

      syntaxTree(state).iterate({
        from: view.viewport.from,
        to: view.viewport.to,
        enter(node) {
          const name = node.name

          if (MATH_CONTAINERS.has(name)) { mathDepth++; return }
          if (LABEL_ARG_CONTAINERS.has(name)) { labelDepth++; return }

          if (name.endsWith('CtrlSeq')) {
            if (mathDepth > 0) {
              builder.add(node.from, node.to, mathCmdMark)
            } else {
              const cmdText = state.sliceDoc(node.from + 1, node.to)
              builder.add(node.from, node.to, getCmdMark(cmdText))
            }
            return false
          }

          // Env name nodes (inside \begin{} and \end{})
          if (name.endsWith('EnvName')) {
            builder.add(node.from, node.to, envMark)
            return false
          }

          const isLeaf = node.node.firstChild === null
          if (!isLeaf) return

          // Label/ref argument content
          if (labelDepth > 0 && name !== 'OpenBrace' && name !== 'CloseBrace') {
            builder.add(node.from, node.to, labelMark)
            return false
          }

          // TextArgument of a reference command
          const parent = node.node.parent
          if (
            parent &&
            name !== 'OpenBrace' && name !== 'CloseBrace' && name !== 'Comment' &&
            name !== 'Whitespace' && name !== 'BlankLine' && name !== 'NewLine' &&
            isRefTextArg(parent, refArgCache, state)
          ) {
            builder.add(node.from, node.to, labelMark)
            return false
          }

          // Leaf tokens inside math
          if (
            mathDepth > 0 &&
            !MATH_SKIP_LEAVES.has(name) &&
            !name.endsWith('EnvName') &&
            !name.endsWith('CtrlSeq')
          ) {
            builder.add(node.from, node.to, mathTokenMark)
          }
        },
        leave(node) {
          if (MATH_CONTAINERS.has(node.name)) mathDepth--
          else if (LABEL_ARG_CONTAINERS.has(node.name)) labelDepth--
        },
      })

      return builder.finish()
    }
  },
  { decorations: v => v.decorations },
)

// ─── Error line highlight ──────────────────────────────────────────────────────

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
    latex({ enableAutocomplete: false, enableLinting: false, enableTooltips: false, autoCloseBrackets: false, autoCloseTags: false }),
    syntaxHighlighting(latexHighlight),
    latexCmdDecorator,
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
    underleafTheme,
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
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const contentRef = useRef(content)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)

  onChangeRef.current = onChange
  onSaveRef.current = onSave

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
