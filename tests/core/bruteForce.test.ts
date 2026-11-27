import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { exactViews } from '../../src/core/exactViews'
import { countShapeSolutions } from '../../src/core/rampSolver'
import { allShapes, viewClasses } from '../helpers/bruteForce'

describe('brute force', () => {
  it('allShapesSmall: 1x1, height 1 has 6 shapes', () => {
    // height 0 or 1 as plain cubes (2), and a length-1 ramp E/W/N/S on height 0 (4)
    const all = allShapes(1, 1, 1)
    expect(all).toHaveLength(6)
    expect(all.filter(s => s.ramps.length === 0).map(s => s.hm.h[0]).sort()).toEqual([0, 1])
    expect(all.filter(s => s.ramps.length === 1 && s.hm.h[0] === 0).map(s => s.ramps[0].dir).sort()).toEqual(['E', 'N', 'S', 'W'])
  })
})

// The old solver is slow (~30 ms a class on 2x2, ~400 ms on 2x3), so big sizes compare a deterministic sample: every k-th class among the
// multi-shape classes and among the single-shape ones, half of `target` each. Brute force itself always covers every class.
const every = <T>(xs: T[], n: number) => xs.filter((_, i) => i % Math.ceil(xs.length / n) === 0)

const check = (cols: number, rows: number, maxH: number, target: number) => {
  const t0 = Date.now(), classes = viewClasses(cols, rows, maxH), t1 = Date.now()
  const all = [...classes.entries()], multi = all.filter(([, l]) => l.length > 1), single = all.filter(([, l]) => l.length === 1)
  const picked = [...every(multi, target / 2), ...every(single, target / 2)]
  const bad: { views: string; shape: unknown; solver: number; brute: number }[] = []
  for (const [key, list] of picked) {
    const got = countShapeSolutions(exactViews(list[0], maxH), cols, rows, maxH, 3), want = Math.min(list.length, 3)
    if (got !== want) bad.push({ views: key, shape: list[0], solver: got, brute: want })
  }
  console.log(`${cols}x${rows} h${maxH}: ${all.reduce((n, [, l]) => n + l.length, 0)} shapes, ${all.length} classes (${multi.length} multi), ` +
    `compared ${picked.length}, ${bad.length} mismatches; brute force ${t1 - t0} ms, solver ${Date.now() - t1} ms`)
  return bad
}

describe.runIf(process.env.SLOW)('oldSolverAgreesSmall', () => {
  it.each([[2, 2, 2, 2000], [2, 2, 3, 2500], [2, 3, 2, 400]])('%ix%i, maxH %i: old solver count = min(class size, 3)', { timeout: 300000 }, (c, r, h, target) => {
    const bad = check(c, r, h, target)
    if (bad.length) writeFileSync(`/tmp/solver-mismatch-${c}x${r}h${h}.json`, JSON.stringify(bad))
    expect(bad).toEqual([])
  })
})
