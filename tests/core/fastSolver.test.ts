import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { exactViews } from '../../src/core/exactViews'
import { solveShapes } from '../../src/core/fastSolver'
import { entryShape, rng, stairShape, type PuzzleFile, type Rng } from '../../src/core/generator'
import { countShapeSolutions } from '../../src/core/rampSolver'
import { HeightMap } from '../../src/core/shape'
import { validShape, type Dir, type Ramp, type Shape } from '../../src/core/solid'
import { fairShape } from '../../src/core/visibility'
import { classKey, viewClasses } from '../helpers/bruteForce'

const file: PuzzleFile = JSON.parse(readFileSync('public/puzzles.json', 'utf8'))
const solve = (s: Shape, maxH: number, limit = 2) => solveShapes(exactViews(s, maxH), s.hm.cols, s.hm.rows, maxH, { limit })

/** A fair stair shape with 1–3 ramps, as `slopeCandidate` builds it but before its solution count; or null. */
function fairCandidate(cols: number, rows: number, maxH: number, r: Rng): Shape | null {
  const hm = stairShape(cols, rows, maxH, r), ramps: Ramp[] = [], want = 1 + Math.floor(r() * 3)
  while (ramps.length < want) {
    const fits: Ramp[] = []
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) for (const dir of ['E', 'W', 'N', 'S'] as Dir[]) for (const len of [1, 2, 3] as const) {
      const c: Ramp = { x, y, len, dir }
      if (validShape({ hm, ramps: [...ramps, c] }, maxH)) fits.push(c)
    }
    if (!fits.length) break
    ramps.push(fits[Math.floor(r() * fits.length)])
  }
  const s = { hm, ramps }
  return ramps.length && fairShape(s, maxH) ? s : null
}
function* fairCandidates(seed: number, size: () => [number, number]) {
  const r = rng(seed)
  for (;;) { const [c, w] = size(), s = fairCandidate(c, w, 3, r); if (s) yield s }
}

/** About `multi` multi-shape and `single` single-shape view classes (every k-th; Infinity = all): solver count = min(class size, 3). */
function checkClasses(cols: number, rows: number, maxH: number, multi: number, single: number) {
  const t0 = Date.now(), classes = viewClasses(cols, rows, maxH), t1 = Date.now()
  const all = [...classes], every = <T>(xs: T[], n: number) => xs.filter((_, i) => i % Math.max(1, Math.ceil(xs.length / n)) === 0)
  const picked = [...every(all.filter(([, l]) => l.length > 1), multi), ...every(all.filter(([, l]) => l.length === 1), single)]
  const bad: string[] = []
  for (const [k, list] of picked) {
    const got = solveShapes(exactViews(list[0], maxH), cols, rows, maxH, { limit: 3 }).count
    if (got !== Math.min(list.length, 3)) bad.push(`${k}: ${got} vs ${list.length}`)
  }
  console.log(`${cols}x${rows} h${maxH}: ${classes.size} classes, checked ${picked.length}; brute force ${t1 - t0} ms, solver ${Date.now() - t1} ms`)
  return { n: picked.length, bad }
}

