import { describe, expect, it } from 'vitest'
import { HeightMap } from '../../src/core/shape'
import { makePuzzle } from '../../src/core/generator'
import { segEnds, segKey, proj } from '../../src/core/geometry'
import { shadowCells, shadowOutline, shadowPlaneBounds } from '../../src/core/shadows'

const outline = (h: HeightMap, l: 'down' | 'front' | 'side' | 'slant') => shadowOutline(shadowCells(h, l), l, h)
const sq = (pts: number[][]) => new Set(pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return segKey(proj(p[0], p[1], p[2]), proj(q[0], q[1], q[2])) }))

describe('shadows', () => {
  it('oneCubeDown', () => {
    const o = outline(new HeightMap(1, 1, [1]), 'down')
    expect(o).toEqual(sq([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]))
  })
  it('oneCubeFront', () => {
    const o = outline(new HeightMap(1, 1, [1]), 'front')
    expect(o).toEqual(sq([[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]]))
  })
  it('oneCubeSide', () => {
    const o = outline(new HeightMap(1, 1, [1]), 'side')
    expect(o).toEqual(sq([[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]))
  })
  it('frontSideHiddenPart', () => {
    const h = new HeightMap(2, 1, [2, 1]) // x=0 height 2, x=1 height 1
    expect(shadowCells(h, 'front')).toEqual(new Set(['0,0', '0,1', '1,0']))
    expect(shadowCells(h, 'side')).toEqual(new Set(['0,0', '0,1'])) // (y,z), both columns overlap
    expect(outline(h, 'front').size).toBe(8)
  })
  it('slantOneCube', () => {
    const o = outline(new HeightMap(1, 1, [1]), 'slant')
    const hex = [[0, 0], [1, 0], [2, 1], [2, 2], [1, 2], [0, 1]]
    expect(o).toEqual(sq(hex.map(p => [p[0], p[1], 0])))
    expect(o.size).toBe(6)
    // diagonal edges are the vertical lattice direction (same t)
    expect([...o].filter(k => { const [a, b] = segEnds(k); return a.t === b.t }).length).toBe(2)
  })
  it('slantOnGrid', () => {
    for (let s = 1; s <= 200; s++) {
      const { hm } = makePuzzle(((s - 1) % 4) + 1, s)
      for (const l of ['down', 'front', 'side', 'slant'] as const) {
        const o = outline(hm, l), b = shadowPlaneBounds(hm, l)
        expect(o.size).toBeGreaterThan(0)
        for (const k of o) for (const p of segEnds(k)) {
          expect(Number.isInteger(p.t) && Number.isInteger(p.m)).toBe(true)
          const v = p.m + p.t / 2
          expect(p.t >= b.t0 && p.t <= b.t1 && v >= b.v0 && v <= b.v1).toBe(true)
        }
      }
    }
  })
  it('hiddenPartIncluded', () => {
    const h = new HeightMap(2, 1, [2, 1])
    expect(shadowCells(h, 'down')).toEqual(new Set(['0,0', '1,0']))
    expect(outline(h, 'down')).toEqual(sq([[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0], [0, 1, 0]]))
  })
  it('planeBounds', () => {
    const h = new HeightMap(2, 1, [2, 1]) // cols 2, rows 1, H 2
    // floor: corners (0,0)(2,0)(2,1)(0,1) -> t in [-1,2], v = m + t/2
    expect(shadowPlaneBounds(h, 'down')).toEqual({ t0: -1, t1: 2, v0: 0, v1: 1.5 })
    // back wall y=1: corners (0,1,0)(2,1,0)(2,1,2)(0,1,2) -> t in [-1,1]
    expect(shadowPlaneBounds(h, 'front')).toEqual({ t0: -1, t1: 1, v0: 0.5, v1: 3.5 })
    // side wall x=2: corners (2,0,0)(2,1,0)(2,1,2)(2,0,2) -> t in [1,2]
    expect(shadowPlaneBounds(h, 'side')).toEqual({ t0: 1, t1: 2, v0: 1, v1: 3.5 })
    // slant floor extended by H=2: (0,0)(4,0)(4,3)(0,3) -> t in [-3,4]
    expect(shadowPlaneBounds(h, 'slant')).toEqual({ t0: -3, t1: 4, v0: 0, v1: 3.5 })
  })
})
