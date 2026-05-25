import React, { useEffect, useRef, useState, useCallback } from 'react'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

interface PDFDocumentProxy {
  numPages: number
  getPage: (n: number) => Promise<PDFPageProxy>
  destroy: () => void
}
interface PDFPageProxy {
  getViewport: (opts: { scale: number }) => { width: number; height: number }
  render: (ctx: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void>; cancel: () => void }
  cleanup: () => void
}

interface Props {
  pdfPath: string
  version?: number
}

function PdfPage({
  doc, pageNum, scale, onVisible,
}: {
  doc: PDFDocumentProxy
  pageNum: number
  scale: number
  onVisible: (n: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let task: { promise: Promise<void>; cancel: () => void } | null = null

    doc.getPage(pageNum).then(page => {
      if (cancelled) return
      const dpr = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: scale * dpr })
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${viewport.width / dpr}px`
      canvas.style.height = `${viewport.height / dpr}px`
      const ctx = canvas.getContext('2d')
      if (!ctx || cancelled) return
      task = page.render({ canvasContext: ctx, viewport })
      task.promise.catch(() => {})
    })

    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pageNum, scale])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) onVisible(pageNum) },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [pageNum, onVisible])

  return (
    <div ref={wrapRef} style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
      <canvas ref={canvasRef} style={{ display: 'block', boxShadow: '0 2px 24px rgba(0,0,0,0.55)', borderRadius: 2 }} />
    </div>
  )
}

export default function PdfPane({ pdfPath, version = 0 }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const prevDocRef = useRef<PDFDocumentProxy | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadPdf = useCallback(async () => {
    if (!pdfPath) return
    setLoading(true)
    setError(null)
    try {
      const arrayBuffer = await window.api.readPdf(pdfPath)
      if (!arrayBuffer) { setError('PDF not found'); return }

      const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
      GlobalWorkerOptions.workerSrc = pdfWorkerUrl

      const loadingTask = getDocument({ data: arrayBuffer })
      const pdfDoc = await loadingTask.promise

      // Measure natural page dimensions for fit-to-width / fit-to-height
      const p1 = await pdfDoc.getPage(1)
      const vp1 = p1.getViewport({ scale: 1 })
      setNaturalSize({ width: vp1.width, height: vp1.height })

      // Auto fit-to-width on first load
      if (scrollRef.current) {
        const available = scrollRef.current.clientWidth - 40
        setScale(+(available / vp1.width).toFixed(2))
      }

      prevDocRef.current?.destroy()
      prevDocRef.current = pdfDoc as unknown as PDFDocumentProxy

      setDoc(pdfDoc as unknown as PDFDocumentProxy)
      setNumPages(pdfDoc.numPages)
      setCurrentPage(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load PDF')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfPath, version])

  useEffect(() => { loadPdf() }, [loadPdf])

  const handlePageVisible = useCallback((n: number) => setCurrentPage(n), [])

  const fitToWidth = useCallback(() => {
    if (!naturalSize || !scrollRef.current) return
    const available = scrollRef.current.clientWidth - 40 // account for padding
    setScale(+(available / naturalSize.width).toFixed(2))
  }, [naturalSize])

  const fitToHeight = useCallback(() => {
    if (!naturalSize || !scrollRef.current) return
    const available = scrollRef.current.clientHeight - 40
    setScale(+(available / naturalSize.height).toFixed(2))
  }, [naturalSize])

  const pages = doc ? Array.from({ length: numPages }, (_, i) => i + 1) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-bg-panel)' }}>

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 10px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-toolbar)',
        flexShrink: 0,
        height: 36,
      }}>
        {/* Page counter */}
        <span style={{ fontSize: 11, color: 'var(--color-toolbar-fg)', minWidth: 52, textAlign: 'center' }}>
          {numPages ? `${currentPage} / ${numPages}` : '—'}
        </span>

        <div style={{ flex: 1 }} />

        {/* Fit to width */}
        <PdfToolButton onClick={fitToWidth} title="Fit to width" disabled={!doc}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11H3"/><path d="M7 7l-4 4 4 4"/><path d="M17 7l4 4-4 4"/>
            <line x1="3" y1="19" x2="21" y2="19" strokeWidth="1.5" strokeDasharray="2 2"/>
          </svg>
        </PdfToolButton>

        {/* Fit to height */}
        <PdfToolButton onClick={fitToHeight} title="Fit to height" disabled={!doc}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 21V3"/><path d="M17 7l-4-4-4 4"/><path d="M17 17l-4 4-4-4"/>
            <line x1="5" y1="3" x2="5" y2="21" strokeWidth="1.5" strokeDasharray="2 2"/>
          </svg>
        </PdfToolButton>

        <div style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 2px' }} />

        {/* Zoom controls — styled as a pill group */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--color-bg-input)',
          borderRadius: 6,
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setScale(s => Math.max(0.4, +(s - 0.15).toFixed(2)))}
            title="Zoom out"
            style={{
              width: 26, height: 26, border: 'none', background: 'transparent',
              color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-card-hover)'; e.currentTarget.style.color = 'var(--color-text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <span
            style={{
              fontSize: 11, color: 'var(--color-text-secondary)', minWidth: 40, textAlign: 'center',
              borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)',
              padding: '0 2px', lineHeight: '26px',
            }}
          >
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(s => Math.min(4, +(s + 0.15).toFixed(2)))}
            title="Zoom in"
            style={{
              width: 26, height: 26, border: 'none', background: 'transparent',
              color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-card-hover)'; e.currentTarget.style.color = 'var(--color-text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Scroll area */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflow: 'auto', padding: '20px 0 20px', background: 'var(--color-bg-app)' }}
      >
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', gap: 8 }}>
            <div className="spinner" style={{ color: 'var(--color-brand)' }} />
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading PDF…</span>
          </div>
        )}

        {error && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8, color: 'var(--color-text-error)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span style={{ fontSize: 13 }}>{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={loadPdf} style={{ marginTop: 4 }}>Retry</button>
          </div>
        )}

        {!loading && !error && !doc && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, color: 'var(--color-text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.35 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p style={{ fontSize: 13 }}>PDF will appear here after compilation</p>
          </div>
        )}

        {!loading && !error && doc && pages.length > 0 && (
          <div>
            {pages.map(pageNum => (
              <PdfPage
                key={`${pdfPath}-${version}-${pageNum}`}
                doc={doc}
                pageNum={pageNum}
                scale={scale}
                onVisible={handlePageVisible}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PdfToolButton({ onClick, title, disabled, children }: {
  onClick: () => void
  title: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 26, height: 26, border: 'none', borderRadius: 5,
        background: 'transparent', color: disabled ? 'rgba(255,255,255,0.25)' : 'var(--color-toolbar-fg)',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 120ms, color 120ms',
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--color-toolbar-fg-active)' } }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = disabled ? 'rgba(255,255,255,0.25)' : 'var(--color-toolbar-fg)' }}
    >
      {children}
    </button>
  )
}
