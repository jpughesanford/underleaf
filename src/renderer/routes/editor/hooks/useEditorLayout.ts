import { useCallback, useEffect, useRef, useState } from 'react'
import type { SidebarTab, ViewMode } from '@shared/types'

// Layout constants that the body width depends on. Mirrored from the route's
// JSX (rail 44, resize handle 8, min editor width 320).
const RAIL_W = 44
const HANDLE_W = 8
const MIN_EDITOR_W = 320
const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 500
const PDF_MIN = 280
const PDF_MAX = 800

interface UseEditorLayoutResult {
  // State
  sidebarTab: SidebarTab
  setSidebarTab: (tab: SidebarTab) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  sidebarWidth: number
  pdfWidth: number
  viewMode: ViewMode
  setViewMode: (mode: ViewMode | ((prev: ViewMode) => ViewMode)) => void

  // Layout interactions
  /** Attach to the body flex container — used as the ResizeObserver target and pdfWidth clamp source. */
  bodyRef: React.RefObject<HTMLDivElement>
  /** Drag handler for the sidebar/editor handle. */
  onSidebarDrag: (dx: number) => void
  /** Drag handler for the editor/pdf handle. Clamps against the live body width. */
  onPdfDrag: (dx: number) => void
  /** Toggle a sidebar tab: re-clicking the current tab collapses; clicking another switches and opens. */
  toggleSidebarTab: (tab: SidebarTab) => void
}

export function useEditorLayout(): UseEditorLayoutResult {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('files')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [pdfWidth, setPdfWidth] = useState(420)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const bodyRef = useRef<HTMLDivElement>(null)

  const onSidebarDrag = useCallback((dx: number) => {
    setSidebarWidth(w => Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, w + dx)))
  }, [])

  const onPdfDrag = useCallback((dx: number) => {
    setPdfWidth(w => {
      const bodyW = bodyRef.current?.clientWidth ?? Infinity
      const sidebarTotal = sidebarOpen ? sidebarWidth + HANDLE_W : 0
      // Cap the PDF at what the body can give us so the editor's minWidth
      // is honored and pdfWidth never diverges from the rendered width.
      const maxPdf = bodyW - RAIL_W - sidebarTotal - HANDLE_W - MIN_EDITOR_W
      return Math.max(PDF_MIN, Math.min(PDF_MAX, maxPdf, w - dx))
    })
  }, [sidebarOpen, sidebarWidth])

  // Re-clamp pdfWidth whenever the body shrinks (window resize, sidebar toggle)
  // so stored state can't keep a value larger than what's renderable.
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const ro = new ResizeObserver(() => {
      const sidebarTotal = sidebarOpen ? sidebarWidth + HANDLE_W : 0
      const maxPdf = body.clientWidth - RAIL_W - sidebarTotal - HANDLE_W - MIN_EDITOR_W
      setPdfWidth(w => Math.min(w, Math.max(PDF_MIN, maxPdf)))
    })
    ro.observe(body)
    return () => ro.disconnect()
  }, [sidebarOpen, sidebarWidth])

  // Re-clicking the active tab collapses/expands; clicking another switches and
  // opens. Note: setSidebarOpen must NOT be nested inside a setSidebarTab updater
  // — under StrictMode the updater runs twice, so a nested toggle fires twice and
  // cancels itself out (the panel then only reopens when switching tabs). Reading
  // sidebarTab from the closure keeps each setState call enqueued exactly once.
  const toggleSidebarTab = useCallback((tab: SidebarTab) => {
    if (sidebarTab === tab) {
      setSidebarOpen(open => !open)
    } else {
      setSidebarTab(tab)
      setSidebarOpen(true)
    }
  }, [sidebarTab])

  return {
    sidebarTab, setSidebarTab, sidebarOpen, setSidebarOpen,
    sidebarWidth, pdfWidth, viewMode, setViewMode,
    bodyRef, onSidebarDrag, onPdfDrag, toggleSidebarTab,
  }
}
