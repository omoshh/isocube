// Slopes sets (round 4). Slow (one solver run per fair candidate), so it runs in parallel:
//   npx tsx scripts/gen-slopes.ts worker [<size>] <i> <n> <count> <out.json>   seeds i, i+n, i+2n, … until <count> found
//   npx tsx scripts/gen-slopes.ts merge [<size>] <part.json>…                  variety ≥ 3 cells, 25 puzzles into public/puzzles.json
// <size>: none = the 3×3–3×4 set (SL-NNN, level 0), 4x4x3 (SL2-NNN, level 2) or 4x5x4 (SL3-NNN, level 3, 4×5 or 5×4).
// Merge replaces only that set's entries and appends them; every other entry stays as it is.
import { readFileSync, writeFileSync } from 'node:fs'
import { makeSlopeCandidate, pickVaried, rng, slopeCandidate, type PuzzleFile } from '../src/core/generator'
import { HeightMap } from '../src/core/shape'
import { fromEntryRamps, toEntryRamps, type EntryRamp, type Shape } from '../src/core/solid'

// budget: solver steps per candidate (gave up = reject), so one candidate cannot run for minutes
const SIZES: Record<string, { level: number; id: string; maxH: number; make: (seed: number) => Shape | null }> = {
  '': { level: 0, id: 'SL', maxH: 3, make: makeSlopeCandidate },
  '4x4x3': { level: 2, id: 'SL2', maxH: 3, make: seed => slopeCandidate(4, 4, 3, rng(seed), 2e6) },
  '4x5x4': { level: 3, id: 'SL3', maxH: 4, make: seed => { const r = rng(seed); return r() < 0.5 ? slopeCandidate(4, 5, 4, r, 2e6) : slopeCandidate(5, 4, 4, r, 2e6) } },
}
type Found = { seed: number; cols: number; rows: number; h: number[]; ramps: EntryRamp[] }
const [mode, ...rest] = process.argv.slice(2)
const sizeKey = rest[0] in SIZES ? rest.shift()! : '', size = SIZES[sizeKey], args = rest
if (mode === 'worker') {
  const [i, n, count, out] = [+args[0], +args[1], +args[2], args[3]], found: Found[] = [], t0 = performance.now()
  for (let seed = 20261127 + i; found.length < count; seed += n) {
    const s = size.make(seed)
    if (s) {
      found.push({ seed, cols: s.hm.cols, rows: s.hm.rows, h: s.hm.h, ramps: toEntryRamps(s.ramps) }); writeFileSync(out, JSON.stringify(found))
      console.log(`worker ${i}: ${found.length} found, ${((performance.now() - t0) / 1000 / found.length).toFixed(1)} s each`)
    }
  }
  console.log(`worker ${i}: ${found.length} in ${((performance.now() - t0) / 1000).toFixed(0)} s`)
} else if (mode === 'merge') {
  // prefer longer ramps (the owner wants bigger pieces), then seed order
  const long = (f: Found) => f.ramps.reduce((n, r) => n + r[2] - 1, 0)
  const all = args.flatMap(f => JSON.parse(readFileSync(f, 'utf8')) as Found[]).sort((a, b) => long(b) - long(a) || a.seed - b.seed)
  const shape = (f: Found): Shape => ({ hm: new HeightMap(f.cols, f.rows, f.h), ramps: fromEntryRamps(f.ramps) })
  const pickd = pickVaried(all, shape, 25)
  if (pickd.length < 25) throw new Error(`only ${pickd.length} varied puzzles; run more workers`)
  pickd.sort((a, b) => a.ramps.length - b.ramps.length || a.h.reduce((x, y) => x + y, 0) - b.h.reduce((x, y) => x + y, 0) || a.seed - b.seed)
  const url = new URL('../public/puzzles.json', import.meta.url), file: PuzzleFile = JSON.parse(readFileSync(url, 'utf8'))
  file.puzzles = [...file.puzzles.filter(p => p.set !== 'slopes' || p.level !== size.level), ...pickd.map((f, i) => ({
    id: `${size.id}-${String(i + 1).padStart(3, '0')}`, set: 'slopes' as const, level: size.level, cols: f.cols, rows: f.rows, maxH: size.maxH, h: f.h, ramps: f.ramps,
  }))]
  writeFileSync(url, JSON.stringify(file) + '\n')
  console.log(`wrote ${pickd.length} ${size.id} puzzles`)
}
