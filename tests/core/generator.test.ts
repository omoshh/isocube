import { describe, expect, it } from 'vitest'
import { HeightMap } from '../../src/core/shape'
import { views } from '../../src/core/views'
import { LEVELS, clampSpec, countSolutions, makeEndless, makePuzzle, makeSlopeCandidate, parseSpec, pickVaried, rng, sampleShape, specKey } from '../../src/core/generator'
import { mirrorShape, toEntryRamps, turnShape, type Shape } from '../../src/core/solid'
import { fairPicture } from '../../src/core/visibility'
import oldCandidates from '../fixtures/slope-candidates.json'

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
  }, 30_000)
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

describe('endless spec', () => {
  it('specKeyRoundTrip', () => {
    const s = { cols: 4, rows: 4, maxH: 3 }
    expect(parseSpec(specKey(s))).toEqual(s)
    expect(specKey(s)).toBe('4x4x3')
  })

  it('parseSpecRefuses', () => {
    for (const k of ['9x9x9', '1x3x2', '3x3x0', '3x3x2s', '5x3x2s', 'abc', '3x3x2S', ' 3x3x2']) expect(parseSpec(k)).toBeNull()
  })

  it('clampSpec', () => {
    expect(clampSpec({ cols: 9, rows: 1, maxH: 0 })).toEqual({ cols: 6, rows: 2, maxH: 1 })
  })

  it('slopeCandidateUnchanged', () => {
    for (const [seed, want] of Object.entries(oldCandidates)) {
      const s = makeSlopeCandidate(+seed)
      expect(s && { h: s.hm.h, ramps: toEntryRamps(s.ramps) }).toEqual(want)
    }
  })

  it('pickVariedSkipsTurnedAndMirroredCopies', () => {
    const a: Shape = { hm: new HeightMap(3, 3, [1, 0, 0, 2, 1, 0, 3, 2, 1]), ramps: [{ x: 1, y: 2, len: 2, dir: 'E' }] }
    const b: Shape = { hm: new HeightMap(3, 3, [0, 0, 0, 1, 1, 1, 2, 2, 2]), ramps: [] }
    const wide: Shape = { hm: new HeightMap(3, 4, new Array(12).fill(1)), ramps: [] }
    const list = [a, turnShape(a), mirrorShape(a), turnShape(mirrorShape(a)), b, turnShape(wide), wide]
    expect(pickVaried(list, s => s, 25)).toEqual([a, b, turnShape(wide)]) // a 4×3 and its turned 3×4 copy count as one
    expect(pickVaried(list, s => s, 1)).toEqual([a])
  })

  it('makeEndlessCubes', () => {
    const s = makeEndless({ cols: 4, rows: 3, maxH: 3 }, 7)
    expect([s.hm.cols, s.hm.rows, s.ramps.length]).toEqual([4, 3, 0])
    expect(Math.max(...s.hm.h)).toBeLessThanOrEqual(3)
    expect(fairPicture(s.hm)).toBe(true)
    expect(countSolutions(views(s.hm), 4, 3, 3)).toBe(1)
    expect(makeEndless({ cols: 4, rows: 3, maxH: 3 }, 7).hm.h).toEqual(s.hm.h)
  })
})
