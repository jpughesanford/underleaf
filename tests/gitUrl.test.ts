import { describe, expect, it } from 'vitest'
import { extractGitUrl, repoNameFromUrl, isOverleafId, deriveProjectName } from '../src/shared/git-url'

describe('extractGitUrl', () => {
  it('returns a bare URL unchanged', () => {
    expect(extractGitUrl('https://github.com/me/paper.git')).toBe('https://github.com/me/paper.git')
  })

  it('strips a leading "git clone "', () => {
    expect(extractGitUrl('git clone https://github.com/me/paper.git')).toBe('https://github.com/me/paper.git')
  })

  it('strips flags and a trailing destination dir', () => {
    expect(extractGitUrl('git clone --depth 1 git@github.com:me/paper.git mydir')).toBe('git@github.com:me/paper.git')
  })

  it('trims surrounding whitespace', () => {
    expect(extractGitUrl('   https://git.overleaf.com/abc   ')).toBe('https://git.overleaf.com/abc')
  })

  it('returns empty string for empty input', () => {
    expect(extractGitUrl('')).toBe('')
  })
})

describe('repoNameFromUrl', () => {
  it('takes the last path segment', () => {
    expect(repoNameFromUrl('https://github.com/me/paper')).toBe('paper')
  })

  it('strips a .git suffix', () => {
    expect(repoNameFromUrl('https://github.com/me/paper.git')).toBe('paper')
  })

  it('strips trailing slashes', () => {
    expect(repoNameFromUrl('https://github.com/me/paper/')).toBe('paper')
  })

  it('handles scp-style git@ URLs', () => {
    expect(repoNameFromUrl('git@github.com:me/paper.git')).toBe('paper')
  })
})

describe('isOverleafId', () => {
  it('recognizes a 24-char hex id', () => {
    expect(isOverleafId('65a1b2c3d4e5f60718293a4b')).toBe(true)
  })

  it('rejects a normal repo name', () => {
    expect(isOverleafId('my-paper')).toBe(false)
  })

  it('rejects a short hex string', () => {
    expect(isOverleafId('abc123')).toBe(false)
  })
})

describe('deriveProjectName', () => {
  it('uses the remote repo name when it is human-readable', () => {
    expect(deriveProjectName('/root/my-folder', 'https://github.com/me/paper.git')).toBe('paper')
  })

  it('falls back to the directory name when there is no remote', () => {
    expect(deriveProjectName('/root/my-folder', null)).toBe('my-folder')
  })

  it('falls back to the directory name when the remote ends in an Overleaf hex id', () => {
    expect(deriveProjectName('/root/thesis-2026', 'https://git.overleaf.com/65a1b2c3d4e5f60718293a4b'))
      .toBe('thesis-2026')
  })

  it('prefers the remote name over the directory name', () => {
    expect(deriveProjectName('/root/cloned-dir', 'git@github.com:me/real-name.git')).toBe('real-name')
  })
})
