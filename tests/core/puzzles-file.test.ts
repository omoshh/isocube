import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { HeightMap } from '../../src/core/shape'
import { views } from '../../src/core/views'
import { LEVELS, countSolutions, entryShape, shapeDistance, type PuzzleFile } from '../../src/core/generator'
import { fairPicture, fairShape } from '../../src/core/visibility'
import { validShape } from '../../src/core/solid'

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
    expect(ps.some(p => (p.set as string) === 'classic')).toBe(false)
    expect(ps.filter(p => p.set !== 'slopes').length).toBe(6 * 50 * 2)
    for (const p of ps) {
      expect(p.h.length).toBe(p.cols * p.rows)
      expect(p.h.every(v => v >= 0 && v <= p.maxH)).toBe(true)
      if (p.set === 'level') expect(countSolutions(views(new HeightMap(p.cols, p.rows, p.h)), p.cols, p.rows, p.maxH), p.id).toBe(1)
    }
  })
  it('every Views and Reverse puzzle has a fair picture', () => {
    const file: PuzzleFile = JSON.parse(readFileSync(new URL('../../public/puzzles.json', import.meta.url), 'utf8'))
    const unfair = file.puzzles.filter(p => !fairPicture(new HeightMap(p.cols, p.rows, p.h))).map(p => p.id)
    expect(unfair).toEqual([])
  })
})

describe('Slopes set (round 4)', () => {
  const now: PuzzleFile = JSON.parse(readFileSync('public/puzzles.json', 'utf8'))
  const before: PuzzleFile = JSON.parse(readFileSync('tests/fixtures/puzzles-r3.json', 'utf8'))
  const slopes = now.puzzles.filter(p => p.set === 'slopes')
  it('every older puzzle is unchanged', () => {
    expect(now.puzzles.filter(p => p.set !== 'slopes')).toEqual(before.puzzles)
  })
  // round 4: Slopes 1 (SL, level 0), Slopes 2 (SL2, level 2, 4×4×3), Slopes 3 (SL3, level 3, 4×5×4 either way)
  const SETS = [{ pre: 'SL', level: 0, sizes: [[3, 3], [3, 4], [4, 3]], maxH: 3 }, { pre: 'SL2', level: 2, sizes: [[4, 4]], maxH: 3 },
    { pre: 'SL3', level: 3, sizes: [[4, 5], [5, 4]], maxH: 4 }]
  for (const S of SETS) it(`${S.pre}: 25 fair, varied puzzles with ramps`, () => {
    const set = slopes.filter(p => p.level === S.level)
    expect(set.map(p => p.id)).toEqual(Array.from({ length: 25 }, (_, i) => `${S.pre}-${String(i + 1).padStart(3, '0')}`))
    for (const p of set) {
      const s = entryShape(p)
      expect(S.sizes, p.id).toContainEqual([p.cols, p.rows])
      expect(p.maxH, p.id).toBe(S.maxH)
      expect(p.ramps!.length, p.id).toBeGreaterThan(0)
      expect(validShape(s, S.maxH), p.id).toBe(true)
      expect(fairShape(s, S.maxH), p.id).toBe(true)
    }
    for (let i = 0; i < set.length; i++) for (let j = 0; j < i; j++)
      expect(shapeDistance(entryShape(set[i]), entryShape(set[j])), set[i].id + ' ' + set[j].id).toBeGreaterThanOrEqual(3)
  })
  it('no other slopes sets', () => expect(slopes.length).toBe(75))
  it('the file stays small', () => expect(readFileSync('public/puzzles.json').length).toBeLessThan(150_000))
})
