import { describe, expect, it } from 'vitest'
import { HeightMap } from '../../src/core/shape'
import { views } from '../../src/core/views'
import { LEVELS, countSolutions, makePuzzle, rng, sampleShape } from '../../src/core/generator'

const key = (h: HeightMap) => { const v = views(h); return [v.top, v.front, v.side].map(s => [...s].sort().join(',')).join('/') }
const allMaps = (cols: number, rows: number, maxH: number): HeightMap[] => {
  const out: HeightMap[] = [], n = cols * rows
  for (let k = 0; k < (maxH + 1) ** n; k++) {
    const h: number[] = []
    for (let i = 0, t = k; i < n; i++, t = Math.floor(t / (maxH + 1))) h.push(t % (maxH + 1))
    if (h.some(x => x > 0)) out.push(new HeightMap(cols, rows, h))
  }
  return out
}

describe('generator', () => {
  it('oneCubeUnique', () => {
    expect(countSolutions(views(new HeightMap(1, 1, [1])), 1, 1, 1)).toBe(1)
  })
  it('ambiguityExists', () => {
    const maps = allMaps(3, 3, 2), counts = maps.map(h => countSolutions(views(h), 3, 3, 2))
    expect(counts.every(c => c >= 1)).toBe(true)
    expect(counts.some(c => c === 2)).toBe(true)
  })
  it('countMatchesBruteForce', () => {
    for (const [cols, rows, maxH] of [[3, 3, 2], [2, 3, 3]]) {
      const maps = allMaps(cols, rows, maxH), groups = new Map<string, number>()
      for (const h of maps) groups.set(key(h), (groups.get(key(h)) ?? 0) + 1)
      for (const h of maps) expect(countSolutions(views(h), cols, rows, maxH, 1e9)).toBe(groups.get(key(h)))
    }
  })
  it('samplerRules', () => {
    const r = rng(7)
    for (const { a, b, maxH } of LEVELS) for (let s = 0; s < 200; s++) {
      const hm = sampleShape(a, b, maxH, r), { cols, rows, h } = hm
      expect([cols, rows, h.length]).toEqual([a, b, a * b])
      expect(h.every(v => Number.isInteger(v) && v >= 0 && v <= maxH)).toBe(true)
      expect(h).toContain(maxH)
      for (let c = 0; c < cols; c++) expect(h.some((v, i) => v > 0 && i % cols === c)).toBe(true)
      for (let rr = 0; rr < rows; rr++) expect(h.slice(rr * cols, rr * cols + cols).some(v => v > 0)).toBe(true)
      const cells = h.flatMap((v, i) => (v > 0 ? [i] : [])), seen = new Set([cells[0]]), todo = [cells[0]]
      while (todo.length) {
        const i = todo.pop()!, c = i % cols
        for (const j of [c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, i - cols, i + cols])
          if (j >= 0 && j < h.length && h[j] > 0 && !seen.has(j)) { seen.add(j); todo.push(j) }
      }
      expect(seen.size).toBe(cells.length)
    }
  })
  it('makePuzzleDeterministic', () => {
    for (const level of [1, 3, 5]) {
      const p = makePuzzle(level, 123), q = makePuzzle(level, 123)
      expect(q.hm.h).toEqual(p.hm.h)
      expect(q.seed).toBe(p.seed)
      expect(countSolutions(views(p.hm), p.hm.cols, p.hm.rows, LEVELS[level - 1].maxH)).toBe(1)
    }
  })
})
