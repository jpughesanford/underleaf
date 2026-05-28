import { describe, expect, it } from 'vitest'
import { parseLog } from '../electron/main/services/compile'

const ROOT = '/Users/me/projects/paper'

describe('parseLog', () => {
  it('returns no errors/warnings for a clean log', () => {
    const log = [
      'This is pdfTeX, Version 3.14',
      '(./main.tex',
      'LaTeX2e <2022-11-01>',
      'Output written on main.pdf (1 page).',
      ')',
    ].join('\n')
    const { errors, warnings } = parseLog(log, ROOT)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })

  it('captures an error with its line number', () => {
    const log = [
      '(./main.tex',
      '! Undefined control sequence.',
      'l.42 \\badcommand',
      ')',
    ].join('\n')
    const { errors } = parseLog(log, ROOT)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      type: 'error',
      file: 'main.tex',
      line: 42,
      message: 'Undefined control sequence.',
    })
  })

  it('attributes the error to the active project file, not a system include', () => {
    // Regression: tcbposter.code.tex is a TeX Live package file. An error in
    // main.tex right after the package include must NOT be blamed on the package.
    const log = [
      '(./main.tex',
      '(/usr/local/texlive/2024/texmf-dist/tex/latex/tcolorbox/tcbposter.code.tex)',
      '! Undefined control sequence.',
      'l.10 \\oops',
      ')',
    ].join('\n')
    const { errors } = parseLog(log, ROOT)
    expect(errors).toHaveLength(1)
    expect(errors[0].file).toBe('main.tex')
  })

  it('attributes the error to a nested project sub-file while it is open', () => {
    const log = [
      '(./main.tex',
      '(./chapters/intro.tex',
      '! Missing $ inserted.',
      'l.5 x_2',
      // intro.tex not yet closed — error belongs to it
    ].join('\n')
    const { errors } = parseLog(log, ROOT)
    expect(errors[0].file).toBe('chapters/intro.tex')
    expect(errors[0].line).toBe(5)
  })

  it('pops back to the parent file after a sub-file closes', () => {
    const log = [
      '(./main.tex',
      '(./chapters/intro.tex)',          // opened and closed
      '! Undefined control sequence.',
      'l.99 \\boom',
    ].join('\n')
    const { errors } = parseLog(log, ROOT)
    expect(errors[0].file).toBe('main.tex')
  })

  it('parses LaTeX and package warnings', () => {
    const log = [
      '(./main.tex',
      'LaTeX Warning: Reference `fig:1\' on page 1 undefined.',
      'Package hyperref Warning: Token not allowed in a PDF string.',
      ')',
    ].join('\n')
    const { warnings } = parseLog(log, ROOT)
    expect(warnings).toHaveLength(2)
    expect(warnings[0].message).toContain('Reference')
    expect(warnings[1].message).toContain('Token not allowed')
  })

  it('captures overfull/underfull box warnings with a line number', () => {
    const log = [
      '(./main.tex',
      'Overfull \\hbox (15.0pt too wide) in paragraph at lines 3--7',
      ')',
    ].join('\n')
    const { warnings } = parseLog(log, ROOT)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].line).toBe(3)
    expect(warnings[0].message).toContain('Overfull')
  })

  it('handles an error with no following l.N line', () => {
    const log = [
      '(./main.tex',
      '! Emergency stop.',
      ')',
    ].join('\n')
    const { errors } = parseLog(log, ROOT)
    expect(errors).toHaveLength(1)
    expect(errors[0].line).toBeNull()
  })
})
