import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Columns, AlignJustify, X, ExternalLink, SquarePen, CheckCircle } from 'lucide-react'
import IconButton from '@/ui/IconButton'
import FileDiffBody from './FileDiffBody'
import ConflictBody from './ConflictBody'
import {
  parseUnifiedDiff, wholeFileAsAdditions, parseConflicts, hasConflictMarkers,
  type ParsedDiff, type MergeSegment,
} from './diff-engine'

export interface DiffTarget {
  /** Path relative to the project root (matches git status / git diff paths). */
  filePath: string
  /** Diff the index against HEAD (staged) rather than the working tree. */
  staged: boolean
  /** Open the conflict-resolution view instead of a read-only diff. */
  conflict: boolean
}

interface Props {
  projectPath: string
  target: DiffTarget
  onClose: () => void
  /** Open the file in a normal editor tab (for manual editing). */
  onOpenInEditor: (relPath: string) => void
  /** Called after the working tree changes (resolution written / staged) so the
      Source Control panel can refresh. */
  onResolved?: () => void
}

type Layout = 'split' | 'inline'

export default function DiffView({ projectPath, target, onClose, onOpenInEditor, onResolved }: Props) {
  const { filePath, staged, conflict } = target
  const absPath = `${projectPath}/${filePath}`
  const fileName = filePath.split('/').pop() ?? filePath
  const dir = filePath.slice(0, filePath.length - fileName.length).replace(/\/$/, '')

  const [layout, setLayout] = useState<Layout>('split')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [diff, setDiff] = useState<ParsedDiff | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setDiff(null)
    setText(null)
    ;(async () => {
      try {
        if (conflict) {
          const content = await window.api.files.read(absPath)
          if (!cancelled) setText(content ?? '')
        } else {
          const patch = await window.api.git.diff(projectPath, filePath, staged)
          let parsed = parseUnifiedDiff(patch)
          // Source for revealing the unchanged lines git collapsed between hunks.
          // It must match the new side of *this* comparison so the revealed text
          // is exact: the staged snapshot for a staged diff, otherwise the
          // working tree. (New-side line numbers index straight into it.)
          const content = parsed.binary
            ? null
            : staged
              ? await window.api.git.showStaged(projectPath, filePath)
              : await window.api.files.read(absPath)
          // No textual hunks + not binary ⇒ untracked file (git diff is empty);
          // show its whole contents as additions so "click to see changes" works.
          if (parsed.hunks.length === 0 && !parsed.binary && content && content.length) {
            parsed = wholeFileAsAdditions(content)
          }
          if (!cancelled) { setText(content ?? null); setDiff(parsed) }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [projectPath, absPath, filePath, staged, conflict])

  const segments: MergeSegment[] = useMemo(
    () => (text !== null ? parseConflicts(text) : []),
    [text],
  )
  const unresolved = text !== null && hasConflictMarkers(text)

  const serialize = useCallback((segs: MergeSegment[]): string =>
    segs.flatMap(seg =>
      seg.kind === 'common'
        ? seg.lines
        : [`<<<<<<< ${seg.oursLabel}`, ...seg.ours, '=======', ...seg.theirs, `>>>>>>> ${seg.theirsLabel}`],
    ).join('\n'), [])

  const resolveBlock = useCallback(async (segmentIndex: number, lines: string[]) => {
    setBusy(true)
    try {
      const next = segments.map((s, i) => (i === segmentIndex ? { kind: 'common' as const, lines } : s))
      const newText = serialize(next)
      await window.api.files.write(absPath, newText)
      setText(newText)
      onResolved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [segments, serialize, absPath, onResolved])

  const markResolved = useCallback(async () => {
    setBusy(true)
    try {
      await window.api.git.stage(projectPath, filePath)
      onResolved?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }, [projectPath, filePath, onResolved, onClose])

  return (
    <div className="dv-root">
      <div className="dv-header">
        <div className="dv-title">
          <span className="dv-filename">{fileName}</span>
          {dir && <span className="dv-filedir">{dir}</span>}
        </div>

        <span className={`dv-pill ${conflict ? 'conflict' : staged ? 'staged' : 'unstaged'}`}>
          {conflict ? 'Conflict' : staged ? 'Staged' : 'Unstaged'}
        </span>

        {!conflict && diff && (
          <span className="dv-stat">
            {diff.additions > 0 && <span className="add">+{diff.additions}</span>}
            {diff.additions > 0 && diff.deletions > 0 && ' '}
            {diff.deletions > 0 && <span className="del">−{diff.deletions}</span>}
          </span>
        )}

        <span className="dv-spacer" />

        {!conflict && (
          <div className="dv-seg" role="group" aria-label="Diff layout">
            <button className={layout === 'split' ? 'on' : ''} onClick={() => setLayout('split')} title="Side by side">
              <Columns size={13} strokeWidth={2} /> Split
            </button>
            <button className={layout === 'inline' ? 'on' : ''} onClick={() => setLayout('inline')} title="Unified">
              <AlignJustify size={13} strokeWidth={2} /> Unified
            </button>
          </div>
        )}

        <IconButton title="Open in editor" onClick={() => onOpenInEditor(filePath)}>
          {conflict ? <SquarePen size={14} strokeWidth={1.9} /> : <ExternalLink size={14} strokeWidth={1.9} />}
        </IconButton>
        <IconButton title="Close diff" onClick={onClose}>
          <X size={15} strokeWidth={2} />
        </IconButton>
      </div>

      {loading ? (
        <div className="dv-state">
          <div className="spinner" style={{ color: 'var(--color-brand)', width: 18, height: 18 }} />
        </div>
      ) : error ? (
        <div className="dv-state">
          <AlertTriangle size={22} strokeWidth={1.8} />
          <div className="big">Couldn’t load diff</div>
          <div className="selectable" style={{ fontSize: 12 }}>{error}</div>
        </div>
      ) : conflict ? (
        unresolved ? (
          <div className="dv-body">
            <ConflictBody segments={segments} onResolveBlock={resolveBlock} busy={busy} />
          </div>
        ) : (
          <div className="dv-state">
            <CheckCircle size={26} strokeWidth={1.8} style={{ color: 'var(--badge-sync-color)' }} />
            <div className="big">All conflicts resolved</div>
            <div className="dv-resolved-actions">
              <button className="dv-accept both" disabled={busy} onClick={markResolved}>Mark resolved &amp; stage</button>
              <button className="dv-accept" onClick={() => onOpenInEditor(filePath)}>Open file</button>
            </div>
          </div>
        )
      ) : diff && diff.binary ? (
        <div className="dv-state"><div className="big">Binary file — no preview</div></div>
      ) : diff && diff.hunks.length === 0 ? (
        <div className="dv-state"><div className="big">No changes to show</div></div>
      ) : diff ? (
        <div className="dv-body">
          <FileDiffBody key={`${filePath}:${staged}`} diff={diff} layout={layout} sourceText={text} />
        </div>
      ) : null}
    </div>
  )
}
