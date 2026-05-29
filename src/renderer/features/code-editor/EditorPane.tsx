import React, { useEffect, useLayoutEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
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
import { overleafLatexLanguage, overleafClassHighlighter } from './extensions/latex-language'
import { latexCompletions } from './extensions/completions'
import { createUnderleafSearchPanel, underleafSearchPanelTheme } from './extensions/search-panel'
import { classifyConflictLines } from './extensions/conflicts'
import { spellcheckExtension, spellWordAt, recheckSpelling, type SpellWord } from './extensions/spellcheck'
import { spellerSync } from './spellcheck/speller'
import { DEFAULT_SPELL_LANGUAGE } from '@shared/spell-languages'
import ContextMenu from '@/ui/ContextMenu'
import { useTheme } from '@/theme/ThemeProvider'
import { UnderleafTheme } from '@/theme/schema'

interface Props {
  filePath: string
  content: string
  onChange: (content: string) => void
  onSave: () => void
  /** Toggle inline spell checking (squiggles + right-click suggestions). */
  spellCheck?: boolean
  /** Dictionary language code (see shared/spell-languages). */
  spellLanguage?: string
}

export interface EditorPaneHandle {
  jump: (line: number) => void
  /** Current caret position as 1-based line + 0-based column, or null if unmounted. */
  getCursor: () => { line: number; column: number } | null
}

// Overleaf-identical language pipeline lives in ./extensions/latex-language.ts.
// Wrap the LRLanguage in a LanguageSupport so we can stuff it into the
// extension list like any other extension.
const overleafLatex = new LanguageSupport(overleafLatexLanguage)

// ─── Base editor theme (font/padding only — colors come from per-theme JSON) ──
// The find/replace panel has its own theme + custom DOM in ./extensions/search-panel.ts.
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
    boxShadow: 'var(--shadow-md)',
  },
  '.cm-tooltip-autocomplete': { backgroundColor: 'var(--color-bg-modal)' },
  '.cm-tooltip-autocomplete ul li': { color: 'var(--color-text-primary)' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--color-brand-tint)',
    color: 'var(--color-brand)',
  },
  // CodeMirror prepends a glyph for each completion type via ::before. Hide it
  // so the icons we deliberately omit don't render as default unicode (e.g. 🔑).
  '.cm-tooltip-autocomplete .cm-completionIcon': { display: 'none' },

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
// Lets spell checking toggle on/off without rebuilding the whole editor.
const spellCompartment = new Compartment()

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
const conflictOursMark    = Decoration.line({ attributes: { style: 'background: var(--color-brand-tint); border-left: 3px solid var(--color-success);' } })
const conflictTheirsMark  = Decoration.line({ attributes: { style: 'background: var(--badge-err-bg); border-left: 3px solid var(--color-error);' } })
const conflictMarkerMark  = Decoration.line({ attributes: { style: 'background: var(--badge-warn-bg); border-left: 3px solid var(--color-warning);' } })

const conflictMarkByKind = {
  marker: conflictMarkerMark,
  ours: conflictOursMark,
  theirs: conflictTheirsMark,
} as const

