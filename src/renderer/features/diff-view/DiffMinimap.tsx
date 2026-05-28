import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Change-density rail for the file diff. Maps the *rendered, scrollable* content
 * (hunks + any revealed context) — not the whole original file — so the viewport
 * box is always exact and there are no unreachable dead zones from collapsed
 * regions. Ticks mark changed rows (read from `[data-chg]` on `.dv-row`); the box
 * tracks scroll. Click jumps; dragging scrubs. Hides itself when nothing overflows.
 */

interface Tick { top: number; kind: 'add' | 'del' | 'change' }

interface Props {
  /** The scrollable `.dv-body`. Rows are measured against its scrollHeight. */
  scrollRef: React.RefObject<HTMLDivElement>
}

export default function DiffMinimap({ scrollRef }: Props) {
  const railRef = useRef<HTMLDivElement>(null)
  const [ticks, setTicks] = useState<Tick[]>([])
  const [box, setBox] = useState({ top: 0, height: 1 })
  const [overflow, setOverflow] = useState(false)

  const updateBox = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const total = el.scrollHeight || 1
    setBox({ top: el.scrollTop / total, height: el.clientHeight / total })
  }, [scrollRef])

  const measure = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const total = el.scrollHeight
    const over = total > el.clientHeight + 2
    setOverflow(over)
    if (!over) { setTicks([]); return }
    const next: Tick[] = []
    el.querySelectorAll<HTMLElement>('.dv-row[data-chg]').forEach(r => {
      const kind = r.dataset.chg as Tick['kind'] | undefined
      if (kind !== 'add' && kind !== 'del' && kind !== 'change') return
      next.push({ top: (r.offsetTop + r.offsetHeight / 2) / total, kind })
    })
    setTicks(next)
    updateBox()
  }, [scrollRef, updateBox])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    measure()
    let raf = 0
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(updateBox) }
    el.addEventListener('scroll', onScroll, { passive: true })
    // Body size changes (pane resize, wrapping) and row count changes (revealing
    // collapsed context) both need a re-measure.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const mo = new MutationObserver(measure)
    mo.observe(el, { childList: true, subtree: true })
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [scrollRef, measure, updateBox])

  // Map a pointer Y to a scroll position, centering the clicked point in view.
  const scrollToPointer = useCallback((clientY: number) => {
    const rail = railRef.current
    const el = scrollRef.current
    if (!rail || !el) return
    const rect = rail.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
    el.scrollTop = frac * el.scrollHeight - el.clientHeight / 2
  }, [scrollRef])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    scrollToPointer(e.clientY)
    const move = (ev: PointerEvent) => scrollToPointer(ev.clientY)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [scrollToPointer])

  if (!overflow) return null

  return (
    <div
      ref={railRef}
      className="dv-map unselectable"
      onPointerDown={onPointerDown}
      title="Change overview — click or drag to navigate"
    >
      <div className="dv-map-view" style={{ top: `${box.top * 100}%`, height: `${box.height * 100}%` }} />
      {ticks.map((t, i) => (
        <div key={i} className={`dv-map-tick ${t.kind}`} style={{ top: `${t.top * 100}%` }} />
      ))}
    </div>
  )
}
