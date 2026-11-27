import { describe, it, expect, vi } from 'vitest'
import { DrawingEditor, type Bounds, type Drawing } from '../../src/core/drawing'
import type { Arc } from '../../src/core/arcs'
import { triAt, triEdges, triNeighbours, segEnds, toUV, type Line, type Pt } from '../../src/core/geometry'
import { polyArea } from '../../src/core/areas'

const B: Bounds = { t0: -10, t1: 10, v0: -10, v1: 10 }
const empty = (): Drawing => ({ lines: [], fills: {} })
const L = (t: number, m: number, t2: number, m2: number): Line => ({ a: { t, m }, b: { t: t2, m: m2 } })
const start = triAt(0.3, 0.2)
const nb = triNeighbours(start)[0]
const shared = triEdges(start).find(e => triEdges(nb).includes(e))!
const rhombus = [...triEdges(start), ...triEdges(nb)].filter(e => e !== shared)
  .map(e => { const [a, b] = segEnds(e); return { a, b } })

describe('drawing', () => {
  it('undoRedo', () => {
    const e = new DrawingEditor(empty(), B, () => {})
    expect(e.canUndo).toBe(false)
    e.addLines([L(0, 0, 2, 0)])
    expect(e.drawing.lines).toHaveLength(2)
    e.addLines([L(0, 0, 1, 0)]) // already drawn: no-op
    e.undo()
    expect(e.drawing.lines).toHaveLength(0)
    expect(e.canUndo).toBe(false)
    expect(e.canRedo).toBe(true)
    e.redo()
    expect(e.drawing.lines).toHaveLength(2)
    e.undo(); e.addLines([L(0, 0, 0, 1)])
    expect(e.canRedo).toBe(false)
  })
  it('fillClosedRhombus', () => {
    const e = new DrawingEditor(empty(), B, () => {})
    e.addLines(rhombus)
    e.fill(start, 2)
    expect(e.drawing.fills).toEqual({ [start]: 2, [nb]: 2 })
    e.fill(start, 2) // same colour: no-op
    e.undo() // the no-op added no step, so this undoes the fill itself
    expect(e.drawing.fills).toEqual({})
    e.redo()
    e.fill(start, 3)
    expect(e.drawing.fills[nb]).toBe(3)
  })
  it('unfillClearsTheSameColourArea', () => {
    const e = new DrawingEditor(empty(), B, () => {})
    e.addLines(rhombus)
    e.fill(start, 2)
    e.unfill(start)
    expect(e.drawing.fills).toEqual({}) // both triangles of the closed rhombus
    e.undo()
    expect(e.drawing.fills).toEqual({ [start]: 2, [nb]: 2 })
    e.erase(e.drawing.lines[0]) // the area can now leak, but unfill needs no closed region
    e.unfill(nb)
    expect(e.drawing.fills).toEqual({})
    const steps = e.canUndo
    e.unfill(start) // nothing filled: no-op
    expect(e.canUndo).toBe(steps)
  })
  it('fillOpenRegionNothing', () => {
    const fn = vi.fn()
    const e = new DrawingEditor(empty(), B, fn)
    e.fill(start, 1)
    expect(e.drawing.fills).toEqual({})
    expect(e.canUndo).toBe(false)
    expect(fn).not.toHaveBeenCalled()
  })
  it('eraseAbsentNoop', () => {
    const e = new DrawingEditor(empty(), B, () => {})
    e.erase('0:0|1:0'); expect(e.canUndo).toBe(false)
    e.addLines([L(0, 0, 1, 0)]); e.erase('0:0|1:0')
    expect(e.drawing.lines).toEqual([])
  })
  it('clearUndoable', () => {
    const e = new DrawingEditor(empty(), B, () => {})
    e.clear(); expect(e.canUndo).toBe(false)
    e.addLines(rhombus); e.fill(start, 1); e.clear()
    expect(e.drawing).toEqual({ ...empty(), arcs: [], areas: [] })
    e.undo()
    expect(e.drawing.lines).toHaveLength(4)
    expect(Object.keys(e.drawing.fills)).toHaveLength(2)
  })
  it('jsonRoundTrip', () => {
    const e = new DrawingEditor(empty(), B, () => {})
    e.addLines(rhombus); e.fill(start, 4)
    const d = e.drawing
    expect(JSON.parse(JSON.stringify(d))).toEqual(d)
    expect(new DrawingEditor(d, B, () => {}).drawing).toEqual(d)
    d.lines.push('x'); expect(e.drawing.lines).toHaveLength(4) // snapshot, not live
  })
  it('onChangeCalled', () => {
    const fn = vi.fn()
    const e = new DrawingEditor(empty(), B, fn)
    e.addLines(rhombus); e.fill(start, 1); e.undo(); e.redo(); e.clear()
    expect(fn).toHaveBeenCalledTimes(5)
  })

})

