// Pure classification of git conflict-marker regions, separated from CodeMirror
// decoration building so the state machine can be unit-tested.
//
// A conflict block looks like:
//   <<<<<<< HEAD        ← marker
//   our content         ← ours
//   =======             ← marker
//   their content       ← theirs
//   >>>>>>> branch       ← marker

export type ConflictLineKind = 'marker' | 'ours' | 'theirs' | null

/**
 * Classify each line of a document by its role in a git conflict block.
 * Returns an array parallel to `lines`. Lines outside any conflict are null.
 *
 * `=======` only counts as a divider while inside an "ours" section, and
 * `>>>>>>>` only closes while inside a "theirs" section — so stray marker-like
 * lines in normal prose aren't mistaken for conflicts.
 */
export function classifyConflictLines(lines: string[]): ConflictLineKind[] {
  const out: ConflictLineKind[] = []
  let inOurs = false
  let inTheirs = false

  for (const text of lines) {
    if (text.startsWith('<<<<<<<')) {
      inOurs = true
      out.push('marker')
    } else if (text.startsWith('=======') && inOurs) {
      inOurs = false
      inTheirs = true
      out.push('marker')
    } else if (text.startsWith('>>>>>>>') && inTheirs) {
      inTheirs = false
      out.push('marker')
    } else if (inOurs) {
      out.push('ours')
    } else if (inTheirs) {
      out.push('theirs')
    } else {
      out.push(null)
    }
  }

  return out
}
