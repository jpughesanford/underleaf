import { describe, expect, it } from 'vitest'
import { classifyConflictLines } from '../src/renderer/features/code-editor/extensions/conflicts'

describe('classifyConflictLines', () => {
  it('returns all null for content with no conflict markers', () => {
    expect(classifyConflictLines(['hello', 'world'])).toEqual([null, null])
  })

  it('classifies a complete conflict block', () => {
    const lines = [
      '<<<<<<< HEAD',
      'our line',
      '=======',
      'their line',
      '>>>>>>> branch',
    ]
    expect(classifyConflictLines(lines)).toEqual([
      'marker', 'ours', 'marker', 'theirs', 'marker',
    ])
  })

  it('marks normal lines outside the block as null', () => {
    const lines = [
      'before',
      '<<<<<<< HEAD',
      'ours',
      '=======',
      'theirs',
      '>>>>>>> branch',
      'after',
    ]
    expect(classifyConflictLines(lines)).toEqual([
      null, 'marker', 'ours', 'marker', 'theirs', 'marker', null,
    ])
  })

  it('handles multi-line ours/theirs sections', () => {
    const lines = [
      '<<<<<<< HEAD',
      'ours 1',
      'ours 2',
      '=======',
      'theirs 1',
      'theirs 2',
      '>>>>>>> branch',
    ]
    expect(classifyConflictLines(lines)).toEqual([
      'marker', 'ours', 'ours', 'marker', 'theirs', 'theirs', 'marker',
    ])
  })

  it('does not treat ======= as a divider outside a conflict', () => {
    // A row of equals signs in normal prose (e.g. a markdown heading underline)
    // must not be mistaken for a conflict divider.
    expect(classifyConflictLines(['title', '=======', 'body'])).toEqual([null, null, null])
  })

  it('does not treat >>>>>>> as a closer without a preceding =======', () => {
    expect(classifyConflictLines(['>>>>>>> stray'])).toEqual([null])
  })

  it('handles back-to-back conflict blocks', () => {
    const lines = [
      '<<<<<<< HEAD', 'a', '=======', 'b', '>>>>>>> x',
      '<<<<<<< HEAD', 'c', '=======', 'd', '>>>>>>> y',
    ]
    expect(classifyConflictLines(lines)).toEqual([
      'marker', 'ours', 'marker', 'theirs', 'marker',
      'marker', 'ours', 'marker', 'theirs', 'marker',
    ])
  })
})
