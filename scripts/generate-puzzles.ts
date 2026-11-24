import { readFileSync, writeFileSync } from 'node:fs'
import { LEVELS, difficulty, makePuzzle, type PuzzleEntry, type PuzzleFile } from '../src/core/generator'
import { classicPuzzles } from '../src/core/classic'

const puzzles: PuzzleEntry[] = []
for (const { level, maxH } of LEVELS) {
  const t0 = performance.now(), seen = new Set<string>(), found: ReturnType<typeof makePuzzle>[] = []
  for (let seed = 2026; found.length < 50; seed++) {
    const p = makePuzzle(level, seed), k = p.hm.cols + ':' + p.hm.h.join(',')
    if (!seen.has(k)) { seen.add(k); found.push(p) }
  }
  const d = new Map(found.map(p => [p, difficulty(p.hm)]))
  found.sort((p, q) => d.get(p)![0] - d.get(q)![0] || d.get(p)![1] - d.get(q)![1] || p.seed - q.seed)
  found.forEach(({ hm }, i) => puzzles.push({
    id: `L${level}-${String(i + 1).padStart(3, '0')}`, set: 'level', level, cols: hm.cols, rows: hm.rows, maxH, h: hm.h,
  }))
  console.log(`level ${level}: ${((performance.now() - t0) / 1000).toFixed(2)} s`)
}
const ref = JSON.parse(readFileSync(new URL('../tests/fixtures/reference-puzzles.json', import.meta.url), 'utf8'))
puzzles.push(...classicPuzzles(ref))
const file: PuzzleFile = { version: 1, puzzles }
writeFileSync(new URL('../public/puzzles.json', import.meta.url), JSON.stringify(file) + '\n')
console.log(`wrote ${puzzles.length} puzzles`)
