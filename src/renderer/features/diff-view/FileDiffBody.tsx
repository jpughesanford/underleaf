import React, { useMemo, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import CodeContent from './CodeContent'
import { alignHunk, type ParsedDiff, type Hunk, type SideRow } from './diff-engine'

interface Props {
  diff: ParsedDiff
  layout: 'split' | 'inline'
  /** Working-tree contents, used to reveal the unchanged lines git collapsed
      between hunks. Null when unavailable (then gaps stay collapsed). */
  sourceText: string | null
}

// Old-/new-side line counts of a hunk. Additions don't exist on the old side,
// deletions don't exist on the new side; context counts for both. Used to find
// where the previous hunk ended so we know the unchanged span before this one.
const oldLineSpan = (h: Hunk) => h.lines.filter(l => l.kind !== 'add').length
const newLineSpan = (h: Hunk) => h.lines.filter(l => l.kind !== 'del').length

export default function FileDiffBody({ diff, layout, sourceText }: Props) {
  const lines = useMemo(() => (sourceText !== null ? sourceText.split('\n') : null), [sourceText])
  // Which collapsed gaps (keyed by the index of the hunk that follows) the user
  // has revealed. Reset whenever the file changes via the key in DiffView.
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const reveal = (i: number) => setExpanded(prev => new Set(prev).add(i))

  return (
    <>
      {diff.hunks.map((hunk, i) => {
        // The unchanged lines git skipped before this hunk: from just after the
        // previous hunk's end up to just before this one starts (1..start-1 for
        // the first hunk). old/new advance in lockstep across an unchanged span.
        const prev = i > 0 ? diff.hunks[i - 1] : null
        const oldFrom = (prev ? prev.oldStart + oldLineSpan(prev) : 1)
        const newFrom = (prev ? prev.newStart + newLineSpan(prev) : 1)
        const hidden = hunk.oldStart - oldFrom

        return (
          <div key={i}>
            {hidden > 0 && (
              expanded.has(i) && lines
                ? <ContextSpan layout={layout} oldFrom={oldFrom} newFrom={newFrom} count={hidden} lines={lines} />
                : lines
                  ? (
                    <button
                      type="button"
                      className="dv-expand unselectable"
                      onClick={() => reveal(i)}
                      title={`@@ -${hunk.oldStart} +${hunk.newStart} @@${hunk.header ? '  ' + hunk.header : ''}`}
                    >
                      <ChevronsUpDown size={13} strokeWidth={2} />
                      Click to expand {hidden.toLocaleString()} line{hidden === 1 ? '' : 's'} of unchanged text
                    </button>
                  )
                  : (
                    <div className="dv-expand is-static">
                      {hidden.toLocaleString()} unchanged line{hidden === 1 ? '' : 's'} hidden
                    </div>
                  )
            )}
            {layout === 'split'
              ? alignHunk(hunk).map((row, j) => <SplitRow key={j} row={row} />)
              : <InlineRows hunk={hunk} />}
          </div>
        )
      })}
    </>
  )
}

// ── Revealed unchanged context ──────────────────────────────────────────────
// The collapsed lines pulled back in after clicking the divider. Same text on
// both sides (they didn't change), rendered with no add/delete tint.
function ContextSpan({ layout, oldFrom, newFrom, count, lines }: {
  layout: 'split' | 'inline'
  oldFrom: number
  newFrom: number
  count: number
  lines: string[]
}) {
  const rows = Array.from({ length: count }, (_, k) => ({
    oldNo: oldFrom + k,
    newNo: newFrom + k,
    text: lines[newFrom - 1 + k] ?? '',
  }))

  if (layout === 'split') {
    return (
      <>
        {rows.map(r => (
          <SplitRow key={r.newNo} row={{ kind: 'context', left: { no: r.oldNo, text: r.text }, right: { no: r.newNo, text: r.text } }} />
        ))}
      </>
    )
  }
  return (
    <>
      {rows.map(r => <InlineLine key={r.newNo} oldNo={r.oldNo} newNo={r.newNo} sign=" " kind="" text={r.text} />)}
    </>
  )
}

// ── Side-by-side ──────────────────────────────────────────────────────────
function SplitRow({ row }: { row: SideRow }) {
  const leftKind = row.kind === 'change' || row.kind === 'del' ? 'dv-del' : row.kind === 'context' ? '' : 'dv-filler'
  const rightKind = row.kind === 'change' || row.kind === 'add' ? 'dv-add' : row.kind === 'context' ? '' : 'dv-filler'

  return (
    <div className="dv-row sxs">
      <div className={`dv-num left ${leftKind}`}>{row.left?.no ?? ''}</div>
      <div className={`dv-code left ${leftKind}`}>
        {row.left ? <CodeContent text={row.left.text} /> : ' '}
      </div>
      <div className={`dv-num right ${rightKind}`}>{row.right?.no ?? ''}</div>
      <div className={`dv-code right ${rightKind}`}>
        {row.right ? <CodeContent text={row.right.text} /> : ' '}
      </div>
    </div>
  )
}

// ── Inline (unified) ──────────────────────────────────────────────────────
// Built from the same alignment, then flattened back to one-line-per-row in
// document order.
function InlineRows({ hunk }: { hunk: Hunk }) {
  const rows = alignHunk(hunk)
  const out: React.ReactNode[] = []

  rows.forEach((row, j) => {
    if (row.kind === 'context') {
      out.push(
        <InlineLine key={`${j}c`} oldNo={row.left!.no} newNo={row.right!.no} sign=" " kind="" text={row.left!.text} />,
      )
    } else if (row.kind === 'change') {
      out.push(
        <InlineLine key={`${j}d`} oldNo={row.left!.no} newNo={null} sign="−" kind="dv-del" text={row.left!.text} />,
        <InlineLine key={`${j}a`} oldNo={null} newNo={row.right!.no} sign="+" kind="dv-add" text={row.right!.text} />,
      )
    } else if (row.kind === 'del') {
      out.push(<InlineLine key={`${j}d`} oldNo={row.left!.no} newNo={null} sign="−" kind="dv-del" text={row.left!.text} />)
    } else {
      out.push(<InlineLine key={`${j}a`} oldNo={null} newNo={row.right!.no} sign="+" kind="dv-add" text={row.right!.text} />)
    }
  })

  return <>{out}</>
}

function InlineLine({ oldNo, newNo, sign, kind, text }: {
  oldNo: number | null
  newNo: number | null
  sign: string
  kind: string
  text: string
}) {
  return (
    <div className={`dv-row inline ${kind}`}>
      <div className={`dv-num ${kind}`}>{oldNo ?? ''}</div>
      <div className={`dv-num ${kind}`}>{newNo ?? ''}</div>
      <div className={`dv-sign ${kind}`}>{sign.trim() ? sign : ''}</div>
      <div className={`dv-code ${kind}`}><CodeContent text={text} /></div>
    </div>
  )
}
