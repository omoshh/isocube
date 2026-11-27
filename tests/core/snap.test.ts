import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { snapDragIso, snapFreehandIso, snapDragSquare, snapPoint, snapFree, lineMidpoints } from '../../src/core/snap'

const S = Math.sqrt(3) / 2
const dir = 'tests/fixtures/strokes/'
const load = (f: string) => JSON.parse(readFileSync(dir + f, 'utf8'))

describe('snap', () => {
  it('dragSnaps', () => {
    // up-right direction is (S, 0.5); crooked end at length 2.9
    const a = 2.9 * S, b = 2.9 * 0.5
    const r = snapDragIso({ u: 0.02, v: -0.03 }, { u: a, v: b + 0.05 })
    expect(r).toEqual({ a: { t: 0, m: 0 }, b: { t: 3, m: 0 } })
  })
  it('tapNothing', () => expect(snapDragIso({ u: 1, v: 1 }, { u: 1, v: 1 })).toBeNull())
  it('tinyNothing', () => expect(snapDragIso({ u: 0, v: 0 }, { u: 0.3, v: 0 })).toBeNull())
  it('lShapeTwoLines', () => {
    const f = load('l-shape.json')
    expect(snapFreehandIso(f.points)).toEqual(f.expected)
    expect(f.expected).toHaveLength(2)
  })
  it('zigzagNothing', () => { // ~58 degree pieces, ~28 from any direction
    const pts = [{ u: 0, v: 0 }, { u: 1, v: 1.6 }, { u: 2, v: 0 }, { u: 3, v: 1.6 }]
    expect(snapFreehandIso(pts)).toEqual([])
  })
  it('recordedStrokes', () => {
    for (const n of readdirSync(dir)) {
      const f = load(n)
      expect(snapFreehandIso(f.points), n).toEqual(f.expected)
    }
  })
  it('squareDrag', () => {
    expect(snapDragSquare({ x: 0.2, y: 0.1 }, { x: 3.1, y: 1.4 })).toEqual({ a: { x: 0, y: 0 }, b: { x: 3, y: 0 } })
    expect(snapDragSquare({ x: 0, y: 0 }, { x: 0.4, y: -2.2 })).toEqual({ a: { x: 0, y: 0 }, b: { x: 0, y: -2 } })
    expect(snapDragSquare({ x: 0, y: 0 }, { x: 0.2, y: 0.1 })).toBeNull()
  })
  it('snapPoint: half points only when on, extra points always', () => {
    const q = { u: 0.5 * S - 0.02, v: 0.25 } // near the midpoint of 0:0–1:0 (t 0.5, m 0), a little nearer to 0:0 than to 1:0
    expect(snapPoint(q, { half: false, extra: [] })).toEqual({ t: 0, m: 0 })
    expect(snapPoint(q, { half: true, extra: [] })).toEqual({ t: 0.5, m: 0 })
    const e = { t: 0, m: 0, rt: 0, rm: 0.5 }
    expect(snapPoint({ u: 0, v: 0.7 }, { half: false, extra: [e] })).toEqual(e)
  })
  it('snapPoint picks the truly nearest dot, not a rounding neighbour', () => {
    // u = 0.5·S + 0.01, v = 0.3: rounding t gives t 1, but 0:0 is nearer than 1:0
    const q = { u: 0.5 * S + 0.01, v: 0.3 }
    const d = (t: number, m: number) => Math.hypot(t * S - q.u, m + t / 2 - q.v)
    const p = snapPoint(q, { half: false, extra: [] })
    for (const [t, m] of [[0, 0], [1, 0], [0, 1], [1, -1], [1, 1]]) expect(d(p.t, p.m)).toBeLessThanOrEqual(d(t, m))
  })
  it('snapFree joins any two points; same point gives null', () => {
    expect(snapFree({ u: 0, v: 0 }, { u: 3 * S, v: 2.5 }, { half: false, extra: [] })).toEqual({ a: { t: 0, m: 0 }, b: { t: 3, m: 1 } })
    expect(snapFree({ u: 0, v: 0 }, { u: 0.1, v: 0.1 }, { half: false, extra: [] })).toBeNull()
  })
  it('lineMidpoints: exact middle of each drawn piece, once', () => {
    expect(lineMidpoints(['0:0|0:1', '0:0|1:1', '0:0|0:1'])).toEqual([{ t: 0, m: 0.5 }, { t: 0.5, m: 0.5 }])
    expect(lineMidpoints(['0~1:0~0|0~1:2~0'])).toEqual([{ t: 0, m: 1, rt: 1, rm: 0 }])
  })
})
