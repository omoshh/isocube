import type { PuzzleEntry } from './generator'

type RefPuzzle = { plan: number[][]; Z: number; level: number; name?: string }

// The page's PUZZLES, in order: plan[r][c] with rows back to front, same cells as HeightMap.
export function classicPuzzles(ref: unknown[]): PuzzleEntry[] {
  return (ref as RefPuzzle[]).map((p, i) => ({
    id: 'C-' + String(i + 1).padStart(3, '0'), set: 'classic', level: p.level,
    cols: p.plan[0].length, rows: p.plan.length, maxH: p.Z, h: p.plan.flat(),
  }))
}
