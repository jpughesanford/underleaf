import { execFile } from 'child_process'
import { existsSync, realpathSync } from 'fs'
import { dirname, isAbsolute, join, relative, resolve } from 'path'
import type { SyncForwardResult, SyncInverseResult } from '@shared/types'
import { getPdfPath } from './compile'

// The `synctex` CLI ships in the same TeX Live bin dir as latexmk. We're handed
// the resolved latexmk path (or the bare 'latexmk' fallback) and look for its
// sibling; if that's not a real path we defer to PATH resolution.
export function resolveSynctexPath(latexmkPath: string): string {
  if (latexmkPath.includes('/')) {
    const sibling = join(dirname(latexmkPath), 'synctex')
    if (existsSync(sibling)) return sibling
  }
  return 'synctex'
}

// `synctex view`/`edit` print a block of `Key:value` lines. Parsing is the same
// shape for both — pull the first occurrence of each key we care about.
// Exported for unit testing.
export function parseRecords(stdout: string): Record<string, string>[] {
  const records: Record<string, string>[] = []
  let current: Record<string, string> | null = null
  for (const raw of stdout.split('\n')) {
    const line = raw.trim()
    // Each result record opens with Page (view) or Output (edit); a blank/
    // sentinel line closes it. Keep it simple: start a fresh record whenever we
    // hit a Page:/Input: key that would collide with the current one.
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx)
    const value = line.slice(idx + 1)
    if (!current || (current[key] !== undefined && (key === 'Page' || key === 'Input'))) {
      current = {}
      records.push(current)
    }
    current[key] = value
  }
  return records
}

function runSynctex(synctexPath: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolvePromise) => {
    execFile(synctexPath, args, { cwd }, (err, stdout) => {
      // synctex exits non-zero when it can't find a match; treat that as "no
      // result" rather than throwing, so the UI just no-ops.
      if (err && !stdout) { resolvePromise(''); return }
      resolvePromise(stdout)
    })
  })
}

/** Forward search: a source (file, line) → the matching PDF location. */
export async function synctexForward(
  opts: { projectPath: string; synctexPath: string; file: string; line: number; column: number },
): Promise<SyncForwardResult | null> {
  const { projectPath, synctexPath, file, line, column } = opts
  const pdfPath = getPdfPath(projectPath)
  if (!pdfPath) return null

  const absFile = isAbsolute(file) ? file : resolve(projectPath, file)
  const stdout = await runSynctex(
    synctexPath,
    ['view', '-i', `${line}:${Math.max(column, 0)}:${absFile}`, '-o', pdfPath],
    projectPath,
  )
  const rec = parseRecords(stdout).find(r => r.Page && r.y)
  if (!rec) return null

  return {
    page: parseInt(rec.Page, 10),
    x: parseFloat(rec.x ?? '0'),
    y: parseFloat(rec.y ?? '0'),
    height: parseFloat(rec.H ?? '12'),
  }
}

/** Inverse search: a PDF (page, x, y) in points → the matching source position. */
export async function synctexInverse(
  opts: { projectPath: string; synctexPath: string; page: number; x: number; y: number },
): Promise<SyncInverseResult | null> {
  const { projectPath, synctexPath, page, x, y } = opts
  const pdfPath = getPdfPath(projectPath)
  if (!pdfPath) return null

  const stdout = await runSynctex(
    synctexPath,
    ['edit', '-o', `${page}:${x.toFixed(2)}:${y.toFixed(2)}:${pdfPath}`],
    projectPath,
  )
  const rec = parseRecords(stdout).find(r => r.Input && r.Line)
  if (!rec) return null

  return {
    file: normalizeToProject(projectPath, rec.Input),
    line: parseInt(rec.Line, 10),
    column: parseInt(rec.Column ?? '-1', 10),
  }
}

// synctex emits the input as its realpath, which on macOS differs from the
// project path by symlinks (/var → /private/var). The renderer keys open tabs
// by the literal `projectPath + relative` string, so returning the raw realpath
// opens a duplicate tab for an already-open file. Re-root onto the literal
// projectPath via a realpath-relative compare so the strings line up; fall back
// to the resolved absolute path for files genuinely outside the project.
function normalizeToProject(projectPath: string, rawInput: string): string {
  const abs = isAbsolute(rawInput) ? rawInput : resolve(projectPath, rawInput)
  try {
    const rel = relative(realpathSync(projectPath), realpathSync(abs))
    if (rel && !rel.startsWith('..') && !isAbsolute(rel)) return join(projectPath, rel)
  } catch { /* file may not exist on disk — fall through */ }
  return abs
}
