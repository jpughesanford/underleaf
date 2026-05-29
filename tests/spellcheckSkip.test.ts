import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { LanguageSupport, ensureSyntaxTree } from '@codemirror/language'
import { overleafLatexLanguage } from '../src/renderer/features/code-editor/extensions/latex-language'
import { collectMisspellings } from '../src/renderer/features/code-editor/extensions/spellcheck'

// Force a full parse, then collect every checkable word (isWrong = always true).
function checkableWords(doc: string): string[] {
  const state = EditorState.create({ doc, extensions: [new LanguageSupport(overleafLatexLanguage)] })
  ensureSyntaxTree(state, doc.length, 5000)
  return collectMisspellings(state, 0, doc.length, () => true).map(r => r.word)
}

describe('collectMisspellings — LaTeX-aware skipping', () => {
  it('checks prose (incl. section titles) but skips commands, math, comments', () => {
    const words = checkableWords('Hello world \\section{Title Here} $x + y$ % a comment note\n')
    expect(words).toContain('Hello')
    expect(words).toContain('world')
    expect(words).toContain('Title')   // \section{} arg is rendered prose
    expect(words).toContain('Here')
    expect(words).not.toContain('section')
    expect(words).not.toContain('note')   // inside a % comment
    expect(words).not.toContain('x')
    expect(words).not.toContain('y')
  })

  it('skips identifier-like arguments (label/ref/cite/usepackage)', () => {
    const words = checkableWords(
      'See \\ref{fig:plot} and \\cite{Knuth} per \\label{sec:intro}\n\\usepackage{amsmath}',
    )
    expect(words).toEqual(expect.arrayContaining(['See', 'and', 'per']))
    for (const skipped of ['fig', 'plot', 'Knuth', 'sec', 'intro', 'amsmath']) {
      expect(words).not.toContain(skipped)
    }
  })

  it('checks \\emph and href display text', () => {
    const words = checkableWords('\\emph{wonderful} \\href{http://x.com}{click here}')
    expect(words).toEqual(expect.arrayContaining(['wonderful', 'click', 'here']))
    expect(words).not.toContain('http')
    expect(words).not.toContain('com')
  })

  it('returns ascending ranges with correct offsets', () => {
    const doc = 'alpha beta'
    const state = EditorState.create({ doc, extensions: [new LanguageSupport(overleafLatexLanguage)] })
    ensureSyntaxTree(state, doc.length, 5000)
    const res = collectMisspellings(state, 0, doc.length, () => true)
    expect(res.map(r => doc.slice(r.from, r.to))).toEqual(['alpha', 'beta'])
  })

  it('ignores single letters', () => {
    expect(checkableWords('a banana I ate')).not.toContain('a')
  })
})
