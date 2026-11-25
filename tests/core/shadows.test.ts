import { describe, expect, it } from 'vitest'
import { HeightMap } from '../../src/core/shape'
import { makePuzzle } from '../../src/core/generator'
import { segEnds, segKey, proj } from '../../src/core/geometry'
import { shadowCells, shadowOutline, wallPos } from '../../src/core/shadows'

const outline = (h: HeightMap, l: 'down' | 'front' | 'side' | 'slant') => shadowOutline(shadowCells(h, l), l, wallPos(h, l))
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
    expect([...o].filter(k => { const [a, b] = segEnds(k); return a.t === b.t }).length).toBe(2)
  })
  it('slantOnGrid', () => {
    for (let s = 1; s <= 200; s++) {
      const { hm } = makePuzzle(((s - 1) % 4) + 1, s)
      for (const l of ['down', 'front', 'side', 'slant'] as const)
        for (const k of outline(hm, l)) for (const p of segEnds(k)) {
          expect(Number.isInteger(p.t) && Number.isInteger(p.m)).toBe(true)
        }
    }
  })
  it('hiddenPartIncluded', () => {
    const h = new HeightMap(2, 1, [2, 1])
    expect(shadowCells(h, 'down')).toEqual(new Set(['0,0', '1,0']))
    expect(outline(h, 'down')).toEqual(sq([[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0], [0, 1, 0]]))
  })
})
