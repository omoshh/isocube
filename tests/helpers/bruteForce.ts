// Ground truth: every valid shape of a small box, and the shapes grouped by their exact views.
import { exactViews } from '../../src/core/exactViews'
import { HeightMap } from '../../src/core/shape'
import { validShape, type Ramp, type Shape } from '../../src/core/solid'

const DIRS = ['E', 'W', 'N', 'S'] as const

/** Calls `f` for every valid shape: heights 0..maxH, any non-overlapping ramps of length 1-3 (each listed once, by low-end cell). */
export function eachShape(cols: number, rows: number, maxH: number, f: (s: Shape) => void) {
  const n = cols * rows
  for (let m = 0; m < (maxH + 1) ** n; m++) {
    const h = Array.from({ length: n }, (_, i) => Math.floor(m / (maxH + 1) ** i) % (maxH + 1)), hm = new HeightMap(cols, rows, h)
    const rec = (rs: Ramp[], i: number) => {
      if (i === n) { f({ hm, ramps: rs }); return }
      rec(rs, i + 1)
      const x = i % cols, y = Math.floor(i / cols)
      for (const dir of DIRS) for (const len of [1, 2, 3] as const) {
        const t = [...rs, { x, y, len, dir }]
        if (validShape({ hm, ramps: t }, maxH)) rec(t, i + 1)
      }
    }
    rec([], 0)
  }
}

export function allShapes(cols: number, rows: number, maxH: number): Shape[] {
  const out: Shape[] = []
  eachShape(cols, rows, maxH, s => out.push(s))
  return out
}

export const classKey = (v: { top: Set<string>; front: Set<string>; side: Set<string> }) =>
  [v.top, v.front, v.side].map(x => [...x].sort().join(',')).join('/')

/** Shapes grouped by the key of their 3 views; shapes with a partly hidden line are left out. */
export function viewClasses(cols: number, rows: number, maxH: number): Map<string, Shape[]> {
  const out = new Map<string, Shape[]>()
  eachShape(cols, rows, maxH, s => {
    const v = exactViews(s, maxH)
    if (v.partial) return
    const k = classKey(v), a = out.get(k)
    if (a) a.push(s); else out.set(k, [s])
  })
  return out
}
