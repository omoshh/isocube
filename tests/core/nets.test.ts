import { describe, it, expect } from 'vitest'
import { folds, makeNetsPuzzle, type Net } from '../../src/core/nets'

type P = [number, number]
const key = (p: P) => p.join(',')
const norm = (ps: P[]): string => {
  const mi = Math.min(...ps.map(p => p[0])), mj = Math.min(...ps.map(p => p[1]))
  return ps.map(p => [p[0] - mi, p[1] - mj] as P).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(key).join(';')
}
const T: ((p: P) => P)[] = [p => [p[0], p[1]], p => [-p[1], p[0]], p => [-p[0], -p[1]], p => [p[1], -p[0]],
  p => [-p[0], p[1]], p => [p[1], p[0]], p => [p[0], -p[1]], p => [-p[1], -p[0]]]
const canon = (ps: P[]) => T.map(t => norm(ps.map(t))).sort()[0]

// all free hexominoes by growing free polyominoes
function freePolyominoes(n: number): P[][] {
  let cur = new Map<string, P[]>([[canon([[0, 0]]), [[0, 0]]]])
  for (let s = 1; s < n; s++) {
    const next = new Map<string, P[]>()
    for (const ps of cur.values()) {
      const have = new Set(ps.map(key))
      for (const [i, j] of ps) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q: P = [i + di, j + dj]
        if (have.has(key(q))) continue
        const np = [...ps, q]
        next.set(canon(np), np)
      }
    }
    cur = next
  }
  return [...cur.values()]
}
const asNet = (ps: P[]): Net => ps.map(([c, r]) => ({ c, r }))
const netKey = (n: Net) => norm(n.map(x => [x.c, x.r] as P))

describe('nets', () => {
  it('elevenCubeNets', () => {
    const hex = freePolyominoes(6)
    expect(hex.length).toBe(35)
    expect(hex.filter(h => folds(asNet(h), [[0, 0, 0]])).length).toBe(11)
  })

  for (const level of [1, 2, 3] as const) {
    it(`generatedNetsFold + wrongNetsDoNotFold level ${level}`, () => {
      for (let seed = 0; seed < 450; seed++) {
        const p = makeNetsPuzzle(level, seed)
        expect(p.options.length).toBe(4)
        expect(p.correct).toBeGreaterThanOrEqual(0)
        expect(p.correct).toBeLessThan(4)
        p.options.forEach((o, i) => {
          expect(Math.min(...o.map(x => x.c))).toBe(0)
          expect(Math.min(...o.map(x => x.r))).toBe(0)
          expect(folds(o, p.shape)).toBe(i === p.correct)
        })
        // distinct up to rotation and mirror, as on the page
        expect(new Set(p.options.map(o => canon(o.map(x => [x.c, x.r] as P)))).size).toBe(4)
        expect(new Set(p.options.map(netKey)).size).toBe(4)
        if (seed < 20) expect(makeNetsPuzzle(level, seed)).toEqual(p)
      }
    }, 120_000)
  }
})
