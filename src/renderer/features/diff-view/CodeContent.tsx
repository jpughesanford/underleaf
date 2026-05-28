import React from 'react'
import { composeSpans, type RenderSpan } from './latex-highlight'

const SYNTAX_CLASS: Record<NonNullable<RenderSpan['cls']>, string> = {
  cmd: 'dv-cmd',
  comment: 'dv-comment',
  math: 'dv-math',
  brace: 'dv-brace',
}

interface Props {
  text: string
}

/**
 * Renders one line of code with lightweight LaTeX syntax coloring. Shared by the
 * file-diff and conflict views. Change emphasis comes entirely from the row's
 * add/delete background tint — there is no per-word highlight.
 */
export default function CodeContent({ text }: Props) {
  // A blank line still needs to occupy a row height; the space guarantees that.
  if (text.length === 0) return <>{' '}</>

  return (
    <>
      {composeSpans(text).map((s, i) =>
        s.cls
          ? <span key={i} className={SYNTAX_CLASS[s.cls]}>{s.text}</span>
          : <React.Fragment key={i}>{s.text}</React.Fragment>,
      )}
    </>
  )
}
