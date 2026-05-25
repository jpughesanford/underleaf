import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'fs'
import { join, relative, basename, dirname } from 'path'
import type Store from 'electron-store'
import { resolveLatexmkPath } from './projects'

// All latexmk build artifacts go here, keeping the project root clean
const BUILD_DIR_NAME = '.underleaf-build'

function ensureBuildDir(projectPath: string): string {
  const buildDir = join(projectPath, BUILD_DIR_NAME)
  if (!existsSync(buildDir)) {
    mkdirSync(buildDir, { recursive: true })
    // Write .gitignore so the build dir is never committed
    writeFileSync(join(buildDir, '.gitignore'), '*\n', 'utf8')
  }
  return buildDir
}

export interface CompileError {
  type: 'error' | 'warning'
  file: string
  line: number | null
  message: string
}

export interface CompileResult {
  success: boolean
  errors: CompileError[]
  warnings: CompileError[]
  rawLog: string
}

function findRootDocument(projectPath: string): string | null {
  // Check .underleaf config first
  const configPath = join(projectPath, '.underleaf')
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      if (config.rootDocument) return join(projectPath, config.rootDocument)
    } catch { /* ignore */ }
  }

  // Search for \documentclass
  function search(dir: string): string | null {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        const found = search(fullPath)
        if (found) return found
      } else if (entry.endsWith('.tex')) {
        try {
          const content = readFileSync(fullPath, 'utf8')
          if (content.includes('\\documentclass')) return fullPath
        } catch { /* ignore */ }
      }
    }
    return null
  }

  return search(projectPath)
}

function parseLog(log: string, projectPath: string): { errors: CompileError[]; warnings: CompileError[] } {
  const errors: CompileError[] = []
  const warnings: CompileError[] = []
  const lines = log.split('\n')

  const errorRe = /^!\s+(.+)$/
  const lineRe = /^l\.(\d+)/
  const fileRe = /\(([^()]+\.tex)/
  const warnRe = /^(LaTeX Warning|Package \w+ Warning|Class \w+ Warning):\s*(.+)/i
  const overfullRe = /^(Overfull|Underfull) \\[hv]box/

  let i = 0
  let currentFile = 'main.tex'

  while (i < lines.length) {
    const line = lines[i]

    const fileMatch = line.match(fileRe)
    if (fileMatch) {
      currentFile = relative(projectPath, fileMatch[1]) || fileMatch[1]
    }

    const errMatch = line.match(errorRe)
    if (errMatch) {
      let lineNum: number | null = null
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const lm = lines[j].match(lineRe)
        if (lm) { lineNum = parseInt(lm[1]); break }
      }
      errors.push({ type: 'error', file: currentFile, line: lineNum, message: errMatch[1] })
      i++
      continue
    }

    const warnMatch = line.match(warnRe)
    if (warnMatch) {
      warnings.push({ type: 'warning', file: currentFile, line: null, message: warnMatch[2] })
      i++
      continue
    }

    if (overfullRe.test(line)) {
      const lm = line.match(/lines? (\d+)/)
      warnings.push({ type: 'warning', file: currentFile, line: lm ? parseInt(lm[1]) : null, message: line.trim() })
    }

    i++
  }

  return { errors, warnings }
}

const activeCompiles = new Map<string, ReturnType<typeof spawn>>()

export function registerCompileIPC(store: Store): void {
  ipcMain.handle('compile:run', async (event, projectPath: string): Promise<CompileResult> => {
    const win = BrowserWindow.fromWebContents(event.sender)

    const settings = store.get('settings') as { defaultEngine: string }

    // Check for per-project override
    let engine = settings?.defaultEngine || 'pdflatex'
    const configPath = join(projectPath, '.underleaf')
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf8'))
        if (config.engine) engine = config.engine
      } catch { /* ignore */ }
    }

    const rootDoc = findRootDocument(projectPath)
    if (!rootDoc) {
      return { success: false, errors: [{ type: 'error', file: '', line: null, message: 'No root document found (no \\documentclass)' }], warnings: [], rawLog: '' }
    }

    const rootRel = relative(projectPath, rootDoc)
    const buildDir = ensureBuildDir(projectPath)

    const args = [
      `-${engine}`,
      '-pdf',
      '-synctex=1',
      '-interaction=nonstopmode',
      '-halt-on-error',
      `-outdir=${buildDir}`,
      rootRel,
    ]

    return new Promise((resolve) => {
      let rawLog = ''
      const latexmk = resolveLatexmkPath(store) ?? 'latexmk'
      // Ensure pdflatex/bibtex siblings are also on PATH for the subprocess
      const texBinDir = latexmk.includes('/') ? dirname(latexmk) : ''
      const spawnPath = texBinDir
        ? `${texBinDir}:${process.env.PATH ?? ''}`
        : (process.env.PATH ?? '')
      const proc = spawn(latexmk, args, {
        cwd: projectPath,
        env: { ...process.env, PATH: spawnPath },
      })
      activeCompiles.set(projectPath, proc)

      proc.stdout.on('data', (d: Buffer) => {
        const chunk = d.toString()
        rawLog += chunk
        win?.webContents.send('compile:progress', chunk)
      })
      proc.stderr.on('data', (d: Buffer) => {
        rawLog += d.toString()
      })

      proc.on('close', (code) => {
        activeCompiles.delete(projectPath)
        const { errors, warnings } = parseLog(rawLog, projectPath)
        resolve({ success: code === 0, errors, warnings, rawLog })
      })

      proc.on('error', (err) => {
        activeCompiles.delete(projectPath)
        resolve({
          success: false,
          errors: [{ type: 'error', file: '', line: null, message: err.message }],
          warnings: [],
          rawLog: err.message,
        })
      })
    })
  })

  ipcMain.handle('compile:stop', (_, projectPath: string) => {
    const proc = activeCompiles.get(projectPath)
    if (proc) {
      proc.kill()
      activeCompiles.delete(projectPath)
    }
  })

  ipcMain.handle('compile:getPdfPath', (_, projectPath: string) => {
    const rootDoc = findRootDocument(projectPath)
    if (!rootDoc) return null
    const buildDir = join(projectPath, BUILD_DIR_NAME)
    const pdfName = basename(rootDoc).replace(/\.tex$/, '.pdf')
    // Check build dir first (preferred), then project root for legacy
    const buildPdf = join(buildDir, pdfName)
    if (existsSync(buildPdf)) return buildPdf
    const rootPdf = rootDoc.replace(/\.tex$/, '.pdf')
    return existsSync(rootPdf) ? rootPdf : null
  })

  ipcMain.handle('compile:readPdf', (_, pdfPath: string) => {
    if (!existsSync(pdfPath)) return null
    const buf = readFileSync(pdfPath)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  })

  ipcMain.handle('compile:getConfig', (_, projectPath: string) => {
    const configPath = join(projectPath, '.underleaf')
    if (!existsSync(configPath)) return {}
    try {
      return JSON.parse(readFileSync(configPath, 'utf8'))
    } catch { return {} }
  })

  ipcMain.handle('compile:setConfig', (_, projectPath: string, config: Record<string, unknown>) => {
    const { writeFileSync } = require('fs')
    const configPath = join(projectPath, '.underleaf')
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
  })
}
