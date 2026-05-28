import { describe, expect, it } from 'vitest'
import {
  parseUnifiedDiff, wholeFileAsAdditions, alignHunk, wordDiff, parseConflicts, hasConflictMarkers,
} from '../src/renderer/features/diff-view/diff-engine'

describe('parseUnifiedDiff', () => {
  it('returns empty for an empty patch', () => {
    const d = parseUnifiedDiff('')
    expect(d.hunks).toEqual([])
    expect(d.additions).toBe(0)
    expect(d.deletions).toBe(0)
  })

  it('parses a single hunk with line numbers and counts', () => {
    const patch = [
      'diff --git a/foo.tex b/foo.tex',
      'index 83db48f..f735c2d 100644',
      '--- a/foo.tex',
      '+++ b/foo.tex',
      '@@ -1,3 +1,3 @@ \\section{Intro}',
      ' context',
      '-old line',
      '+new line',
      ' tail',
      '',
    ].join('\n')

    const d = parseUnifiedDiff(patch)
    expect(d.hunks).toHaveLength(1)
    expect(d.additions).toBe(1)
    expect(d.deletions).toBe(1)

    const h = d.hunks[0]
    expect(h.header).toBe('\\section{Intro}')
    expect(h.lines).toEqual([
      { kind: 'context', oldNo: 1, newNo: 1, text: 'context' },
      { kind: 'del', oldNo: 2, newNo: null, text: 'old line' },
      { kind: 'add', oldNo: null, newNo: 2, text: 'new line' },
      { kind: 'context', oldNo: 3, newNo: 3, text: 'tail' },
    ])
  })

  it('handles single-line hunk ranges without a comma', () => {
    const patch = ['@@ -5 +5 @@', '-a', '+b'].join('\n')
    const h = parseUnifiedDiff(patch).hunks[0]
    expect(h.oldStart).toBe(5)
    expect(h.newStart).toBe(5)
    expect(h.lines[0]).toMatchObject({ kind: 'del', oldNo: 5 })
    expect(h.lines[1]).toMatchObject({ kind: 'add', newNo: 5 })
  })

  it('flags binary files', () => {
    const d = parseUnifiedDiff('Binary files a/img.png and b/img.png differ')
    expect(d.binary).toBe(true)
    expect(d.hunks).toHaveLength(0)
  })

  it('parses multiple hunks', () => {
    const patch = [
      '@@ -1,1 +1,1 @@', '-a', '+b',
      '@@ -10,1 +10,1 @@', '-c', '+d',
    ].join('\n')
    const d = parseUnifiedDiff(patch)
    expect(d.hunks).toHaveLength(2)
    expect(d.hunks[1].oldStart).toBe(10)
    expect(d.additions).toBe(2)
    expect(d.deletions).toBe(2)
  })
})

describe('wholeFileAsAdditions', () => {
  it('treats every line as an addition', () => {
    const d = wholeFileAsAdditions('one\ntwo\n')
    expect(d.additions).toBe(2)
    expect(d.hunks[0].lines.map(l => l.text)).toEqual(['one', 'two'])
    expect(d.hunks[0].lines.every(l => l.kind === 'add')).toBe(true)
  })

  it('produces no hunks for empty content', () => {
    expect(wholeFileAsAdditions('').hunks).toEqual([])
  })
})

describe('alignHunk', () => {
  it('places context on both sides', () => {
    const [d] = parseUnifiedDiff('@@ -1,1 +1,1 @@\n ctx').hunks
    expect(alignHunk(d)).toEqual([
      { kind: 'context', left: { no: 1, text: 'ctx' }, right: { no: 1, text: 'ctx' } },
    ])
  })

  it('pairs equal-length deletions and additions into change rows', () => {
    const [h] = parseUnifiedDiff('@@ -1,2 +1,2 @@\n-x\n-y\n+a\n+b').hunks
    const rows = alignHunk(h)
    expect(rows).toEqual([
      { kind: 'change', left: { no: 1, text: 'x' }, right: { no: 1, text: 'a' } },
      { kind: 'change', left: { no: 2, text: 'y' }, right: { no: 2, text: 'b' } },
    ])
  })

  it('emits one-sided rows when del/add counts differ', () => {
    const [h] = parseUnifiedDiff('@@ -1,1 +1,2 @@\n-x\n+a\n+b').hunks
    const rows = alignHunk(h)
    expect(rows[0]).toEqual({ kind: 'change', left: { no: 1, text: 'x' }, right: { no: 1, text: 'a' } })
    expect(rows[1]).toEqual({ kind: 'add', left: null, right: { no: 2, text: 'b' } })
  })
})

describe('wordDiff', () => {
  it('flags nothing changed for identical strings', () => {
    const { old, new: nw } = wordDiff('hello world', 'hello world')
    expect(old.every(s => !s.changed)).toBe(true)
    expect(nw.every(s => !s.changed)).toBe(true)
  })

  it('isolates the changed word', () => {
    const { old, new: nw } = wordDiff('the quick fox', 'the slow fox')
    expect(old.filter(s => s.changed).map(s => s.text)).toEqual(['quick'])
    expect(nw.filter(s => s.changed).map(s => s.text)).toEqual(['slow'])
    // Unchanged surroundings are preserved verbatim.
    expect(old.map(s => s.text).join('')).toBe('the quick fox')
    expect(nw.map(s => s.text).join('')).toBe('the slow fox')
  })

  it('treats a whole LaTeX command as one token', () => {
    const { new: nw } = wordDiff('\\alpha + \\beta', '\\alpha + \\gamma')
    expect(nw.filter(s => s.changed).map(s => s.text)).toEqual(['\\gamma'])
  })
})

describe('parseConflicts', () => {
  it('returns a single common segment when there are no markers', () => {
    expect(parseConflicts('a\nb')).toEqual([{ kind: 'common', lines: ['a', 'b'] }])
  })

  it('splits a conflict block into ours/theirs with labels', () => {
    const text = [
      'before',
      '<<<<<<< HEAD',
      'our line',
      '=======',
      'their line',
      '>>>>>>> feature',
      'after',
    ].join('\n')
    expect(parseConflicts(text)).toEqual([
      { kind: 'common', lines: ['before'] },
      { kind: 'conflict', ours: ['our line'], theirs: ['their line'], oursLabel: 'HEAD', theirsLabel: 'feature' },
      { kind: 'common', lines: ['after'] },
    ])
  })

  it('handles back-to-back conflict blocks', () => {
    const text = [
      '<<<<<<< HEAD', 'a', '=======', 'b', '>>>>>>> x',
      '<<<<<<< HEAD', 'c', '=======', 'd', '>>>>>>> y',
    ].join('\n')
    const segs = parseConflicts(text)
    expect(segs).toHaveLength(2)
    expect(segs[0]).toMatchObject({ kind: 'conflict', ours: ['a'], theirs: ['b'] })
    expect(segs[1]).toMatchObject({ kind: 'conflict', ours: ['c'], theirs: ['d'] })
  })

  it('does not treat a stray ======= in prose as a divider', () => {
    expect(parseConflicts('title\n=======\nbody')).toEqual([
      { kind: 'common', lines: ['title', '=======', 'body'] },
    ])
  })
})

describe('hasConflictMarkers', () => {
  it('detects a full marker pair', () => {
    expect(hasConflictMarkers('<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> b')).toBe(true)
  })
  it('is false without markers', () => {
    expect(hasConflictMarkers('plain text')).toBe(false)
  })
})