function conflictDecorations(doc: Text): DecorationSet {
  const lines: string[] = []
  for (let i = 1; i <= doc.lines; i++) lines.push(doc.line(i).text)
  const kinds = classifyConflictLines(lines)

  const builder = new RangeSetBuilder<Decoration>()
  for (let i = 1; i <= doc.lines; i++) {
    const kind = kinds[i - 1]
    if (kind) builder.add(doc.line(i).from, doc.line(i).from, conflictMarkByKind[kind])
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
  spellCheck: boolean,
  spellLanguage: string,
): Extension[] {
  return [
    spellCompartment.of(spellCheck ? spellcheckExtension(spellLanguage) : []),
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
    search({ literal: true, top: true, createPanel: createUnderleafSearchPanel }),
    underleafSearchPanelTheme,
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
  { filePath, content, onChange, onSave, spellCheck = true, spellLanguage = DEFAULT_SPELL_LANGUAGE },
  ref,
) {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const contentRef = useRef(content)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  const themeRef = useRef(theme)
  const spellCheckRef = useRef(spellCheck)
  const spellLanguageRef = useRef(spellLanguage)
  // Right-click spell-suggestion menu (viewport coords + the misspelled word).
  const [spellMenu, setSpellMenu] = useState<{ x: number; y: number; word: SpellWord } | null>(null)
  // Pending jump target — set by jump() when called before the view exists,
  // replayed by the mount effect once the EditorView is ready. Lets the
  // compile panel's jumpToError work even when it opens a not-yet-mounted file.
  const pendingJumpRef = useRef<number | null>(null)

  onChangeRef.current = onChange
  onSaveRef.current = onSave
  themeRef.current = theme
  spellCheckRef.current = spellCheck
  spellLanguageRef.current = spellLanguage

  function runJump(view: EditorView, line: number) {
    if (line < 1 || line > view.state.doc.lines) return
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
  }

  useImperativeHandle(ref, () => ({
    jump(line: number) {
      const view = viewRef.current
      if (view) {
        runJump(view, line)
      } else {
        // View not mounted yet (just opened from a compile error). Stored
        // and replayed in the mount effect below.
        pendingJumpRef.current = line
      }
    },
    getCursor() {
      const view = viewRef.current
      if (!view) return null
      const head = view.state.selection.main.head
      const line = view.state.doc.lineAt(head)
      return { line: line.number, column: head - line.from }
    },
  }), [])

  // useLayoutEffect (not useEffect) so the view exists synchronously after commit.
  useLayoutEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: buildExtensions(
          themeRef.current,
          (v) => onChangeRef.current(v),
          () => onSaveRef.current(),
          spellCheckRef.current,
          spellLanguageRef.current,
        ),
      }),
      parent: containerRef.current,
    })

    viewRef.current = view
    contentRef.current = content

    if (pendingJumpRef.current !== null) {
      const line = pendingJumpRef.current
      pendingJumpRef.current = null
      runJump(view, line)
    }

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

  // Toggle spell checking / switch dictionary language without rebuilding.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: spellCompartment.reconfigure(spellCheck ? spellcheckExtension(spellLanguage) : []),
    })
  }, [spellCheck, spellLanguage])

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

  // Right-click: if the click is on a misspelled word, show suggestions instead
  // of doing nothing (Electron has no native editor menu here).
  function onContextMenu(e: React.MouseEvent) {
    const view = viewRef.current
    if (!view || !spellCheck) return
    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
    if (pos == null) return
    const word = spellWordAt(view, pos)
    if (!word) return
    e.preventDefault()
    setSpellMenu({ x: e.clientX, y: e.clientY, word })
  }

  function applySuggestion(word: SpellWord, suggestion: string) {
    viewRef.current?.dispatch({ changes: { from: word.from, to: word.to, insert: suggestion } })
    setSpellMenu(null)
  }

  function addToDictionary(word: SpellWord) {
    spellerSync()?.add(word.word)
    viewRef.current?.dispatch({ effects: recheckSpelling.of(null) })
    setSpellMenu(null)
  }

  return (
    <>
      <div
        ref={containerRef}
        onContextMenu={onContextMenu}
        style={{ height: '100%', overflow: 'hidden' }}
        className="cm-editor-container"
      />
      {spellMenu && (
        <ContextMenu
          x={spellMenu.x}
          y={spellMenu.y}
          onClose={() => setSpellMenu(null)}
          header={spellMenu.word.suggestions.length ? 'Suggestions' : 'No suggestions'}
        >
          {spellMenu.word.suggestions.map((s) => (
            <ContextMenu.Item key={s} label={s} onClick={() => applySuggestion(spellMenu.word, s)} />
          ))}
          {spellMenu.word.suggestions.length > 0 && <ContextMenu.Separator />}
          <ContextMenu.Item label="Add to dictionary" onClick={() => addToDictionary(spellMenu.word)} />
        </ContextMenu>
      )}
    </>
  )
})

export default EditorPane
