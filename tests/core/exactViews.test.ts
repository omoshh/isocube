import { describe, expect, it } from 'vitest'
import { exactView, exactViews } from '../../src/core/exactViews'
import { rng, type Rng } from '../../src/core/generator'
import { HeightMap } from '../../src/core/shape'
import { shapeViews, viewSketch } from '../../src/core/shapeViews'
import { slopePlane, validShape, type Dir, type Ramp, type Shape } from '../../src/core/solid'

const sorted = (s: Set<string>) => [...s].sort()
const VIEWS = ['top', 'front', 'side'] as const

function same(s: Shape, Z: number) {
  const a = exactViews(s, Z), b = shapeViews(s, Z), tag = JSON.stringify({ h: s.hm.h, cols: s.hm.cols, r: s.ramps, Z })
  for (const v of VIEWS) expect(sorted(a[v]), v + ' ' + tag).toEqual(sorted(b[v]))
  expect(a.partial, tag).toBe(b.partial)
}

function small(): Shape[] {
  const all: Shape[] = [], dirs = ['E', 'W', 'N', 'S'] as const
  for (let m = 0; m < 81; m++) {
    const hm = new HeightMap(2, 2, [0, 1, 2, 3].map(i => Math.floor(m / 3 ** i) % 3))
    const rec = (rs: Ramp[], i: number) => {
      if (i === 4) { all.push({ hm, ramps: rs }); return }
      rec(rs, i + 1)
      for (const dir of dirs) for (const len of [1, 2] as const) {
        const t = [...rs, { x: i % 2, y: Math.floor(i / 2), len, dir }]
        if (validShape({ hm, ramps: t }, 2)) rec(t, i + 1)
      }
    }
    rec([], 0)
  }
  return all
}

const pick = (r: Rng, n: number) => Math.floor(r() * n)
function randomShape(r: Rng, cols: number, rows: number, Z: number): Shape {
  const hm = new HeightMap(cols, rows, Array.from({ length: cols * rows }, () => pick(r, Z + 1)))
  const ramps: Ramp[] = [], want = pick(r, 6)
  while (ramps.length < want) {
    const fits: Ramp[] = []
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) for (const dir of ['E', 'W', 'N', 'S'] as Dir[]) for (const len of [1, 2, 3] as const) {
      const c: Ramp = { x, y, len, dir }
      if (validShape({ hm, ramps: [...ramps, c] }, Z)) for (let w = len > 1 ? 3 : 1; w > 0; w--) fits.push(c)
    }
    if (!fits.length) break
    ramps.push(fits[pick(r, fits.length)])
  }
  return { hm, ramps }
}
function randoms(n: number): [Shape, number][] {
  const r = rng(4242), out: [Shape, number][] = []
  for (let k = 0; k < n; k++) {
    const cols = 2 + pick(r, 4), rows = 2 + pick(r, 5), Z = 1 + pick(r, 5)
    out.push([randomShape(r, cols, rows, Z), Z])
  }
  return out
}

describe('exact views', () => {
  it('equalsShapeViewsSmall: every 2×2 shape with heights 0–2', { timeout: 120000 }, () => {
    for (const s of small()) same(s, 2)
  })
  it('equalsShapeViewsRandom', { timeout: 600000 }, () => {
    for (const [s, Z] of randoms(process.env.SLOW ? 20000 : 2000)) same(s, Z)
  })
  it('coveredEqualsSketch: front and side', { timeout: 120000 }, () => {
    for (const [s, Z] of randoms(2000)) for (const v of ['front', 'side'] as const)
      expect(exactView(s, Z, v).covered, v).toEqual(viewSketch(s, Z, v).covered)
  })
  it('seamOnOneSlope: two E ramps end to end on one slope', () => {
    const s: Shape = { hm: new HeightMap(2, 1, [0, 0]), ramps: [{ x: 0, y: 0, len: 1, dir: 'E' }, { x: 1, y: 0, len: 1, dir: 'E' }] }
    // two len-1 ramps on one base are two different slopes; on bases 0 and 1 they share one
    const t: Shape = { hm: new HeightMap(2, 1, [0, 1]), ramps: s.ramps }
    expect(slopePlane(t.ramps[0], 0)).toBe(slopePlane(t.ramps[1], 1))
    const v = exactViews(t, 2)
    expect(v.top).not.toContain('1:0|1:1')
    expect(v.front).not.toContain('1:1|1:2')
    expect(v.side).not.toContain('0:1|1:1')
    expect(v.partial).toBe(false)
    expect(exactViews(s, 1).top).toContain('1:0|1:1')
  })
  it.runIf(process.env.SLOW)('faster: at least 20× faster than shapeViews on 4×4×3', { timeout: 600000 }, () => {
    const r = rng(7), shapes = Array.from({ length: 200 }, () => randomShape(r, 4, 4, 3))
    // warm both up, then take the best of 3 runs each (steady state, not JIT start-up)
    const time = (f: (s: Shape, Z: number) => unknown) => Math.min(...[0, 1, 2, 3].map(() => {
      const t = performance.now()
      for (const s of shapes) f(s, 3)
      return performance.now() - t
    }).slice(1))
    const slow = time(shapeViews), fast = time(exactViews)
    console.log(`shapeViews ${slow.toFixed(1)} ms, exactViews ${fast.toFixed(1)} ms, ratio ${(slow / fast).toFixed(1)}`)
    expect(fast * 20).toBeLessThanOrEqual(slow)
  })
})
