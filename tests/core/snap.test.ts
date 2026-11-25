import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { snapDragIso, snapFreehandIso, snapDragSquare } from '../../src/core/snap'

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
  it('diagonal across cells only when allowed', () => {
    const end = { u: 2 * S + 0.05, v: 3 - 0.04 } // (t 2, m 2): two long diagonals at 60°
    expect(snapDragIso({ u: 0, v: 0 }, end, true)).toEqual({ a: { t: 0, m: 0 }, b: { t: 2, m: 2 } })
    expect(snapDragIso({ u: 0, v: 0 }, end)).not.toEqual({ a: { t: 0, m: 0 }, b: { t: 2, m: 2 } })
    expect(snapDragIso({ u: 0, v: 0 }, { u: 2 * S, v: 0.03 }, true)).toEqual({ a: { t: 0, m: 0 }, b: { t: 2, m: -1 } }) // 0°
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
})
