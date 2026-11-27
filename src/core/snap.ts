import { samePt, toUV, type GPt, type Line, type Pt } from './geometry'

const S = Math.sqrt(3) / 2
type UV = { u: number; v: number }
const DIRS: readonly Pt[] = [{ t: 0, m: 1 }, { t: 1, m: 0 }, { t: 1, m: -1 }]
const lp = (p: Pt): [number, number] => [p.t * S, p.m + p.t / 2]
const nearest = (q: UV): Pt => { const t = Math.round(q.u / S); return { t: t + 0, m: Math.round(q.v - t / 2) + 0 } } // +0 turns -0 into 0

/** Best of the 3 directions (both signs) from `a` towards `q`, rounded to whole steps (port of snapEnd). */
function snapFrom(a: Pt, q: UV, dirs: readonly Pt[] = DIRS): Pt {
  const [su, sv] = lp(a)
  let best = a, bd = Infinity
  for (const d of dirs) {
    const du = d.t * S, dv = d.m + d.t / 2
    const n = Math.round(((q.u - su) * du + (q.v - sv) * dv) / (du * du + dv * dv))
    const p = { t: a.t + n * d.t + 0, m: a.m + n * d.m + 0 }
    const [pu, pv] = lp(p), e = (pu - q.u) ** 2 + (pv - q.v) ** 2
    if (e < bd) { bd = e; best = p }
  }
  return best
}

export function snapDragIso(start: UV, end: UV): Line | null {
  const a = nearest(start), b = snapFrom(a, end)
  return a.t === b.t && a.m === b.m ? null : { a, b }
}

/** The lattice dot truly nearest to q (rounding t alone can pick a neighbour near the cell edges). */
function nearestDot(q: UV): Pt {
  const t0 = Math.round(q.u / S)
  let best = nearest(q), bd = Infinity
  for (let t = t0 - 1; t <= t0 + 1; t++) {
    const p = { t: t + 0, m: Math.round(q.v - t / 2) + 0 }, d = Math.hypot(t * S - q.u, p.m + t / 2 - q.v)
    if (d < bd) { bd = d; best = p }
  }
  return best
}

export type SnapOpts = { half: boolean; extra: Pt[] }

/** Nearest snap point: a grid dot, an edge midpoint (when `half`), or one of `extra` (eighth points of drawn arcs). */
export function snapPoint(q: UV, o: SnapOpts): Pt {
  const cands = [nearestDot(q), ...o.extra]
  if (o.half) { const h = nearestDot({ u: 2 * q.u, v: 2 * q.v }); cands.push({ t: h.t / 2 + 0, m: h.m / 2 + 0 }) }
  let best = cands[0], bd = Infinity
  for (const p of cands) { const [u, v] = toUV(p), d = Math.hypot(u - q.u, v - q.v); if (d < bd) { bd = d; best = p } }
  return best
}

export function snapFree(start: UV, end: UV, o: SnapOpts): Line | null {
  const a = snapPoint(start, o), b = snapPoint(end, o)
  return samePt(a, b) ? null : { a, b }
}

function rdp(pts: UV[], tol: number): UV[] {
  const p = pts[0], q = pts[pts.length - 1], dx = q.u - p.u, dy = q.v - p.v, L = Math.hypot(dx, dy)
  let idx = -1, md = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = L ? Math.abs(dx * (pts[i].v - p.v) - dy * (pts[i].u - p.u)) / L : Math.hypot(pts[i].u - p.u, pts[i].v - p.v)
    if (d > md) { md = d; idx = i }
  }
  if (md <= tol) return [p, q]
  return [...rdp(pts.slice(0, idx + 1), tol).slice(0, -1), ...rdp(pts.slice(idx), tol)]
}

export function snapFreehandIso(points: UV[]): Line[] {
  if (points.length < 2) return []
  const vs = rdp(points, 0.35), out: Line[] = []
  let cur = nearest(vs[0])
  for (let i = 1; i < vs.length; i++) {
    const du = vs[i].u - vs[i - 1].u, dv = vs[i].v - vs[i - 1].v
    if (Math.hypot(du, dv) < 0.5) continue
    const ang = Math.atan2(dv, du) * 180 / Math.PI
    // line directions sit at 90, 30 and -30 degrees (mod 180)
    const off = Math.min(...[90, 30, -30].map(d => { const x = Math.abs(ang - d) % 180; return Math.min(x, 180 - x) }))
    if (off > 15) return []
    const b = snapFrom(cur, vs[i])
    if (b.t === cur.t && b.m === cur.m) continue
    out.push({ a: cur, b })
    cur = b
  }
  return out
}

export function snapDragSquare(start: GPt, end: GPt): { a: GPt; b: GPt } | null {
  const a = { x: Math.round(start.x) + 0, y: Math.round(start.y) + 0 }
  const dx = end.x - a.x, dy = end.y - a.y
  const b = Math.abs(dx) >= Math.abs(dy) ? { x: a.x + Math.round(dx) + 0, y: a.y } : { x: a.x, y: a.y + Math.round(dy) + 0 }
  return b.x === a.x && b.y === a.y ? null : { a, b }
}
