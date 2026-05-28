import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { findRootDocument } from '../electron/main/services/compile'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'underleaf-test-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function write(relPath: string, content: string) {
  const full = join(root, relPath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content, 'utf8')
}

describe('findRootDocument', () => {
  it('finds a root document at the project root', () => {
    write('main.tex', '\\documentclass{article}\n\\begin{document}\\end{document}')
    expect(findRootDocument(root)).toBe(join(root, 'main.tex'))
  })

  it('ignores .tex files without \\documentclass', () => {
    write('preamble.tex', '\\usepackage{amsmath}')
    write('main.tex', '\\documentclass{article}')
    expect(findRootDocument(root)).toBe(join(root, 'main.tex'))
  })

  it('finds a root document one directory deep', () => {
    write('src/paper.tex', '\\documentclass{article}')
    expect(findRootDocument(root)).toBe(join(root, 'src/paper.tex'))
  })

  it('returns null when no .tex has \\documentclass', () => {
    write('notes.tex', 'just some notes')
    write('data.txt', 'not even tex')
    expect(findRootDocument(root)).toBeNull()
  })

  it('honors an explicit rootDocument from .underleaf config', () => {
    write('main.tex', '\\documentclass{article}')           // would be auto-detected
    write('thesis.tex', '\\documentclass{report}')
    writeFileSync(join(root, '.underleaf'), JSON.stringify({ rootDocument: 'thesis.tex' }), 'utf8')
    expect(findRootDocument(root)).toBe(join(root, 'thesis.tex'))
  })

  it('skips node_modules and dotfolders', () => {
    write('node_modules/pkg/index.tex', '\\documentclass{article}')
    write('.cache/old.tex', '\\documentclass{article}')
    write('main.tex', '\\documentclass{article}')
    expect(findRootDocument(root)).toBe(join(root, 'main.tex'))
  })

  it('does not descend past the depth bound', () => {
    // 7 levels deep — beyond MAX_DEPTH (5). Should not be found.
    write('a/b/c/d/e/f/g/deep.tex', '\\documentclass{article}')
    expect(findRootDocument(root)).toBeNull()
  })
})
