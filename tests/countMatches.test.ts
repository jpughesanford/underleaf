import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { SearchQuery } from '@codemirror/search'
import { countMatches } from '../src/renderer/features/code-editor/extensions/search-panel'

// Build a headless EditorState with the cursor at `anchor` (default 0).
function state(doc: string, anchor = 0) {
  return EditorState.create({ doc, selection: { anchor } })
}

describe('countMatches', () => {
  it('returns 0/0 for an empty query', () => {
    expect(countMatches(state('foo bar'), new SearchQuery({ search: '' }))).toEqual({ current: 0, total: 0 })
  })

  it('returns 0/0 when nothing matches', () => {
    expect(countMatches(state('foo bar'), new SearchQuery({ search: 'xyz' }))).toEqual({ current: 0, total: 0 })
  })

  it('counts all matches', () => {
    const r = countMatches(state('foo bar foo baz foo'), new SearchQuery({ search: 'foo' }))
    expect(r.total).toBe(3)
  })

  it('marks the first match as current when the cursor is at the start', () => {
    const r = countMatches(state('foo bar foo', 0), new SearchQuery({ search: 'foo' }))
    expect(r).toEqual({ current: 1, total: 2 })
  })

  it('advances current to the first match at or after the cursor', () => {
    // matches at 0, 8, 16; cursor at 4 → next match is the 2nd (index 8)
    const r = countMatches(state('foo bar foo baz foo', 4), new SearchQuery({ search: 'foo' }))
    expect(r).toEqual({ current: 2, total: 3 })
  })

  it('wraps current to 1 when the cursor is past the last match', () => {
    const doc = 'foo bar foo'
    // Cursor at end of doc — beyond the last match's start (index 8).
    const r = countMatches(state(doc, doc.length), new SearchQuery({ search: 'foo' }))
    expect(r).toEqual({ current: 1, total: 2 })
  })

  it('treats the query literally (backslash sequences are not escapes)', () => {
    // LaTeX commands like \ref must match as literal text, not regex/escapes.
    const r = countMatches(state('see \\ref{a} and \\ref{b}'), new SearchQuery({ search: '\\ref', literal: true }))
    expect(r.total).toBe(2)
  })
})
