import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { countSolutions, type PuzzleFile } from '../../src/core/generator'
import { countShapeSolutions } from '../../src/core/rampSolver'
import { HeightMap } from '../../src/core/shape'
import { shapeViews } from '../../src/core/shapeViews'
import type { Shape } from '../../src/core/solid'
import { views } from '../../src/core/views'
import { fairShape } from '../../src/core/visibility'

const file: PuzzleFile = JSON.parse(readFileSync('public/puzzles.json', 'utf8'))
const count = (s: Shape, maxH: number, limit = 2) => countShapeSolutions(shapeViews(s, maxH), s.hm.cols, s.hm.rows, maxH, limit)

describe('cube-and-ramp solver', () => {
  it('a lone E ramp on the floor has one solution', () => {
    expect(count({ hm: new HeightMap(1, 1, [0]), ramps: [{ x: 0, y: 0, len: 1, dir: 'E' }] }, 1)).toBe(1)
  })
  it('a hidden low centre: 2 flat heights and 8 ramps fit the same views', () => {
    const s: Shape = { hm: new HeightMap(3, 3, [2, 2, 2, 2, 1, 2, 2, 2, 2]), ramps: [] }
    expect(count(s, 2, 20)).toBe(10)
  })
  it('level puzzles: the cube answer is always among the solutions; ramps can only add', { timeout: 120000 }, () => {
    for (const p of file.puzzles.filter(q => q.set === 'level' && q.level <= 2).filter((_, i) => i % 10 === 0)) {
      const hm = new HeightMap(p.cols, p.rows, p.h)
      expect(count({ hm, ramps: [] }, p.maxH), p.id).toBeGreaterThanOrEqual(countSolutions(views(hm), p.cols, p.rows, p.maxH))
    }
  })
  it('a target with a partly hidden line is refused', () => {
    const s: Shape = { hm: new HeightMap(3, 2, [1, 1, 1, 0, 2, 3]), ramps: [{ x: 0, y: 1, len: 2, dir: 'E' }] }
    expect(() => count(s, 3)).toThrow('partly hidden')
  })
  it('a ramp rising to the front, hidden from the side, is a real twin of a cube', () => {
    expect(count({ hm: new HeightMap(3, 1, [1, 1, 1]), ramps: [{ x: 0, y: 0, len: 2, dir: 'E' }] }, 2)).toBe(2)
  })
})

describe('fairShape', () => {
  it('a lone ramp is fair; a pit nobody sees is not', () => {
    expect(fairShape({ hm: new HeightMap(1, 1, [0]), ramps: [{ x: 0, y: 0, len: 1, dir: 'E' }] }, 1)).toBe(true)
    expect(fairShape({ hm: new HeightMap(3, 3, [2, 2, 2, 2, 1, 2, 2, 2, 2]), ramps: [] }, 2)).toBe(false)
  })
})
