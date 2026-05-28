// Pure diff model + parsing. No React, no DOM — so the alignment, word-level
// diffing, and conflict-splitting can all be unit-tested in isolation.
//
// The file-changes view is fed by git's own unified-diff output (we trust git's
// diff rather than re-implementing a line differ). The conflict view is fed by
// the working-tree file, which still carries `<<<<<<< / ======= / >>>>>>>`
// markers. Both feed the same row renderer in the UI layer.

// ─── Unified-diff model ─────────────────────────────────────────────────────

export type DiffLineKind = 'context' | 'add' | 'del'

export interface DiffLineModel {
  kind: DiffLineKind
  /** 1-based line number on the old (left) side, or null for additions. */
  oldNo: number | null
  /** 1-based line number on the new (right) side, or null for deletions. */
  newNo: number | null
  text: string
}

export interface Hunk {
  /** The trailing context shown after the `@@ … @@` (often a section heading). */
  header: string
  oldStart: number
  newStart: number
  lines: DiffLineModel[]
}

export interface ParsedDiff {
  hunks: Hunk[]
  additions: number
  deletions: number
  /** True when git reported a binary file (no textual hunks to show). */
  binary: boolean
}

/**
 * Parse the unified diff emitted by `git diff [--cached] -- <file>` into hunks.
 * Everything before the first `@@` (the `diff --git`, `index`, `---`, `+++`
 * preamble) is skipped. "\ No newline at end of file" markers are ignored.
 */
export function parseUnifiedDiff(patch: string): ParsedDiff {
  const hunks: Hunk[] = []
  let additions = 0
  let deletions = 0
  let binary = false

  if (!patch) return { hunks, additions, deletions, binary }

  const lines = patch.split('\n')
  let current: Hunk | null = null
  let oldNo = 0
  let newNo = 0

  for (const raw of lines) {
    if (raw.startsWith('Binary files') || raw.startsWith('GIT binary patch')) {
      binary = true
      continue
    }

    const header = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/)
    if (header) {
      oldNo = parseInt(header[1], 10)
      newNo = parseInt(header[2], 10)
      current = {
        header: header[3].trim(),
        oldStart: oldNo,
        newStart: newNo,
        lines: [],
      }
      hunks.push(current)
      continue
    }

    if (!current) continue // still inside the preamble

    const marker = raw[0]
    const text = raw.slice(1)

    if (marker === '+') {
      current.lines.push({ kind: 'add', oldNo: null, newNo, text })
      newNo++
      additions++
    } else if (marker === '-') {
      current.lines.push({ kind: 'del', oldNo, newNo: null, text })
      oldNo++
      deletions++
    } else if (marker === ' ') {
      current.lines.push({ kind: 'context', oldNo, newNo, text })
      oldNo++
      newNo++
    }
    // '\' (No newline at end of file) and empty trailing lines fall through.
  }

  return { hunks, additions, deletions, binary }
}

/**
 * Build a synthetic "all additions" diff for an untracked file, where `git diff`
 * yields nothing but we still want to show the whole file as new content.
 */
export function wholeFileAsAdditions(content: string): ParsedDiff {
  const rows = content.length === 0 ? [] : content.replace(/\n$/, '').split('\n')
  const lines: DiffLineModel[] = rows.map((text, i) => ({
    kind: 'add' as const,
    oldNo: null,
    newNo: i + 1,
    text,
  }))
  return {
    hunks: rows.length ? [{ header: '', oldStart: 0, newStart: 1, lines }] : [],
    additions: rows.length,
    deletions: 0,
    binary: false,
  }
}

// ─── Side-by-side alignment ─────────────────────────────────────────────────

export interface SideCell {
  no: number
  text: string
}

export interface SideRow {
  /** 'change' is a paired deletion+addition (gets word-level highlighting). */
  kind: 'context' | 'add' | 'del' | 'change'
  left: SideCell | null
  right: SideCell | null
}

/**
 * Turn a unified hunk into aligned left/right rows. Consecutive deletions and
 * additions are paired index-by-index into `change` rows so edits sit beside
 * each other; any overflow on either side becomes a one-sided row.
 */
