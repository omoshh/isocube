import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { exactView, exactViews } from '../../src/core/exactViews'
import { entryShape, rng, type PuzzleFile, type Rng } from '../../src/core/generator'
import { HeightMap } from '../../src/core/shape'
import { shapeViews, viewSketch } from '../../src/core/shapeViews'
import { slopePlane, validShape, type Dir, type Ramp, type Shape } from '../../src/core/solid'

const sorted = (s: Set<string>) => [...s].sort()
const VIEWS = ['top', 'front', 'side'] as const

type Diff = { diffs: { view: string; exactOnly: string[]; floatOnly: string[] }[]; partial?: { exact: boolean; float: boolean } }
type Artefact = Diff & { cols: number; rows: number; Z: number; h: number[]; ramps: Ramp[]; why: string }
// shapes where the float sketch's 5 samples miss a short stretch; exactViews is the truth (hand-checked)
const ARTEFACTS: Artefact[] = JSON.parse(readFileSync('tests/fixtures/sketch-artefacts.json', 'utf8')).cases
const tagOf = (s: Shape, Z: number) => JSON.stringify([s.hm.cols, s.hm.rows, Z, s.hm.h, s.ramps])
const known = new Map(ARTEFACTS.map(a => [tagOf({ hm: new HeightMap(a.cols, a.rows, a.h), ramps: a.ramps }, a.Z), a]))

/** Where exactViews and shapeViews disagree on one shape. */
function diff(s: Shape, Z: number): Diff {
  const a = exactViews(s, Z), b = shapeViews(s, Z), out: Diff = { diffs: [] }
  for (const v of VIEWS) {
    const exactOnly = sorted(a[v]).filter(k => !b[v].has(k)), floatOnly = sorted(b[v]).filter(k => !a[v].has(k))
    if (exactOnly.length || floatOnly.length) out.diffs.push({ view: v, exactOnly, floatOnly })
  }
  if (a.partial !== b.partial) out.partial = { exact: a.partial, float: b.partial }
  return out
}
/** exactViews equals shapeViews, except on a listed artefact, which must differ exactly as listed. */
function same(s: Shape, Z: number, artefacts = true) {
  const k = artefacts ? known.get(tagOf(s, Z)) : undefined
  expect(diff(s, Z), tagOf(s, Z)).toEqual(k ? { diffs: k.diffs, ...(k.partial ? { partial: k.partial } : {}) } : { diffs: [] })
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
  it('sketchArtefacts: every listed shape still differs exactly as listed', () => {
    for (const a of ARTEFACTS) same({ hm: new HeightMap(a.cols, a.rows, a.h), ramps: a.ramps }, a.Z)
  })
  it('puzzlesWithRamps: every puzzle with ramps has the same views both ways', () => {
    const file: PuzzleFile = JSON.parse(readFileSync('public/puzzles.json', 'utf8'))
    const ps = file.puzzles.filter(p => p.ramps?.length)
    expect(ps.length).toBeGreaterThan(0)
    for (const p of ps) same(entryShape(p), p.maxH, false)
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
  it.runIf(process.env.SLOW)('faster: at least 15× faster than shapeViews on 4×4×3', { timeout: 600000 }, () => {
    const r = rng(7), shapes = Array.from({ length: 200 }, () => randomShape(r, 4, 4, 3))
    // warm both up, then take the best of 3 runs each (steady state, not JIT start-up)
    const time = (f: (s: Shape, Z: number) => unknown) => Math.min(...[0, 1, 2, 3].map(() => {
      const t = performance.now()
      for (const s of shapes) f(s, 3)
      return performance.now() - t
    }).slice(1))
    const slow = time(shapeViews), fast = time(exactViews)
    console.log(`shapeViews ${slow.toFixed(1)} ms, exactViews ${fast.toFixed(1)} ms, ratio ${(slow / fast).toFixed(1)}`)
    expect(fast * 15).toBeLessThanOrEqual(slow)
  })
})
