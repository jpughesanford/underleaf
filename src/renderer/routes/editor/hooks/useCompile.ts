import { useCallback, useEffect, useState } from 'react'
import type { CompileResult, CompileTarget } from '@shared/types'

interface UseCompileOptions {
  projectPath: string
  compileTarget: CompileTarget
  /** Returns the file to compile when target is 'active'. Null falls back to root doc. */
  getActiveFile: () => string | null
  /** Called before each compile so the caller can flush dirty buffers to disk. */
  onBeforeCompile?: () => Promise<unknown>
  /** Fired when a compile finishes with errors — UI can surface the error panel. */
  onCompileErrored?: (result: CompileResult) => void
}

interface UseCompileResult {
  compiling: boolean
  compileResult: CompileResult | null
  pdfPath: string | null
  /** Bumped after every successful compile. PDF pane re-reads when this changes. */
  pdfVersion: number
  compile: () => Promise<void>
}

export function useCompile({
  projectPath, compileTarget, getActiveFile, onBeforeCompile, onCompileErrored,
}: UseCompileOptions): UseCompileResult {
  const [compiling, setCompiling] = useState(false)
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null)
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [pdfVersion, setPdfVersion] = useState(0)

  // Initial PDF discovery — if the project was previously compiled, show that PDF.
  useEffect(() => {
    let cancelled = false
    window.api.compile.getPdfPath(projectPath).then(p => {
      if (!cancelled && p) setPdfPath(p)
    })
    return () => { cancelled = true }
  }, [projectPath])

  const compile = useCallback(async () => {
    await onBeforeCompile?.()
    setCompiling(true)
    setCompileResult(null)
    try {
      const activeFile = getActiveFile()
      const opts = compileTarget === 'active' && activeFile ? { file: activeFile } : undefined
      const result = await window.api.compile.run(projectPath, opts)
      setCompileResult(result)
      if (result.success) {
        const p = result.pdfPath ?? await window.api.compile.getPdfPath(projectPath)
        setPdfPath(p)
        setPdfVersion(v => v + 1)
      } else if (result.errors.length > 0) {
        onCompileErrored?.(result)
      }
    } finally {
      setCompiling(false)
    }
  }, [projectPath, compileTarget, getActiveFile, onBeforeCompile, onCompileErrored])

  return { compiling, compileResult, pdfPath, pdfVersion, compile }
}
