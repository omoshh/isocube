import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { HeightMap } from '../../src/core/shape'
import { views } from '../../src/core/views'
import { LEVELS, countSolutions, type PuzzleFile } from '../../src/core/generator'
import { classicPuzzles } from '../../src/core/classic'
import ref from '../fixtures/reference-puzzles.json'

// R1: Classic puzzles from the page with more than one solution (heights 0..Z on their own plan size);
// in each, an enclosed empty cell can be filled with cubes without changing any view (C-025 has 3 solutions, the others 2)
const AMBIGUOUS_CLASSIC = ['C-025', 'C-046', 'C-047']

describe('puzzles.json', () => {
  it('fileValid', () => {
    const file: PuzzleFile = JSON.parse(readFileSync(new URL('../../public/puzzles.json', import.meta.url), 'utf8'))
    expect(file.version).toBe(1)
    const ps = file.puzzles
    expect(new Set(ps.map(p => p.id)).size).toBe(ps.length)
    for (const { level, a, b, maxH } of LEVELS) {
      const set = ps.filter(p => p.set === 'level' && p.level === level)
      expect(set.length).toBe(50)
      set.forEach((p, i) => {
        expect(p.id).toBe(`L${level}-${String(i + 1).padStart(3, '0')}`)
        expect([[a, b], [b, a]]).toContainEqual([p.cols, p.rows])
        expect(p.maxH).toBe(maxH)
      })
    }
    for (const { level, a, b, maxH } of LEVELS) {
      const rev = ps.filter(p => p.set === 'reverse' && p.level === level)
      expect(rev.length).toBe(50)
      const viewsShapes = new Set(ps.filter(p => p.set === 'level' && p.level === level).map(p => p.cols + ':' + p.h))
      rev.forEach((p, i) => {
        expect(p.id).toBe(`RL${level}-${String(i + 1).padStart(3, '0')}`)
        expect([[a, b], [b, a]]).toContainEqual([p.cols, p.rows])
        expect(p.maxH).toBe(maxH)
        expect(viewsShapes.has(p.cols + ':' + p.h), p.id).toBe(false)
      })
    }
    const classic = ps.filter(p => p.set === 'classic')
    expect(classic.length).toBe(49)
    expect(ps.length).toBe(6 * 50 * 2 + 49)
    expect(classic).toEqual(classicPuzzles(ref))
    const ambiguous: string[] = []
    for (const p of ps.filter(p => p.set !== 'reverse')) {
      expect(p.h.length).toBe(p.cols * p.rows)
      expect(p.h.every(v => v >= 0 && v <= p.maxH)).toBe(true)
      const n = countSolutions(views(new HeightMap(p.cols, p.rows, p.h)), p.cols, p.rows, p.maxH)
      if (p.set === 'level') expect(n, p.id).toBe(1)
      else { expect(n, p.id).toBeGreaterThanOrEqual(1); if (n > 1) ambiguous.push(p.id) }
    }
    expect(ambiguous).toEqual(AMBIGUOUS_CLASSIC)
  })
  it('classicMatchesPage', () => {
    const c = classicPuzzles(ref)
    expect(c.map(p => p.id).slice(0, 2)).toEqual(['C-001', 'C-002'])
    c.forEach((p, i) => {
      expect(p.h).toEqual(ref[i].plan.flat())
      expect([p.cols, p.rows, p.maxH, p.level]).toEqual([ref[i].plan[0].length, ref[i].plan.length, ref[i].Z, ref[i].level])
    })
  })
})
