import { describe, it, expect } from 'vitest'
import { parseUnifiedDiff, revertHunk } from '../src/renderer/features/diff-view/diff-engine'

// new-side file (what the working tree looks like now)
const NEW = ['alpha', 'two', 'three', 'gamma', 'delta'].join('\n')
// A patch turning OLD -> NEW with two separate hunks:
//   line 1: beta -> alpha   (hunk 1)
//   line 4: GAMMA -> gamma   (hunk 2)
const PATCH = `diff --git a/f b/f
--- a/f
+++ b/f
@@ -1,2 +1,2 @@
-beta
+alpha
 two
@@ -4,1 +4,1 @@
-GAMMA
+gamma
`

describe('revertHunk', () => {
  const diff = parseUnifiedDiff(PATCH)

  it('reverts only the targeted hunk, leaving the other change intact', () => {
    // Revert hunk 0 (alpha->beta); hunk 1 (gamma) stays as in the working tree.
    expect(revertHunk(NEW, diff, 0)).toBe(['beta', 'two', 'three', 'gamma', 'delta'].join('\n'))
  })

  it('reverts a later hunk by its new-side position', () => {
    expect(revertHunk(NEW, diff, 1)).toBe(['alpha', 'two', 'three', 'GAMMA', 'delta'].join('\n'))
  })

  it('reverting every hunk reproduces the old file', () => {
    let t = NEW
    // revert from last to first so earlier line numbers stay valid
    for (let i = diff.hunks.length - 1; i >= 0; i--) t = revertHunk(t, diff, i)
    expect(t).toBe(['beta', 'two', 'three', 'GAMMA', 'delta'].join('\n'))
  })

  it('is a no-op for an out-of-range hunk index', () => {
    expect(revertHunk(NEW, diff, 9)).toBe(NEW)
  })
})
