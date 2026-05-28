import { describe, it, expect } from 'vitest'
import { parseRecords } from '../electron/main/services/synctex'

// Real-shape `synctex view` output: a preamble line, a result block, then one
// record per matched box (each opening with Page:).
const VIEW_OUTPUT = `This is SyncTeX command line utility, version 1.5
SyncTeX result begin
Output:/proj/.underleaf-build/main.pdf
Page:3
x:164.683804
y:743.799011
h:148.474640
v:741.789246
W:298.499786
H:9.962640
before:
offset:0
middle:
after:
Page:3
x:164.683804
y:719.879150
h:148.474640
v:717.869385
W:298.499786
H:9.962640
before:
SyncTeX result end
`

const EDIT_OUTPUT = `This is SyncTeX command line utility, version 1.5
SyncTeX result begin
Output:/proj/.underleaf-build/main.pdf
Input:/proj/sections/intro.tex
Line:42
Column:-1
Offset:0
Context:
SyncTeX result end
`

describe('parseRecords', () => {
  it('splits forward (view) output into one record per Page', () => {
    const recs = parseRecords(VIEW_OUTPUT)
    expect(recs).toHaveLength(2)
    const first = recs.find(r => r.Page && r.y)!
    expect(first.Page).toBe('3')
    expect(parseFloat(first.y)).toBeCloseTo(743.799011)
    expect(parseFloat(first.H)).toBeCloseTo(9.962640)
  })

  it('keeps the Output path attached to the first record', () => {
    const [first] = parseRecords(VIEW_OUTPUT)
    expect(first.Output).toBe('/proj/.underleaf-build/main.pdf')
  })

  it('parses inverse (edit) output into Input + Line', () => {
    const rec = parseRecords(EDIT_OUTPUT).find(r => r.Input && r.Line)!
    expect(rec.Input).toBe('/proj/sections/intro.tex')
    expect(rec.Line).toBe('42')
    expect(rec.Column).toBe('-1')
  })

  it('ignores preamble/sentinel lines without a colon', () => {
    const recs = parseRecords('This is SyncTeX\nSyncTeX result begin\nPage:1\ny:10\nSyncTeX result end')
    expect(recs).toHaveLength(1)
    expect(recs[0].Page).toBe('1')
  })

  it('returns an empty list for empty output', () => {
    expect(parseRecords('')).toEqual([])
  })
})
