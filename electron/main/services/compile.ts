import { spawn } from 'child_process'
import {
  existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync,
} from 'fs'
import { basename, dirname, join, relative } from 'path'
import type { CompileConfig, CompileError, CompileResult } from '@shared/types'

// All latexmk build artifacts go here, keeping the project root clean.
export const BUILD_DIR_NAME = '.underleaf-build'

// ─── Build dir ────────────────────────────────────────────────────────────

function ensureBuildDir(projectPath: string): string {
  const buildDir = join(projectPath, BUILD_DIR_NAME)
  if (!existsSync(buildDir)) {
    mkdirSync(buildDir, { recursive: true })
    writeFileSync(join(buildDir, '.gitignore'), '*\n', 'utf8')
  }
  return buildDir
}

// ─── Root document detection ──────────────────────────────────────────────

/**
 * Find the root .tex file. Prefers `.underleaf.rootDocument` if set, otherwise
 * recursively searches for the first file containing `\documentclass`.
 */
export function findRootDocument(projectPath: string): string | null {
  const config = readConfig(projectPath)
  if (config.rootDocument) return join(projectPath, config.rootDocument)

  // Bounded recursion so an unusually deep tree (vendored deps, large
  // dataset directories) can't lock up the IPC handler. Real LaTeX project
  // layouts are flat — main.tex at the root or one folder deep. 5 levels is
  // generous and still fast enough to scan synchronously.
  const MAX_DEPTH = 5

  function search(dir: string, depth: number): string | null {
    if (depth > MAX_DEPTH) return null
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue
      const fullPath = join(dir, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          const found = search(fullPath, depth + 1)
          if (found) return found
        } else if (entry.endsWith('.tex')) {
          if (readFileSync(fullPath, 'utf8').includes('\\documentclass')) return fullPath
        }
      } catch { /* skip unreadable */ }
    }
    return null
  }
  return search(projectPath, 0)
}

// ─── Per-project config ───────────────────────────────────────────────────

export function readConfig(projectPath: string): CompileConfig {
  const configPath = join(projectPath, '.underleaf')
  if (!existsSync(configPath)) return {}
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'))
  } catch {
    return {}
  }
}

export function writeConfig(projectPath: string, config: CompileConfig): void {
  writeFileSync(join(projectPath, '.underleaf'), JSON.stringify(config, null, 2), 'utf8')
}

// ─── Log parsing ──────────────────────────────────────────────────────────

/**
 * Extract errors/warnings from a pdflatex/latexmk log.
 *
 * Tracks the open-file stack via `(filename` / `)` events so the file attributed
 * to each error is the topmost project file currently open at the error site.
 * System includes (e.g. TeX Live's tcbposter.code.tex) push onto the stack but
 * are filtered out of error reporting — otherwise an error in main.tex right
 * after a package include would get mis-attributed to the package file.
 *
 * Exported for testing.
 */
export function parseLog(log: string, projectPath: string): { errors: CompileError[]; warnings: CompileError[] } {
  const errors: CompileError[] = []
  const warnings: CompileError[] = []
  const lines = log.split('\n')

  const errorRe = /^!\s+(.+)$/
  const lineRe = /^l\.(\d+)/
  const warnRe = /^(LaTeX Warning|Package \w+ Warning|Class \w+ Warning):\s*(.+)/i
  const overfullRe = /^(Overfull|Underfull) \\[hv]box/

  // Each stack entry is the project-relative path, or null for files outside
  // the project (system includes). We push null so balanced `)` still pops
  // the right depth, but null entries are skipped when reporting.
  const fileStack: (string | null)[] = []

  function resolveAbs(rawPath: string): string {
    if (rawPath.startsWith('/')) return rawPath
    const stripped = rawPath.startsWith('./') ? rawPath.slice(2) : rawPath
    return `${projectPath}/${stripped}`
  }

  // Walk a line char-by-char, updating fileStack on each ( / ).
  function updateStack(line: string): void {
    let i = 0
    while (i < line.length) {
      const c = line[i]
      if (c === '(') {
        // Read the filename immediately following (
        const rest = line.slice(i + 1)
        const m = rest.match(/^([^\s()]+)/)
        if (m && /\.(tex|sty|cls|ltx|fd|def|cfg|cnf|aux)$/i.test(m[1])) {
          const abs = resolveAbs(m[1])
          fileStack.push(abs.startsWith(projectPath) ? (relative(projectPath, abs) || m[1]) : null)
          i += 1 + m[1].length
        } else {
          // Not a file open — likely something like (Font) or a comment.
          // Skip the ( so we don't accidentally pop on a later unrelated `)`.
          i++
        }
      } else if (c === ')') {
        fileStack.pop()
        i++
      } else {
        i++
      }
    }
  }

  function topProjectFile(): string {
    for (let i = fileStack.length - 1; i >= 0; i--) {
      if (fileStack[i]) return fileStack[i]!
    }
    return 'main.tex'
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const errMatch = line.match(errorRe)
    if (errMatch) {
      // Capture file BEFORE updating stack for this line — the error refers
      // to the file we're currently in, not anything that opens after it.
      const file = topProjectFile()
      let lineNum: number | null = null
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const lm = lines[j].match(lineRe)
        if (lm) { lineNum = parseInt(lm[1]); break }
      }
      errors.push({ type: 'error', file, line: lineNum, message: errMatch[1] })
      updateStack(line)
      continue
    }

    const warnMatch = line.match(warnRe)
    if (warnMatch) {
      warnings.push({ type: 'warning', file: topProjectFile(), line: null, message: warnMatch[2] })
      updateStack(line)
      continue
    }

    if (overfullRe.test(line)) {
      const lm = line.match(/lines? (\d+)/)
      warnings.push({ type: 'warning', file: topProjectFile(), line: lm ? parseInt(lm[1]) : null, message: line.trim() })
      updateStack(line)
      continue
    }

    updateStack(line)
  }

  return { errors, warnings }
}

