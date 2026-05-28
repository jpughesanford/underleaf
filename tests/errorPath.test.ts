import { describe, expect, it } from 'vitest'
import { resolveErrorPath } from '../src/shared/error-path'

const ROOT = '/Users/me/projects/paper'

describe('resolveErrorPath', () => {
  it('returns an absolute path unchanged', () => {
    expect(resolveErrorPath(ROOT, '/etc/texmf/foo.tex')).toBe('/etc/texmf/foo.tex')
  })

  it('joins a bare relative filename onto the project root', () => {
    expect(resolveErrorPath(ROOT, 'main.tex')).toBe(`${ROOT}/main.tex`)
  })

  it('joins a nested relative path onto the project root', () => {
    expect(resolveErrorPath(ROOT, 'chapters/intro.tex')).toBe(`${ROOT}/chapters/intro.tex`)
  })

  it('collapses a leading ./', () => {
    expect(resolveErrorPath(ROOT, './main.tex')).toBe(`${ROOT}/main.tex`)
  })

  it('collapses interior ../ segments that stay inside the project', () => {
    expect(resolveErrorPath(ROOT, 'chapters/../main.tex')).toBe(`${ROOT}/main.tex`)
  })

  it('falls back to the bare filename when ../ escapes the project root', () => {
    // The log referenced something outside the project; we look for the
    // filename inside the project instead of opening an out-of-tree path.
    expect(resolveErrorPath(ROOT, '../../../usr/local/texlive/x/style.tex'))
      .toBe(`${ROOT}/style.tex`)
  })
})
