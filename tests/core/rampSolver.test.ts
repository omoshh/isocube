import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { countSolutions, type PuzzleFile } from '../../src/core/generator'
import { countShapeSolutions } from '../../src/core/rampSolver'
import { HeightMap } from '../../src/core/shape'
import { shapeViews } from '../../src/core/shapeViews'
import { validShape, type Shape } from '../../src/core/solid'
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

describe('solver against brute force (final review)', () => {
  it('counts the review cases right', () => {
    const c = (h: number[], ramps: Shape['ramps']) => count({ hm: new HeightMap(2, 2, h), ramps }, 2, 5)
    expect(c([0, 0, 1, 1], [{ x: 0, y: 1, len: 1, dir: 'S' }, { x: 1, y: 0, len: 2, dir: 'W' }])).toBe(1)
    expect(c([0, 1, 0, 1], [{ x: 0, y: 1, len: 1, dir: 'S' }, { x: 1, y: 0, len: 2, dir: 'N' }])).toBe(1)
    expect(c([1, 1, 0, 0], [{ x: 0, y: 1, len: 2, dir: 'E' }, { x: 1, y: 0, len: 1, dir: 'S' }])).toBe(1)
  })
  it.each([[1, 1], [2, 7]])('2×2, maxH %i: view classes without partly hidden lines are counted exactly (every %i-th class)', { timeout: 300000 }, (maxH, step) => {
    const all: Shape[] = []
    const dirs = ['E', 'W', 'N', 'S'] as const
    for (let m = 0; m < (maxH + 1) ** 4; m++) {
      const h = [0, 1, 2, 3].map(i => Math.floor(m / (maxH + 1) ** i) % (maxH + 1)), hm = new HeightMap(2, 2, h)
      const rec = (rs: Shape['ramps'], i: number) => {
        if (i === 4) { all.push({ hm, ramps: rs }); return }
        rec(rs, i + 1)
        const x = i % 2, y = Math.floor(i / 2)
        for (const dir of dirs) for (const len of [1, 2] as const) {
          const t = [...rs, { x, y, len, dir }]
          if (validShape({ hm, ramps: t }, maxH)) rec(t, i + 1)
        }
      }
      rec([], 0)
    }
    const classes = new Map<string, number>(), sample = new Map<string, Shape>()
    for (const s of all) {
      const v = shapeViews(s, maxH)
      if (v.partial) continue
      const k = [v.top, v.front, v.side].map(x => [...x].sort().join(',')).join('/')
      classes.set(k, (classes.get(k) ?? 0) + 1); if (!sample.has(k)) sample.set(k, s)
    }
    let i = 0
    for (const [k, n] of classes) if (i++ % step === 0) expect(count(sample.get(k)!, maxH, 100), k).toBe(n)
  })
  it('two ramps end to end in one plane: no line across the slope in the top view', () => {
    const v = shapeViews({ hm: new HeightMap(2, 1, [0, 1]), ramps: [{ x: 0, y: 0, len: 1, dir: 'E' }, { x: 1, y: 0, len: 1, dir: 'E' }] }, 2)
    expect(v.top).not.toContain('1:0|1:1')
  })
})
