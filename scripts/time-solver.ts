// Measuring tool: npx tsx scripts/time-solver.ts <cols> <rows> <maxH> <minPieces> <maxPieces> <seconds> [budget]
// Tries slope candidates (like slopeCandidate, with min..max ramps) for <seconds>, prints counts, solve-time
// percentiles and the projected hours for 25 (and 50) accepted puzzles on 8 workers.
import { exactViews } from '../src/core/exactViews'
import { solveShapes } from '../src/core/fastSolver'
import { rng, stairShape } from '../src/core/generator'
import { validShape, type Dir, type Ramp } from '../src/core/solid'
import { fairShape } from '../src/core/visibility'

const [cols, rows, maxH, lo, hi, secs] = process.argv.slice(2, 8).map(Number), budget = process.argv[8] ? +process.argv[8] : undefined
const r = rng(Date.now() % 1e9), pick = (n: number) => Math.floor(r() * n)
let tried = 0, fair = 0, partial = 0, unique = 0, gaveUp = 0
const times: number[] = [], t0 = performance.now()
while (performance.now() - t0 < secs * 1000) {
  tried++
  const hm = stairShape(cols, rows, maxH, r), ramps: Ramp[] = [], want = lo + pick(hi - lo + 1)
  while (ramps.length < want) {
    const fits: Ramp[] = []
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) for (const dir of ['E', 'W', 'N', 'S'] as Dir[]) for (const len of [1, 2, 3] as const) {
      const c: Ramp = { x, y, len, dir }
      if (validShape({ hm, ramps: [...ramps, c] }, maxH)) for (let w = len > 1 ? 3 : 1; w > 0; w--) fits.push(c)
    }
    if (!fits.length) break
    ramps.push(fits[pick(fits.length)])
  }
  const s = { hm, ramps }
  if (!ramps.length || !fairShape(s, maxH)) continue
  fair++
  const v = exactViews(s, maxH)
  if (v.partial) { partial++; continue }
  const t = performance.now(), res = solveShapes(v, cols, rows, maxH, { limit: 2, budget })
  times.push(performance.now() - t)
  if (res.gaveUp) gaveUp++; else if (res.count === 1) unique++
}
const wall = (performance.now() - t0) / 1000, q = (p: number) => (times.length ? [...times].sort((a, b) => a - b)[Math.min(times.length - 1, Math.floor(p * times.length))] : 0)
const h = (n: number) => wall / unique * n / 8 / 3600, lb = (n: number) => wall * n / 8 / 3600
console.log(`${cols}x${rows}x${maxH} pieces ${lo}-${hi} budget ${budget ?? 'off'} wall ${wall.toFixed(0)}s tried ${tried} fair ${fair} partial ${partial} unique(accepted) ${unique} gaveUp ${gaveUp} solves ${times.length} median ${q(0.5).toFixed(0)}ms p95 ${q(0.95).toFixed(0)}ms max ${q(1).toFixed(0)}ms`)
console.log(unique ? `projected ${h(25).toFixed(2)} h for 25, ${h(50).toFixed(2)} h for 50 on 8 workers` : `> ${secs}s per puzzle, projection > ${lb(25).toFixed(2)} h for 25, > ${lb(50).toFixed(2)} h for 50`)
