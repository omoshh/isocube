import { describe, it, expect, vi } from 'vitest'
import { DrawingEditor, type Bounds, type Drawing } from '../../src/core/drawing'
import { triAt, triEdges, triNeighbours, segEnds, type Line } from '../../src/core/geometry'

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
    expect(e.drawing).toEqual(empty())
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

