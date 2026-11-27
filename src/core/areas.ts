// The closed area around a point, bounded by any drawn segments (lines and arc polylines), for the paint bucket.
export type P2 = [number, number]

const EPS = 1e-9
const key = (p: P2) => Math.round(p[0] * 1e6) + ',' + Math.round(p[1] * 1e6)
const cross = (a: P2, b: P2) => a[0] * b[1] - a[1] * b[0]
const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]]

export function polyArea(pts: P2[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) s += cross(pts[i], pts[(i + 1) % pts.length])
  return s / 2
}

export function inPoly(pts: P2[], q: P2): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if ((yi > q[1]) !== (yj > q[1]) && q[0] < (xj - xi) * (q[1] - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Cut points (as parameters 0–1 along s) where other segments cross or touch s. */
function cuts(s: [P2, P2], all: [P2, P2][]): number[] {
  const d = sub(s[1], s[0]), L2 = d[0] * d[0] + d[1] * d[1], ts = [0, 1]
  for (const o of all) {
    if (o === s) continue
    const e = sub(o[1], o[0]), den = cross(d, e), w = sub(o[0], s[0])
    if (Math.abs(den) > EPS) {
      const t = cross(w, e) / den, u = cross(w, d) / den
      if (t > -EPS && t < 1 + EPS && u > -EPS && u < 1 + EPS) ts.push(t)
    } else if (Math.abs(cross(w, d)) < 1e-7 * Math.sqrt(L2)) { // collinear: the other's ends cut s
      for (const p of o) { const t = ((p[0] - s[0][0]) * d[0] + (p[1] - s[0][1]) * d[1]) / L2; if (t > 0 && t < 1) ts.push(t) }
    }
  }
  return ts.sort((a, b) => a - b)
}

/** The counter-clockwise boundary of the smallest closed face holding q, or null when q is in no closed face. */
export function areaAt(segs: [P2, P2][], q: P2): P2[] | null {
  const pts = new Map<string, P2>(), adj = new Map<string, Set<string>>()
  const link = (a: string, b: string) => { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a)!.add(b) }
  for (const s of segs) {
    if (key(s[0]) === key(s[1])) continue
    const d = sub(s[1], s[0]), at = (t: number): P2 => [s[0][0] + d[0] * t, s[0][1] + d[1] * t]
    const ks = cuts(s, segs).map(t => { const p = at(t), k = key(p); if (!pts.has(k)) pts.set(k, p); return k })
    for (let i = 1; i < ks.length; i++) if (ks[i] !== ks[i - 1]) { link(ks[i - 1], ks[i]); link(ks[i], ks[i - 1]) }
  }
  const ang = (a: string, b: string) => { const [x, y] = sub(pts.get(b)!, pts.get(a)!); return Math.atan2(y, x) }

  // edges the ray from q (slightly tilted, so it misses vertices) crosses, nearest first
  const dir: P2 = [1, 1e-4], hits: { a: string; b: string; t: number }[] = []
  for (const [a, bs] of adj) for (const b of bs) {
    if (a > b) continue
    const pa = pts.get(a)!, e = sub(pts.get(b)!, pa), den = cross(dir, e), w = sub(pa, q)
    if (Math.abs(den) < EPS) continue
    const t = cross(w, e) / den, u = cross(w, dir) / den
    if (t > 0 && u >= 0 && u <= 1) hits.push({ a, b, t })
  }
  hits.sort((x, y) => x.t - y.t)

  const steps = 4 * [...adj.values()].reduce((n, s) => n + s.size, 0) + 4
  for (const h of hits) {
    let [p, v] = cross(sub(pts.get(h.b)!, pts.get(h.a)!), sub(q, pts.get(h.a)!)) > 0 ? [h.a, h.b] : [h.b, h.a]
    const start = p + '>' + v, poly: P2[] = []
    for (let i = 0; i < steps; i++) {
      poly.push(pts.get(p)!)
      // next: the first edge out of v clockwise from the way back to p (keeps the face on the left)
      const back = ang(v, p)
      let best = p, bd = Infinity
      for (const w of adj.get(v)!) {
        if (w === p) continue
        const dd = ((back - ang(v, w)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) || 2 * Math.PI
        if (dd < bd) { bd = dd; best = w }
      }
      ;[p, v] = [v, best]
      if (p + '>' + v === start) break
    }
    if (polyArea(poly) > 0 && inPoly(poly, q)) return poly
  }
  return null
}
