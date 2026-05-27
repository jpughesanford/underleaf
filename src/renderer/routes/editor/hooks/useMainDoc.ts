import { useCallback, useEffect, useState } from 'react'

interface UseMainDocResult {
  /** Path explicitly set in .underleaf config, or null if none is set. */
  mainDoc: string | null
  /** Auto-detected `\documentclass` file, used only when mainDoc is null. */
  detectedMainDoc: string | null
  /** Persist a new main-doc choice to .underleaf and update local state. */
  setMainDoc: (relativePath: string) => Promise<void>
}

/**
 * Loads the per-project root-document choice. If the user hasn't set one,
 * falls back to scanning for the first file containing `\documentclass`.
 */
export function useMainDoc(projectPath: string): UseMainDocResult {
  const [mainDoc, setMainDocState] = useState<string | null>(null)
  const [detectedMainDoc, setDetectedMainDoc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.compile.getConfig(projectPath).then(async (config) => {
      if (cancelled) return
      if (config?.rootDocument) {
        setMainDocState(config.rootDocument)
      } else {
        const detected = await window.api.compile.detectMainDoc(projectPath)
        if (!cancelled && detected) setDetectedMainDoc(detected)
      }
    })
    return () => { cancelled = true }
  }, [projectPath])

  const setMainDoc = useCallback(async (relativePath: string) => {
    const cfg = await window.api.compile.getConfig(projectPath)
    await window.api.compile.setConfig(projectPath, { ...cfg, rootDocument: relativePath })
    setMainDocState(relativePath)
    setDetectedMainDoc(null)
  }, [projectPath])

  return { mainDoc, detectedMainDoc, setMainDoc }
}
