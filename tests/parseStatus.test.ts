import { describe, expect, it } from 'vitest'
import { parseStatus } from '../electron/main/services/git'

// Helper mirroring simple-git's StatusResult.files entries.
const f = (path: string, index: string, working_dir: string) => ({ path, index, working_dir })

describe('parseStatus', () => {
  it('classifies a staged modification', () => {
    const r = parseStatus([f('main.tex', 'M', ' ')])
    expect(r.staged).toEqual([{ path: 'main.tex', status: 'M' }])
    expect(r.unstaged).toEqual([])
    expect(r.conflicted).toEqual([])
  })

  it('classifies an unstaged modification', () => {
    const r = parseStatus([f('main.tex', ' ', 'M')])
    expect(r.staged).toEqual([])
    expect(r.unstaged).toEqual([{ path: 'main.tex', status: 'M' }])
  })

  it('lists a file in both staged and unstaged when it has changes of each kind', () => {
    // e.g. staged a change, then edited again — index=M, working_dir=M
    const r = parseStatus([f('main.tex', 'M', 'M')])
    expect(r.staged).toEqual([{ path: 'main.tex', status: 'M' }])
    expect(r.unstaged).toEqual([{ path: 'main.tex', status: 'M' }])
  })

  it('treats untracked files as a single unstaged ? entry', () => {
    const r = parseStatus([f('new.tex', '?', '?')])
    expect(r.staged).toEqual([])
    expect(r.unstaged).toEqual([{ path: 'new.tex', status: '?' }])
  })

  it.each([
    ['UU', 'U', 'U'],
    ['AA', 'A', 'A'],
    ['DD', 'D', 'D'],
  ])('treats %s as a conflict', (_label, index, wd) => {
    const r = parseStatus([f('conflict.tex', index, wd)])
    expect(r.conflicted).toEqual(['conflict.tex'])
    expect(r.staged).toEqual([])
    expect(r.unstaged).toEqual([])
  })

  it('hides app-managed paths from the panel', () => {
    const r = parseStatus([
      f('.underleaf', 'M', ' '),
      f('.underleaf-build/main.pdf', '?', '?'),
      f('main.tex', 'M', ' '),
    ])
    expect(r.staged).toEqual([{ path: 'main.tex', status: 'M' }])
    expect(r.unstaged).toEqual([])
  })

  it('handles a mix of staged, unstaged, conflicted, and untracked', () => {
    const r = parseStatus([
      f('staged.tex', 'A', ' '),
      f('edited.tex', ' ', 'M'),
      f('conflict.tex', 'U', 'U'),
      f('new.tex', '?', '?'),
    ])
    expect(r.staged).toEqual([{ path: 'staged.tex', status: 'A' }])
    expect(r.unstaged).toEqual([
      { path: 'edited.tex', status: 'M' },
      { path: 'new.tex', status: '?' },
    ])
    expect(r.conflicted).toEqual(['conflict.tex'])
  })
})
