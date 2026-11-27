// Isometric lattice: point (t, m) has screen u = t*S, v = m + t/2 (v up). Ported from reference/index.html.
/** Exact point: the real coordinates are t + rt·√2 and m + rm·√2 (rt, rm only for the 45° points of arcs). */
export type Pt = { t: number; m: number; rt?: number; rm?: number }
export type SegKey = string
export type TriKey = string
export type Line = { a: Pt; b: Pt }
export type GPt = { x: number; y: number }

const S = Math.sqrt(3) / 2
export const ISO_DIRS: readonly Pt[] = [{ t: 0, m: 1 }, { t: 1, m: 0 }, { t: 1, m: -1 }]

export const proj = (x: number, y: number, z: number): Pt => ({ t: x - y, m: y + z })

const rational = (p: Pt) => !p.rt && !p.rm
export const ptKey = (p: Pt) => (rational(p) ? p.t + ':' + p.m : `${p.t}~${p.rt ?? 0}:${p.m}~${p.rm ?? 0}`)
export const samePt = (a: Pt, b: Pt) => ptKey(a) === ptKey(b)
export function toUV(p: Pt): [number, number] {
  const t = p.t + (p.rt ?? 0) * Math.SQRT2, m = p.m + (p.rm ?? 0) * Math.SQRT2
  return [t * S, m + t / 2]
}

export function segKey(p: Pt, q: Pt): SegKey {
  const A = ptKey(p), B = ptKey(q)
  if (A === B) throw new Error('a segment needs two different points')
  return A < B ? A + '|' + B : B + '|' + A
}

export function parsePt(s: string): Pt {
  const [t, m] = s.split(':')
  if (!t.includes('~')) return { t: +t, m: +m }
  const [ta, tb] = t.split('~').map(Number), [ma, mb] = m.split('~').map(Number)
  return { t: ta, m: ma, rt: tb, rm: mb }
}
export const segEnds = (k: SegKey): [Pt, Pt] => { const [a, b] = k.split('|'); return [parsePt(a), parsePt(b)] }

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a))

/** Drawn line → stored pieces, split at every lattice point on it (so unit and round 3 diagonal keys stay as they were). */
export function linePieces({ a, b }: Line): SegKey[] {
  if (samePt(a, b)) return []
  const half = (p: Pt) => rational(p) && Number.isInteger(2 * p.t) && Number.isInteger(2 * p.m)
  // shortcut: a line with a √2 end is not split at points it passes through; upgrade if an answer ever needs such a line in two parts
  if (!half(a) || !half(b)) return [segKey(a, b)]
  const A = [2 * a.t, 2 * a.m], D = [2 * (b.t - a.t), 2 * (b.m - a.m)], g = gcd(D[0], D[1])
  const cuts: Pt[] = [a]
  for (let i = 1; i < g; i++) {
    const T = A[0] + D[0] / g * i, M = A[1] + D[1] / g * i
    if (T % 2 === 0 && M % 2 === 0) cuts.push({ t: T / 2 + 0, m: M / 2 + 0 })
  }
  cuts.push(b)
  return cuts.slice(1).map((q, i) => segKey(cuts[i], q))
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