export function alignHunk(hunk: Hunk): SideRow[] {
  const rows: SideRow[] = []
  let pendingDel: DiffLineModel[] = []
  let pendingAdd: DiffLineModel[] = []

  const flush = () => {
    const paired = Math.min(pendingDel.length, pendingAdd.length)
    for (let i = 0; i < paired; i++) {
      rows.push({
        kind: 'change',
        left: { no: pendingDel[i].oldNo!, text: pendingDel[i].text },
        right: { no: pendingAdd[i].newNo!, text: pendingAdd[i].text },
      })
    }
    for (let i = paired; i < pendingDel.length; i++) {
      rows.push({ kind: 'del', left: { no: pendingDel[i].oldNo!, text: pendingDel[i].text }, right: null })
    }
    for (let i = paired; i < pendingAdd.length; i++) {
      rows.push({ kind: 'add', left: null, right: { no: pendingAdd[i].newNo!, text: pendingAdd[i].text } })
    }
    pendingDel = []
    pendingAdd = []
  }

  for (const line of hunk.lines) {
    if (line.kind === 'del') pendingDel.push(line)
    else if (line.kind === 'add') pendingAdd.push(line)
    else {
      flush()
      rows.push({
        kind: 'context',
        left: { no: line.oldNo!, text: line.text },
        right: { no: line.newNo!, text: line.text },
      })
    }
  }
  flush()
  return rows
}

// ─── Word-level diff ────────────────────────────────────────────────────────

export interface WordSpan {
  text: string
  changed: boolean
}

// Split into LaTeX-aware tokens: whole commands (\alpha), words, runs of
// whitespace, and single punctuation chars. Keeps highlight boundaries natural.
function tokenize(s: string): string[] {
  return s.match(/\\[a-zA-Z]+\*?|[A-Za-z0-9]+|\s+|[^\sA-Za-z0-9]/g) ?? []
}

/**
 * Token-level diff between two strings via an LCS table. Returns, for each side,
 * a coalesced list of spans flagged changed/unchanged — used to highlight just
 * the words that differ within a modified line pair.
 */
export function wordDiff(oldText: string, newText: string): { old: WordSpan[]; new: WordSpan[] } {
  const a = tokenize(oldText)
  const b = tokenize(newText)
  const n = a.length
  const m = b.length

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const oldFlags: boolean[] = []
  const newFlags: boolean[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      oldFlags.push(false)
      newFlags.push(false)
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      oldFlags.push(true) // deletion from old
      i++
    } else {
      newFlags.push(true) // insertion into new
      j++
    }
  }
  while (i < n) { oldFlags.push(true); i++ }
  while (j < m) { newFlags.push(true); j++ }

  return { old: coalesce(a, oldFlags), new: coalesce(b, newFlags) }
}

function coalesce(tokens: string[], flags: boolean[]): WordSpan[] {
  const spans: WordSpan[] = []
  for (let k = 0; k < tokens.length; k++) {
    const last = spans[spans.length - 1]
    if (last && last.changed === flags[k]) last.text += tokens[k]
    else spans.push({ text: tokens[k], changed: flags[k] })
  }
  return spans
}

// ─── Conflict parsing ───────────────────────────────────────────────────────

export interface CommonSegment {
  kind: 'common'
  lines: string[]
}

export interface ConflictSegment {
  kind: 'conflict'
  ours: string[]
  theirs: string[]
  /** Label after `<<<<<<<` (usually "HEAD"). */
  oursLabel: string
  /** Label after `>>>>>>>` (usually the incoming branch/commit). */
  theirsLabel: string
}

export type MergeSegment = CommonSegment | ConflictSegment

/**
 * Split a conflicted file into an ordered list of common runs and conflict
 * blocks. Marker lines are consumed (not emitted) so the UI can render each
 * block's two sides on its own. Mirrors the state machine in the editor's
 * classifyConflictLines but produces grouped segments instead of per-line tags.
 */
export function parseConflicts(text: string): MergeSegment[] {
  const segments: MergeSegment[] = []
  const lines = text.split('\n')

  let common: string[] = []
  let ours: string[] = []
  let theirs: string[] = []
  let oursLabel = ''
  let theirsLabel = ''
  let state: 'none' | 'ours' | 'theirs' = 'none'

  const flushCommon = () => {
    if (common.length) {
      segments.push({ kind: 'common', lines: common })
      common = []
    }
  }

  for (const line of lines) {
    if (state === 'none' && line.startsWith('<<<<<<<')) {
      flushCommon()
      oursLabel = line.slice(7).trim()
      ours = []
      theirs = []
      state = 'ours'
    } else if (state === 'ours' && line.startsWith('=======')) {
      state = 'theirs'
    } else if (state === 'theirs' && line.startsWith('>>>>>>>')) {
      theirsLabel = line.slice(7).trim()
      segments.push({ kind: 'conflict', ours, theirs, oursLabel, theirsLabel })
      state = 'none'
    } else if (state === 'ours') {
      ours.push(line)
    } else if (state === 'theirs') {
      theirs.push(line)
    } else {
      common.push(line)
    }
  }
  flushCommon()

  return segments
}

export function hasConflictMarkers(text: string): boolean {
  return /^<<<<<<< /m.test(text) && /^>>>>>>> /m.test(text)
}
