import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { PuzzleFile } from '../../src/core/generator'
import { HeightMap } from '../../src/core/shape'
import { shapeViews, viewFills, viewKey } from '../../src/core/shapeViews'
import { views } from '../../src/core/views'

const file: PuzzleFile = JSON.parse(readFileSync('public/puzzles.json', 'utf8'))
const sorted = (s: Set<string>) => [...s].sort()

describe('views of shapes with ramps', () => {
  it('viewKey splits at integer points, in gridSegKey form', () => {
    expect(viewKey([0, 0], [0, 2])).toEqual(['0:0|0:1', '0:1|0:2'])
    expect(viewKey([2, 0], [0, 1])).toEqual(['0:1|2:0'])
  })
  it('cube-only: the same views as views(hm) for level puzzles', () => {
    for (const p of file.puzzles.filter(q => q.set === 'level')) {
      const hm = new HeightMap(p.cols, p.rows, p.h), a = views(hm), b = shapeViews({ hm, ramps: [] }, Math.max(...p.h))
      expect(sorted(b.top), p.id).toEqual(sorted(a.top))
      expect(sorted(b.front), p.id).toEqual(sorted(a.front))
      expect(sorted(b.side), p.id).toEqual(sorted(a.side))
    }
  })
  it('an E ramp on cubes: a slanted line in the front view, no line where its triangle meets the cube fronts', () => {
    const v = shapeViews({ hm: new HeightMap(2, 1, [1, 1]), ramps: [{ x: 0, y: 0, len: 2, dir: 'E' }] }, 2)
    expect(v.front).toContain('0:1|2:0')
    expect(v.front).not.toContain('0:1|1:1')
    expect(v.partial).toBe(false)
  })
  it('two ramps side by side with the same slope: no line between them in the top view', () => {
    const v = shapeViews({ hm: new HeightMap(1, 2, [0, 0]), ramps: [{ x: 0, y: 0, len: 1, dir: 'E' }, { x: 0, y: 1, len: 1, dir: 'E' }] }, 1)
    expect(v.top).not.toContain('0:1|1:1')
    expect(v.top).toContain('0:0|1:0')
  })
  it('fills: one polygon per visible face', () => {
    const f = viewFills({ hm: new HeightMap(1, 1, [1]), ramps: [] }, 1)
    expect(f.top).toHaveLength(1); expect(f.front).toHaveLength(1); expect(f.side).toHaveLength(1)
  })
})
