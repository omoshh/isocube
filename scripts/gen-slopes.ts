// Slopes set (round 4). Slow (one solver run per fair candidate), so it runs in parallel:
//   npx tsx scripts/gen-slopes.ts worker <i> <n> <count> <out.json>   seeds i, i+n, i+2n, … until <count> found
//   npx tsx scripts/gen-slopes.ts merge <part.json>…                  variety ≥ 3 cells, 25 puzzles into public/puzzles.json
import { readFileSync, writeFileSync } from 'node:fs'
import { makeSlopeCandidate, shapeDistance, type PuzzleFile } from '../src/core/generator'
import { HeightMap } from '../src/core/shape'
import { fromEntryRamps, toEntryRamps, type EntryRamp, type Shape } from '../src/core/solid'

type Found = { seed: number; cols: number; rows: number; h: number[]; ramps: EntryRamp[] }
const [mode, ...args] = process.argv.slice(2)
if (mode === 'worker') {
  const [i, n, count, out] = [+args[0], +args[1], +args[2], args[3]], found: Found[] = [], t0 = performance.now()
  for (let seed = 20261127 + i; found.length < count; seed += n) {
    const s = makeSlopeCandidate(seed)
    if (s) { found.push({ seed, cols: s.hm.cols, rows: s.hm.rows, h: s.hm.h, ramps: toEntryRamps(s.ramps) }); writeFileSync(out, JSON.stringify(found)) }
  }
  console.log(`worker ${i}: ${found.length} in ${((performance.now() - t0) / 1000).toFixed(0)} s`)
} else if (mode === 'merge') {
  const all = args.flatMap(f => JSON.parse(readFileSync(f, 'utf8')) as Found[]).sort((a, b) => a.seed - b.seed)
  const shape = (f: Found): Shape => ({ hm: new HeightMap(f.cols, f.rows, f.h), ramps: fromEntryRamps(f.ramps) })
  const pickd: Found[] = []
  for (const f of all) if (pickd.length < 25 && pickd.every(p => shapeDistance(shape(p), shape(f)) >= 3)) pickd.push(f)
  if (pickd.length < 25) throw new Error(`only ${pickd.length} varied puzzles; run more workers`)
  pickd.sort((a, b) => a.ramps.length - b.ramps.length || a.h.reduce((x, y) => x + y, 0) - b.h.reduce((x, y) => x + y, 0) || a.seed - b.seed)
  const url = new URL('../public/puzzles.json', import.meta.url), file: PuzzleFile = JSON.parse(readFileSync(url, 'utf8'))
  file.puzzles = [...file.puzzles.filter(p => p.set !== 'slopes'), ...pickd.map((f, i) => ({
    id: `SL-${String(i + 1).padStart(3, '0')}`, set: 'slopes' as const, level: 0, cols: f.cols, rows: f.rows, maxH: 3, h: f.h, ramps: f.ramps,
  }))]
  writeFileSync(url, JSON.stringify(file) + '\n')
  console.log(`wrote ${pickd.length} slopes puzzles`)
}
