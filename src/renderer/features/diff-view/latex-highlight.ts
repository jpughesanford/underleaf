// A deliberately small LaTeX colorizer for diff rows. The real editor uses
// lezer-latex inside CodeMirror; replicating that here would be heavy and would
// drift, so this scans a single line for the few tokens that carry the most
// visual signal — commands, comments, math delimiters, braces. Syntax sets only
// the text *color*; the row's add/delete background tint is applied separately,
// so the two never fight over the same property.

export type HlClass = 'cmd' | 'comment' | 'math' | 'brace'

export interface HlSpan {
  from: number
  to: number
  cls: HlClass
}

/** Non-overlapping, left-to-right syntax spans for one line of LaTeX. */
export function highlightLatex(text: string): HlSpan[] {
  const spans: HlSpan[] = []
  let i = 0
  const n = text.length

  while (i < n) {
    const c = text[i]

    // Comment runs to end of line (unless the % is escaped as \%).
    if (c === '%' && text[i - 1] !== '\\') {
      spans.push({ from: i, to: n, cls: 'comment' })
      break
    }

    // \command — backslash plus letters, or a single escaped symbol (\{, \\, \%).
    if (c === '\\') {
      let j = i + 1
      if (j < n && /[a-zA-Z]/.test(text[j])) {
        while (j < n && /[a-zA-Z]/.test(text[j])) j++
        if (j < n && text[j] === '*') j++ // starred variants: \section*
      } else {
        j = Math.min(i + 2, n) // escaped single char
      }
      spans.push({ from: i, to: j, cls: 'cmd' })
      i = j
      continue
    }

    if (c === '$') {
      const len = text[i + 1] === '$' ? 2 : 1
      spans.push({ from: i, to: i + len, cls: 'math' })
      i += len
      continue
    }

    if (c === '{' || c === '}' || c === '[' || c === ']') {
      spans.push({ from: i, to: i + 1, cls: 'brace' })
      i++
      continue
    }

    i++
  }

  return spans
}

export interface RenderSpan {
  text: string
  cls: HlClass | null
}

/**
 * Flatten the (non-overlapping, left-to-right) syntax spans into a gap-free list
 * of render segments: each syntax span becomes a classified segment, and every
 * stretch between them becomes an unclassified one.
 */
export function composeSpans(text: string): RenderSpan[] {
  if (text.length === 0) return []

  const out: RenderSpan[] = []
  let pos = 0
  for (const s of highlightLatex(text)) {
    if (s.from > pos) out.push({ text: text.slice(pos, s.from), cls: null })
    out.push({ text: text.slice(s.from, s.to), cls: s.cls })
    pos = s.to
  }
  if (pos < text.length) out.push({ text: text.slice(pos), cls: null })
  return out
}
