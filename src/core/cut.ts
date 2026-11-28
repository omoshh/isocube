import { arcPolyline, type ArcKey } from './arcs'
import { segEnds, toUV, type SegKey } from './geometry'

type P2 = [number, number]
const EPS = 1e-6
const TOL = 2e-6 // absolute distance: cut points are stored rounded to 6 decimals

/** Parameters s in (0, 1) along `key` (first end to second) where another line or an arc crosses it or ends on it. */
export function lineCuts(key: SegKey, others: SegKey[], arcs: ArcKey[]): number[] {
  const [a, b] = segEnds(key).map(toUV) as [P2, P2], d: P2 = [b[0] - a[0], b[1] - a[1]]
  const len = Math.hypot(d[0], d[1]), found: number[] = []
  const hit = (p: P2, q: P2) => {
    const e: P2 = [q[0] - p[0], q[1] - p[1]], den = d[0] * e[1] - d[1] * e[0]
    if (Math.abs(den) < 1e-12) return // parallel: no single crossing
    const w: P2 = [p[0] - a[0], p[1] - a[1]]
    const s = (w[0] * e[1] - w[1] * e[0]) / den, r = (w[0] * d[1] - w[1] * d[0]) / den
    if (s > 0 && s < 1 && Math.hypot(e[0], e[1]) * Math.max(-r, r - 1) <= TOL) found.push(s)
  }
  for (const k of others) if (k !== key) { const [p, q] = segEnds(k).map(toUV); hit(p, q) }
  // shortcut: arcs are 2000-step polylines (error ~1e-7); upgrade if a cut must be exact to the last digit
  for (const k of arcs) { const ps = arcPolyline(k, 2000); for (let i = 1; i < ps.length; i++) hit(ps[i - 1], ps[i]) }
  const out: number[] = []
  for (const s of found.sort((x, y) => x - y)) if (s > TOL / len && s < 1 - TOL / len && (!out.length || s - out[out.length - 1] >= EPS)) out.push(s)
  return out
}
