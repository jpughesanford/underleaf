import { AlertTriangle } from 'lucide-react'
import CodeContent from './CodeContent'
import { type MergeSegment } from './diff-engine'

interface Props {
  segments: MergeSegment[]
  /** Replace the conflict at this segment index with the chosen lines. */
  onResolveBlock: (segmentIndex: number, lines: string[]) => void
  busy: boolean
}

export default function ConflictBody({ segments, onResolveBlock, busy }: Props) {
  let lineNo = 0
  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.kind === 'common') {
          return seg.lines.map((text, k) => {
            lineNo++
            return (
              <div className="dv-row inline dv-common" key={`${idx}-${k}`}>
                <div className="dv-num">{lineNo}</div>
                <div className="dv-num" />
                <div className="dv-sign" />
                <div className="dv-code"><CodeContent text={text} /></div>
              </div>
            )
          })
        }

        // Pair ours/theirs line-by-line so each side can tint the words that differ.
        const rows = Math.max(seg.ours.length, seg.theirs.length)
        lineNo += rows
        return (
          <div className="dv-conflict" key={idx}>
            <div className="dv-conflict-bar">
              <span className="label"><AlertTriangle size={12} strokeWidth={2.5} /> Conflict</span>
              <span className="bar-spacer" />
              <button className="dv-accept ours" disabled={busy} onClick={() => onResolveBlock(idx, seg.ours)}>
                Accept Current
              </button>
              <button className="dv-accept theirs" disabled={busy} onClick={() => onResolveBlock(idx, seg.theirs)}>
                Accept Incoming
              </button>
              <button className="dv-accept both" disabled={busy} onClick={() => onResolveBlock(idx, [...seg.ours, ...seg.theirs])}>
                Accept Both
              </button>
            </div>

            <div className="dv-conflict-sides">
              <div className="side-head ours">{seg.oursLabel || 'HEAD'} (current)</div>
              <div className="side-head theirs">{seg.theirsLabel || 'incoming'} (incoming)</div>

              <div className="side-body ours">
                {Array.from({ length: rows }, (_, r) => {
                  const text = seg.ours[r]
                  if (text === undefined) return <div className="cline" key={r}>{' '}</div>
                  return <div className="cline" key={r}><CodeContent text={text} /></div>
                })}
              </div>
              <div className="side-body theirs">
                {Array.from({ length: rows }, (_, r) => {
                  const text = seg.theirs[r]
                  if (text === undefined) return <div className="cline" key={r}>{' '}</div>
                  return <div className="cline" key={r}><CodeContent text={text} /></div>
                })}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
