// Isometric lattice: point (t, m) has screen u = t*S, v = m + t/2 (v up). Ported from reference/index.html.
export type Pt = { t: number; m: number }
export type SegKey = string
export type TriKey = string
export type Line = { a: Pt; b: Pt }
export type GPt = { x: number; y: number }

const S = Math.sqrt(3) / 2
export const ISO_DIRS: readonly Pt[] = [{ t: 0, m: 1 }, { t: 1, m: 0 }, { t: 1, m: -1 }]

export const proj = (x: number, y: number, z: number): Pt => ({ t: x - y, m: y + z })

const ptKey = (p: Pt) => p.t + ':' + p.m
const isDir = (dt: number, dm: number) => ISO_DIRS.some(d => (d.t === dt && d.m === dm) || (d.t === -dt && d.m === -dm))

export function segKey(p: Pt, q: Pt): SegKey {
  if (!isDir(q.t - p.t, q.m - p.m)) throw new Error('not a unit isometric segment')
  const A = ptKey(p), B = ptKey(q)
  return A < B ? A + '|' + B : B + '|' + A
}

const parsePt = (s: string): Pt => { const [t, m] = s.split(':').map(Number); return { t, m } }
export const segEnds = (k: SegKey): [Pt, Pt] => { const [a, b] = k.split('|'); return [parsePt(a), parsePt(b)] }

export function unitSegments({ a, b }: Line): SegKey[] {
  const dt = b.t - a.t, dm = b.m - a.m, n = Math.max(Math.abs(dt), Math.abs(dm))
  if (!n) return []
  const st = dt / n, sm = dm / n
  if (!isDir(st, sm)) return []
  return Array.from({ length: n }, (_, i) =>
    segKey({ t: a.t + st * i, m: a.m + sm * i }, { t: a.t + st * (i + 1), m: a.m + sm * (i + 1) }))
}

export function triAt(u: number, v: number): TriKey {
  const t = u / S
  return Math.floor(t) + ',' + Math.floor(v - t / 2) + ',' + Math.floor(v + t / 2)
}

function triVerts(k: TriKey): Pt[] {
  const [kk, a, b] = k.split(',').map(Number), out: Pt[] = []
  for (const [w1, w2] of [[a, b], [a + 1, b + 1], [a, b + 1], [a + 1, b]]) {
    const t = w2 - w1
    if (t >= kk && t <= kk + 1) out.push({ t, m: w1 })
  }
  return out
}

export function triEdges(t: TriKey): SegKey[] {
  const [p, q, r] = triVerts(t)
  return [segKey(p, q), segKey(q, r), segKey(r, p)]
}

export function segTriangles(s: SegKey): [TriKey, TriKey] {
  const [p, q] = segEnds(s)
  const pu = p.t * S, pv = p.m + p.t / 2, qu = q.t * S, qv = q.m + q.t / 2
  const du = qu - pu, dv = qv - pv, len = Math.hypot(du, dv), e = 0.05
  const mu = (pu + qu) / 2, mv = (pv + qv) / 2, nu = -dv / len * e, nv = du / len * e
  return [triAt(mu + nu, mv + nv), triAt(mu - nu, mv - nv)]
}

export function triNeighbours(t: TriKey): TriKey[] {
  return triEdges(t).map(s => segTriangles(s).find(x => x !== t)!)
}

export function gridSegKey(p: GPt, q: GPt): string {
  if (Math.abs(q.x - p.x) + Math.abs(q.y - p.y) !== 1) throw new Error('not a unit grid segment')
  const A = p.x + ':' + p.y, B = q.x + ':' + q.y
  return A < B ? A + '|' + B : B + '|' + A
}