describe('fast solver', () => {
  it('matchesBruteForce: every 2×2 view class (heights 0–2)', { timeout: 120000 }, () => {
    const r = checkClasses(2, 2, 2, Infinity, Infinity)
    expect(r.n).toBe(7734)
    expect(r.bad).toEqual([])
  })
  // 2×3 has 488,360 classes (240,088 multi-shape) at ~40 ms each: all would take hours, so a sample fits the time cap
  it.runIf(process.env.SLOW)('matchesBruteForce: 2×3 (heights 0–2), a sample of 1000 multi-shape and 500 single-shape classes', { timeout: 400000 }, () => {
    const r = checkClasses(2, 3, 2, 1000, 500)
    expect(r.n).toBeGreaterThan(1450)
    expect(r.bad).toEqual([])
  })

  it('keepsOldCases', () => {
    expect(solve({ hm: new HeightMap(1, 1, [0]), ramps: [{ x: 0, y: 0, len: 1, dir: 'E' }] }, 1).count).toBe(1)
    expect(solve({ hm: new HeightMap(3, 3, [2, 2, 2, 2, 1, 2, 2, 2, 2]), ramps: [] }, 2, 20).count).toBe(10)
    expect(solve({ hm: new HeightMap(3, 1, [1, 1, 1]), ramps: [{ x: 0, y: 0, len: 2, dir: 'E' }] }, 2).count).toBe(2)
    const hidden: Shape = { hm: new HeightMap(3, 2, [1, 1, 1, 0, 2, 3]), ramps: [{ x: 0, y: 1, len: 2, dir: 'E' }] }
    expect(() => solve(hidden, 3)).toThrow('partly hidden')
    const c = (h: number[], ramps: Shape['ramps']) => solve({ hm: new HeightMap(2, 2, h), ramps }, 2, 5).count
    expect(c([0, 0, 1, 1], [{ x: 0, y: 1, len: 1, dir: 'S' }, { x: 1, y: 0, len: 2, dir: 'W' }])).toBe(1)
    expect(c([0, 1, 0, 1], [{ x: 0, y: 1, len: 1, dir: 'S' }, { x: 1, y: 0, len: 2, dir: 'N' }])).toBe(1)
    expect(c([1, 1, 0, 0], [{ x: 0, y: 1, len: 2, dir: 'E' }, { x: 1, y: 0, len: 1, dir: 'S' }])).toBe(1)
  })

  it('solutionsAreReal: every reported shape has the target views (50 fair 3×3 candidates)', { timeout: 60000 }, () => {
    const gen = fairCandidates(7, () => [3, 3])
    let found = 0
    for (let i = 0; i < 50; i++) {
      const s = gen.next().value!, target = classKey(exactViews(s, 3)), seen: string[] = []
      const { count } = solveShapes(exactViews(s, 3), 3, 3, 3, { limit: 3, onSolution: t => seen.push(classKey(exactViews(t, 3))) })
      expect(seen.length).toBe(count)
      expect(count).toBeGreaterThan(0)
      for (const k of seen) expect(k).toBe(target)
      found += count
    }
    expect(found).toBeGreaterThan(50) // some candidates have twins, so shapes other than the target were checked too
  })

  it('budgetGivesUp: a tiny step budget on a 3×4 target gives up, never claims one solution', () => {
    const s = fairCandidates(11, () => [3, 4]).next().value!
    const r = solveShapes(exactViews(s, 3), 3, 4, 3, { budget: 10 })
    expect(r.gaveUp).toBe(true)
    expect(r).not.toEqual({ count: 1, gaveUp: false })
    expect(solveShapes(exactViews(s, 3), 3, 4, 3).gaveUp).toBe(false)
  })

  // the old solver is the slow side (~1.4 s a 3×3, ~9 s a 3×4, up to ~60 s): random candidates get ~6 minutes, so the
  // SLOW run stays ~10, and only every 8th is a 3×4 so that at least 100 fit
  it.runIf(process.env.SLOW)('matchesOldSolver: the 25 Slopes puzzles and random fair 3×3/3×4 candidates', { timeout: 600000 }, () => {
    const bad: string[] = []
    let tOld = 0, tNew = 0
    const cmp = (s: Shape, name: string) => {
      const v = exactViews(s, 3), { cols, rows } = s.hm
      let t = performance.now()
      const want = countShapeSolutions(v, cols, rows, 3, 2)
      tOld += performance.now() - t; t = performance.now()
      const got = solveShapes(v, cols, rows, 3, { limit: 2 })
      tNew += performance.now() - t
      if (got.gaveUp || got.count !== want) bad.push(`${name}: new ${got.count}${got.gaveUp ? ' (gave up)' : ''}, old ${want}`)
    }
    const slopes = file.puzzles.filter(p => p.set === 'slopes')
    expect(slopes).toHaveLength(25)
    for (const p of slopes) cmp(entryShape(p), p.id)
    console.log(`Slopes puzzles: old ${(tOld / 1000).toFixed(1)} s, new ${(tNew / 1000).toFixed(2)} s`)
    let j = 0
    const gen = fairCandidates(5, () => (j++ % 8 === 7 ? [3, 4] : [3, 3]))
    const start = Date.now()
    let n = 0, wide = 0
    while (n < 300 && Date.now() - start < 380000) { const s = gen.next().value!; cmp(s, JSON.stringify(s)); n++; if (s.hm.rows === 4) wide++ }
    console.log(`random candidates: ${n} (${wide} 3×4); total old ${(tOld / 1000).toFixed(1)} s, new ${(tNew / 1000).toFixed(2)} s`)
    expect(n).toBeGreaterThanOrEqual(100)
    expect(bad).toEqual([])
  })
})