// ─── PDF / main-doc lookup helpers ────────────────────────────────────────

export function getPdfPath(projectPath: string): string | null {
  const rootDoc = findRootDocument(projectPath)
  if (!rootDoc) return null
  const pdfName = basename(rootDoc).replace(/\.tex$/, '.pdf')
  const buildPdf = join(projectPath, BUILD_DIR_NAME, pdfName)
  if (existsSync(buildPdf)) return buildPdf
  const rootPdf = rootDoc.replace(/\.tex$/, '.pdf')
  return existsSync(rootPdf) ? rootPdf : null
}

export function readPdf(pdfPath: string): ArrayBuffer | null {
  if (!existsSync(pdfPath)) return null
  const buf = readFileSync(pdfPath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

export function detectMainDoc(projectPath: string): string | null {
  const doc = findRootDocument(projectPath)
  return doc ? relative(projectPath, doc) : null
}

// ─── Compilation ─────────────────────────────────────────────────────────

export interface CompileRunOptions {
  projectPath: string
  /** Optional override — compile a specific file instead of the auto-detected root. */
  file?: string
  /** TeX engine: pdflatex, xelatex, lualatex. Default pdflatex. */
  engine?: string
  /** Resolved absolute path to latexmk. */
  latexmkPath: string
  /** Receives stdout chunks as latexmk runs. */
  onProgress?: (chunk: string) => void
  /** Caller can cancel by aborting this signal. */
  signal?: AbortSignal
}

/**
 * Run latexmk. No Electron deps — `onProgress` is the bridge for live output.
 * The returned promise resolves with the parsed result regardless of exit code.
 */
export function runCompile(opts: CompileRunOptions): Promise<CompileResult> {
  const { projectPath, file, engine = 'pdflatex', latexmkPath, onProgress, signal } = opts

  // Per-project override beats argument-level engine.
  const effectiveEngine = readConfig(projectPath).engine ?? engine

  const targetFile = file ?? findRootDocument(projectPath)
  if (!targetFile) {
    return Promise.resolve({
      success: false,
      errors: [{ type: 'error', file: '', line: null, message: 'No root document found (no \\documentclass)' }],
      warnings: [],
      rawLog: '',
    })
  }

  const rootDoc = targetFile
  const rootRel = relative(projectPath, rootDoc)
  const buildDir = ensureBuildDir(projectPath)

  const args = [
    `-${effectiveEngine}`,
    '-pdf',
    '-synctex=1',
    '-interaction=nonstopmode',
    '-halt-on-error',
    `-outdir=${buildDir}`,
    rootRel,
  ]

  // Ensure pdflatex/bibtex siblings are also on PATH for the subprocess.
  const texBinDir = latexmkPath.includes('/') ? dirname(latexmkPath) : ''
  const spawnPath = texBinDir
    ? `${texBinDir}:${process.env.PATH ?? ''}`
    : (process.env.PATH ?? '')

  return new Promise((resolve) => {
    let rawLog = ''
    const proc = spawn(latexmkPath, args, {
      cwd: projectPath,
      env: { ...process.env, PATH: spawnPath },
    })

    signal?.addEventListener('abort', () => proc.kill(), { once: true })

    proc.stdout.on('data', (d: Buffer) => {
      const chunk = d.toString()
      rawLog += chunk
      onProgress?.(chunk)
    })
    proc.stderr.on('data', (d: Buffer) => { rawLog += d.toString() })

    proc.on('close', (code) => {
      // latexmk buffers/swallows pdflatex's stdout on the first compile, so the
      // captured rawLog may be incomplete. The .log file in the build directory
      // always contains the full pdflatex output — prefer it for parsing.
      const texLogFile = join(buildDir, basename(rootDoc).replace(/\.tex$/, '.log'))
      let parseSource = rawLog
      if (existsSync(texLogFile)) {
        try {
          const texLog = readFileSync(texLogFile, 'utf8')
          parseSource = texLog
          rawLog = texLog + (rawLog ? '\n\n--- latexmk output ---\n' + rawLog : '')
        } catch { /* fall back to captured stdout */ }
      }

      const { errors, warnings } = parseLog(parseSource, projectPath)
      const success = code === 0
      let pdfPath: string | undefined
      if (success) {
        const pdfName = basename(rootDoc).replace(/\.tex$/, '.pdf')
        const candidate = join(buildDir, pdfName)
        if (existsSync(candidate)) pdfPath = candidate
      }
      resolve({ success, errors, warnings, rawLog, pdfPath })
    })

    proc.on('error', (err) => {
      resolve({
        success: false,
        errors: [{ type: 'error', file: '', line: null, message: err.message }],
        warnings: [],
        rawLog: err.message,
      })
    })
  })
}