describe('arcs in the editor', () => {
  const quarter: Arc = { plane: 'z', c: { t: 0, m: 0 }, r: 1, k0: 0, n: 2 }
  it('addArc, replaceArc, undo keep earlier pieces', () => {
    const ed = new DrawingEditor({ lines: [], arcs: ['Az|0:0|1|1'], fills: {} }, B, () => {})
    const added = ed.addArc(quarter)
    expect(added).toEqual(['Az|0:0|1|0'])
    ed.replaceArc(added, { ...quarter, k0: 2 })
    expect(ed.drawing.arcs!.sort()).toEqual(['Az|0:0|1|1', 'Az|0:0|1|2', 'Az|0:0|1|3'])
    ed.undo(); expect(ed.drawing.arcs!.sort()).toEqual(['Az|0:0|1|0', 'Az|0:0|1|1'])
    ed.undo(); expect(ed.drawing.arcs).toEqual(['Az|0:0|1|1'])
  })
  it('addArc with nothing new does not commit', () => {
    const ed = new DrawingEditor({ lines: [], arcs: ['Az|0:0|1|0', 'Az|0:0|1|1'], fills: {} }, B, () => {})
    expect(ed.addArc(quarter)).toEqual([])
    expect(ed.canUndo).toBe(false)
  })
  it('erase and clear take arcs; old drawings get an empty arc list', () => {
    const ed = new DrawingEditor({ lines: [], arcs: ['Az|0:0|1|1'], fills: {} }, B, () => {})
    ed.erase('Az|0:0|1|1'); expect(ed.drawing.arcs).toEqual([])
    ed.undo(); ed.clear(); expect(ed.drawing.arcs).toEqual([])
    expect(new DrawingEditor(empty(), B, () => {}).drawing.arcs).toEqual([])
  })
})

describe('area fills (round 4)', () => {
  const S3 = Math.sqrt(3) / 2
  const at = (p: Pt) => { const [u, v] = toUV(p); return { u, v } }
  // rhombus 0:0, 1:0, 1:1, 0:1 cut by its long diagonal, a free line
  const cut = () => { const e = new DrawingEditor(empty(), B, () => {}); e.addLines([L(0, 0, 1, 0), L(1, 0, 1, 1), L(1, 1, 0, 1), L(0, 1, 0, 0), L(0, 0, 1, 1)]); return e }
  it('a free line splits the fill', () => {
    const e = cut()
    e.fillArea(at({ t: 2 / 3, m: 1 / 3 }), 4); e.fillArea(at({ t: 1 / 3, m: 2 / 3 }), 5)
    expect(e.drawing.areas!.map(a => a.c)).toEqual([4, 5])
    for (const a of e.drawing.areas!) expect(polyArea(a.pts)).toBeCloseTo(S3 / 2, 3)
  })
  it('an open area fills nothing and adds no step', () => {
    const e = new DrawingEditor(empty(), B, () => {})
    e.addLines([L(0, 0, 1, 0), L(1, 0, 1, 1)])
    const before = e.canUndo
    e.fillArea(at({ t: 0.6, m: 0.2 }), 4)
    expect(e.drawing.areas).toEqual([])
    e.undo(); expect(e.drawing.lines).toEqual([]); expect(before).toBe(true)
  })
  it('a second fill of the same area recolours it; triangle fills under it go', () => {
    const e = new DrawingEditor({ lines: [], fills: { [triAt(...toUV({ t: 0.6, m: 0.3 }))]: 2 } }, B, () => {})
    e.addLines([L(0, 0, 1, 0), L(1, 0, 1, 1), L(1, 1, 0, 1), L(0, 1, 0, 0)])
    e.fillArea(at({ t: 0.5, m: 0.5 }), 4); e.fillArea(at({ t: 0.5, m: 0.5 }), 5)
    expect(e.drawing.areas!.map(a => a.c)).toEqual([5])
    expect(e.drawing.fills).toEqual({})
  })
  it('unfillArea takes the top area; undo brings it back', () => {
    const e = cut()
    e.fillArea(at({ t: 2 / 3, m: 1 / 3 }), 4)
    expect(e.unfillArea(at({ t: 1 / 3, m: 2 / 3 }))).toBe(false)
    expect(e.unfillArea(at({ t: 2 / 3, m: 1 / 3 }))).toBe(true)
    expect(e.drawing.areas).toEqual([])
    e.undo(); expect(e.drawing.areas).toHaveLength(1)
  })
  it('old drawings get an empty area list; clear empties it', () => {
    expect(new DrawingEditor(empty(), B, () => {}).drawing.areas).toEqual([])
    const e = cut(); e.fillArea(at({ t: 2 / 3, m: 1 / 3 }), 4); e.clear()
    expect(e.drawing.areas).toEqual([])
  })
})

describe('add (round 4)', () => {
  it('adds lines and arcs in one step; nothing new adds no step', () => {
    const e = new DrawingEditor(empty(), B, () => {})
    e.add([L(0, 0, 0, 2)], ['Az|0:0|1|0'])
    expect(e.drawing.lines).toHaveLength(2); expect(e.drawing.arcs).toEqual(['Az|0:0|1|0'])
    e.add([L(0, 0, 0, 1)], ['Az|0:0|1|0'])
    e.undo(); expect(e.drawing).toEqual({ ...empty(), arcs: [], areas: [] })
  })
})

