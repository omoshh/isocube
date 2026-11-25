import { writeFileSync } from 'node:fs'
import { LEVELS, difficulty, makePuzzle, rng, sampleShape, type PuzzleEntry, type PuzzleFile } from '../src/core/generator'
import { fairPicture } from '../src/core/visibility'

const puzzles: PuzzleEntry[] = [], key = (hm: { cols: number; h: number[] }) => hm.cols + ':' + hm.h.join(',')
for (const { level, maxH } of LEVELS) {
  const t0 = performance.now(), seen = new Set<string>(), found: ReturnType<typeof makePuzzle>[] = []
  for (let seed = 2026; found.length < 50; seed++) {
    const p = makePuzzle(level, seed), k = key(p.hm)
    if (!seen.has(k)) { seen.add(k); found.push(p) }
  }
  const d = new Map(found.map(p => [p, difficulty(p.hm)]))
  found.sort((p, q) => d.get(p)![0] - d.get(q)![0] || d.get(p)![1] - d.get(q)![1] || p.seed - q.seed)
  found.forEach(({ hm }, i) => puzzles.push({
    id: `L${level}-${String(i + 1).padStart(3, '0')}`, set: 'level', level, cols: hm.cols, rows: hm.rows, maxH, h: hm.h,
  }))
  // reverse set: other shapes, never one of this level's views shapes; a drawing has exactly one set of views, so no uniqueness check
  const rev: typeof found = []
  for (let seed = 9026; rev.length < 50; seed++) {
    const { a, b } = LEVELS[level - 1], r = rng(seed), [c, rw] = r() < 0.5 ? [a, b] : [b, a], hm = sampleShape(c, rw, maxH, r), k = key(hm)
    if (!seen.has(k) && fairPicture(hm)) { seen.add(k); rev.push({ seed, hm }) }
  }
  const dr = new Map(rev.map(p => [p, difficulty(p.hm)]))
  rev.sort((p, q) => dr.get(p)![0] - dr.get(q)![0] || dr.get(p)![1] - dr.get(q)![1] || p.seed - q.seed)
  rev.forEach(({ hm }, i) => puzzles.push({
    id: `RL${level}-${String(i + 1).padStart(3, '0')}`, set: 'reverse', level, cols: hm.cols, rows: hm.rows, maxH, h: hm.h,
  }))
  console.log(`level ${level}: ${((performance.now() - t0) / 1000).toFixed(2)} s`)
}
const file: PuzzleFile = { version: 1, puzzles }
writeFileSync(new URL('../public/puzzles.json', import.meta.url), JSON.stringify(file) + '\n')
console.log(`wrote ${puzzles.length} puzzles`)
