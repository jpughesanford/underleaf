import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { Extension, RangeSetBuilder, StateEffect, EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { getSpeller, spellerSync } from '../spellcheck/speller'

// Prose lives in `Normal` nodes (verified against the grammar). Commands, math,
// comments, verbatim, URLs and file paths are distinct node types and are never
// `Normal`, so they're skipped for free. The one exception: identifier-like
// command arguments (\label{…}, \ref{…}, \cite{…}, \usepackage{…}, …) DO wrap a
// `Normal`, so we skip any `Normal` with one of these argument ancestors. Section
// titles and \emph{…} have no such ancestor and stay checked.
const SKIP_ANCESTORS = new Set([
  'LabelArgument', 'RefArgument', 'BibKeyArgument', 'PackageArgument',
  'DocumentClassArgument', 'FilePathArgument', 'BareFilePathArgument', 'UrlArgument',
])

// Letters with internal apostrophes ("don't", "scholars’"). No digits, so tokens
// like `x2` in prose aren't flagged; single letters are ignored by the caller.
const wordRe = () => /[A-Za-z]+(?:['’][A-Za-z]+)*/g

// A prose `Normal` token that isn't inside an identifier-like argument — the one
// definition of "spell-checkable" shared by the scanner and the context menu.
function isCheckableNormal(node: SyntaxNode): boolean {
  if (node.name !== 'Normal') return false
  for (let p = node.parent; p; p = p.parent) {
    if (SKIP_ANCESTORS.has(p.name)) return false
  }
  return true
}

/**
 * Collect spell-checkable words in [from, to) that satisfy `isWrong`, in
 * ascending document order. Pure (no view, no speller) so it's unit-testable —
 * pass `() => true` to get every checkable word. Exported for tests.
 */
export function collectMisspellings(
  state: EditorState,
  from: number,
  to: number,
  isWrong: (word: string) => boolean,
): { from: number; to: number; word: string }[] {
  const out: { from: number; to: number; word: string }[] = []
  syntaxTree(state).iterate({
    from, to,
    enter: (node) => {
      if (!isCheckableNormal(node.node)) return
      const text = state.doc.sliceString(node.from, node.to)
      const re = wordRe()
      let m: RegExpExecArray | null
      while ((m = re.exec(text))) {
        if (m[0].length < 2) continue
        if (isWrong(m[0])) {
          const start = node.from + m.index
          out.push({ from: start, to: start + m[0].length, word: m[0] })
        }
      }
    },
  })
  return out
}

const spellMark = Decoration.mark({ class: 'cm-spell-error' })

/** Dispatch this to force a re-check (after the dictionary loads, or a word is added). */
export const recheckSpelling = StateEffect.define<null>()

function buildDecorations(view: EditorView): DecorationSet {
  const speller = spellerSync()
  if (!speller) return Decoration.none
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    for (const r of collectMisspellings(view.state, from, to, (w) => !speller.correct(w))) {
      builder.add(r.from, r.to, spellMark)
    }
  }
  return builder.finish()
}

// The plugin captures the active language so it can ask the speller to (re)load
// when reconfigured (e.g. the user picks a different dictionary in Settings).
function makeSpellPlugin(lang: string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      private destroyed = false
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view)
        // Kick off (or switch to) this language's dictionary, then re-check once
        // it's ready — unless the editor was torn down while we were loading.
        // getSpeller already logs load failures, so the rejection is a no-op here.
        getSpeller(lang)
          .then(() => { if (!this.destroyed) view.dispatch({ effects: recheckSpelling.of(null) }) })
          .catch(() => {})
      }
      update(u: ViewUpdate) {
        if (
          u.docChanged || u.viewportChanged ||
          u.transactions.some((tr) => tr.effects.some((e) => e.is(recheckSpelling)))
        ) {
          this.decorations = buildDecorations(u.view)
        }
      }
      destroy() { this.destroyed = true }
    },
    { decorations: (v) => v.decorations },
  )
}

const spellTheme = EditorView.theme({
  '.cm-spell-error': {
    textDecoration: 'underline wavy var(--color-error, #e5484d)',
    textDecorationSkipInk: 'none',
    textUnderlineOffset: '2px',
  },
})

export function spellcheckExtension(lang: string): Extension {
  return [makeSpellPlugin(lang), spellTheme]
}

// ─── Context-menu support ───────────────────────────────────────────────────
export interface SpellWord {
  from: number
  to: number
  word: string
  suggestions: string[]
}

/** The misspelled word at `pos`, with suggestions — or null if none/correct. */
export function spellWordAt(view: EditorView, pos: number): SpellWord | null {
  const speller = spellerSync()
  if (!speller) return null
  const line = view.state.doc.lineAt(pos)
  const rel = pos - line.from
  const re = wordRe()
  let m: RegExpExecArray | null
  while ((m = re.exec(line.text))) {
    const s = m.index
    const e = m.index + m[0].length
    if (rel < s || rel > e) continue
    const from = line.from + s
    if (!isCheckablePos(view.state, from)) return null
    if (m[0].length < 2 || speller.correct(m[0])) return null
    return { from, to: line.from + e, word: m[0], suggestions: speller.suggest(m[0]) }
  }
  return null
}

function isCheckablePos(state: EditorState, pos: number): boolean {
  return isCheckableNormal(syntaxTree(state).resolveInner(pos, 1))
}
