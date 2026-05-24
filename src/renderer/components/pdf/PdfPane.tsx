import React, { useEffect, useRef, useState, useCallback } from 'react'

// Dynamically load pdfjs to avoid SSR issues
declare const pdfjsLib: {
  getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PDFDocumentProxy> }
  GlobalWorkerOptions: { workerSrc: string }
}

interface PDFDocumentProxy {
  numPages: number
  getPage: (n: number) => Promise<PDFPageProxy>
}

interface PDFPageProxy {
  getViewport: (opts: { scale: number }) => { width: number; height: number }
  render: (ctx: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> }
}

interface Props {
  pdfPath: string
}

export default function PdfPane({ pdfPath }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<{ promise: Promise<void>; cancel?: () => void } | null>(null)

  const loadPdf = useCallback(async () => {
    if (!pdfPath) return
    setLoading(true)
    setError(null)
    try {
      const arrayBuffer = await window.api.readPdf(pdfPath)
      if (!arrayBuffer) { setError('PDF not found'); return }

      const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
      // Use CDN worker to avoid bundling issues
      GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()

      const loadingTask = getDocument({ data: arrayBuffer })
      const pdfDoc = await loadingTask.promise
      setDoc(pdfDoc as unknown as PDFDocumentProxy)
      setNumPages(pdfDoc.numPages)
      setCurrentPage(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load PDF')
    } finally {
      setLoading(false)
    }
  }, [pdfPath])

  useEffect(() => { loadPdf() }, [loadPdf])

  useEffect(() => {
    if (!doc || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cancelled = false

    doc.getPage(currentPage).then(page => {
      if (cancelled) return
      const viewport = page.getViewport({ scale })
      canvas.width = viewport.width
      canvas.height = viewport.height
      const renderTask = page.render({ canvasContext: ctx, viewport })
      renderTaskRef.current = renderTask
      renderTask.promise.catch(() => {/* cancelled */})
    })

    return () => { cancelled = true }
  }, [doc, currentPage, scale])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0d1117',
    }}>
      {/* PDF toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-toolbar)',
        flexShrink: 0,
        fontSize: 12,
      }}>
        <button
          className="btn btn-ghost btn-icon"
          onClick={loadPdf}
          title="Reload PDF"
          style={{ width: 24, height: 24, color: '#64748b' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b' }}>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            style={{ width: 22, height: 22 }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 60, textAlign: 'center' }}>
            {numPages ? `${currentPage} / ${numPages}` : '—'}
          </span>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            style={{ width: 22, height: 22 }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setScale(s => Math.max(0.4, s - 0.2))}
            style={{ width: 22, height: 22, color: '#64748b' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <span style={{ fontSize: 11, color: '#64748b', minWidth: 36, textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setScale(s => Math.min(3, s + 0.2))}
            style={{ width: 22, height: 22, color: '#64748b' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* PDF canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: 16 }}
      >
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#64748b', gap: 8 }}>
            <div className="spinner" style={{ color: 'var(--color-brand)' }} />
            Loading PDF...
          </div>
        )}
        {error && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 8, color: '#f87171' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span style={{ fontSize: 13 }}>{error}</span>
          </div>
        )}
        {!loading && !error && doc && (
          <canvas
            ref={canvasRef}
            style={{
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              maxWidth: '100%',
            }}
          />
        )}
        {!loading && !error && !doc && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 12, color: '#475569' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.4 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p style={{ fontSize: 13 }}>PDF preview will appear here after compilation</p>
          </div>
        )}
      </div>
    </div>
  )
}
