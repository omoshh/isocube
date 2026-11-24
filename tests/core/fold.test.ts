import { describe, it, expect } from 'vitest'
import { FoldAnimation } from '../../src/core/fold'
import { makeNetsPuzzle } from '../../src/core/nets'

const close = (a: number[], b: number[]) => a.every((x, i) => Math.abs(x - b[i]) < 1e-6)
const run = (f: (p: ReturnType<typeof makeNetsPuzzle>, fa: FoldAnimation) => void) => {
  for (const level of [1, 2, 3] as const) for (let seed = 0; seed < 150; seed++) {
    const p = makeNetsPuzzle(level, seed)
    f(p, new FoldAnimation(p.options[p.correct], p.shape))
  }
}

describe('FoldAnimation', () => {
  it('flatAtStart', () => run((p, fa) => {
    const net = p.options[p.correct]
    const cs = net.map((_, i) => fa.pose(i, 0))
    for (const q of cs) for (const v of q) expect(v[2]).toBeCloseTo(0, 9)
    // unit squares laid out as the net (up to rotation/mirror): centres are pairwise grid-adjacent iff the net cells are
    const ctr = cs.map(q => [0, 1].map(k => q.reduce((s, v) => s + v[k], 0) / 4))
    net.forEach((a, i) => net.forEach((b, j) => {
      const adj = Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1
      expect(Math.abs(ctr[i][0] - ctr[j][0]) + Math.abs(ctr[i][1] - ctr[j][1]) > 0.999 &&
        Math.abs(ctr[i][0] - ctr[j][0]) + Math.abs(ctr[i][1] - ctr[j][1]) < 1.001).toBe(adj)
    }))
  }), 120000)
  it('landsOnFaces', () => run((p, fa) => {
    const seen = new Set<string>()
    p.options[p.correct].forEach((_, i) => {
      const { cube, normal } = fa.finalFace(i)
      seen.add(cube + '|' + normal)
      const ctr = [0, 1, 2].map(k => cube[k] + 0.5 + normal[k] / 2)
      const q = fa.pose(i, 1)
      expect(close([0, 1, 2].map(k => q.reduce((s, v) => s + v[k], 0) / 4), ctr)).toBe(true)
      for (const v of q) { // corners lie on the face plane within the unit square
        const d = [0, 1, 2].map(k => v[k] - ctr[k])
        expect(Math.abs(d[0] * normal[0] + d[1] * normal[1] + d[2] * normal[2])).toBeLessThan(1e-6)
        expect(Math.hypot(...d)).toBeCloseTo(Math.SQRT1_2, 6)
      }
    })
    expect(seen.size).toBe(p.options[p.correct].length)
  }), 120000)
})
