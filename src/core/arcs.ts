// Arcs of circles (radius ½ or 1) in the 3 face planes, kept exact: every end is an eighth point (k·45°).
import { parsePt, ptKey, samePt, toUV, type Pt } from './geometry'

/** The plane's normal: z = top, y = front (xz), x = side (yz). */
export type Plane = 'x' | 'y' | 'z'
/** Starts at eighth k0 (0–7) and runs n eighths (1–8) counter-clockwise in the plane basis. */
export type Arc = { plane: Plane; c: Pt; r: 0.5 | 1; k0: number; n: number }
/** One eighth of a circle: `A<plane>|<centre>|<r>|<k>`. */
export type ArcKey = string

const X: Pt = { t: 1, m: 0 }, Y: Pt = { t: -1, m: 1 }, Z: Pt = { t: 0, m: 1 }
const BASIS: Record<Plane, [Pt, Pt]> = { z: [X, Y], y: [X, Z], x: [Y, Z] }
const PLANES: Plane[] = ['z', 'y', 'x']
// cos and sin of k·45° as [rational part, √2 part]
const C8: [number, number][] = [[1, 0], [0, 0.5], [0, 0], [0, -0.5], [-1, 0], [0, -0.5], [0, 0], [0, 0.5]]
const S8: [number, number][] = [[0, 0], [0, 0.5], [1, 0], [0, 0.5], [0, 0], [0, -0.5], [-1, 0], [0, -0.5]]
const mod8 = (k: number) => ((k % 8) + 8) % 8

export const isArcKey = (k: string) => k.startsWith('A')

export function eighthPoint(plane: Plane, c: Pt, r: 0.5 | 1, k: number): Pt {
  const [e1, e2] = BASIS[plane], [ca, cb] = C8[mod8(k)], [sa, sb] = S8[mod8(k)]
  return {
    t: c.t + r * (ca * e1.t + sa * e2.t) + 0, m: c.m + r * (ca * e1.m + sa * e2.m) + 0,
    rt: (c.rt ?? 0) + r * (cb * e1.t + sb * e2.t) + 0, rm: (c.rm ?? 0) + r * (cb * e1.m + sb * e2.m) + 0,
  }
}

export const arcPieces = (a: Arc): ArcKey[] =>
  Array.from({ length: a.n }, (_, i) => `A${a.plane}|${ptKey(a.c)}|${a.r}|${mod8(a.k0 + i)}`)

function parse(k: ArcKey) {
  const [p, c, r, e] = k.split('|')
  return { plane: p.slice(1) as Plane, c: parsePt(c), r: Number(r) as 0.5 | 1, k: Number(e) }
}

export function pieceEnds(k: ArcKey): [Pt, Pt] {
  const a = parse(k)
  return [eighthPoint(a.plane, a.c, a.r, a.k), eighthPoint(a.plane, a.c, a.r, a.k + 1)]
}

/** Screen point at angle `deg` on the circle of (plane, c, r). */
function at(plane: Plane, c: Pt, r: number, deg: number): [number, number] {
  const [e1, e2] = BASIS[plane].map(toUV), [cu, cv] = toUV(c), th = deg * Math.PI / 180
  return [cu + r * (Math.cos(th) * e1[0] + Math.sin(th) * e2[0]), cv + r * (Math.cos(th) * e1[1] + Math.sin(th) * e2[1])]
}

export function arcPolyline(k: ArcKey, steps = 6): [number, number][] {
  const a = parse(k), [p, q] = pieceEnds(k)
  const pts = Array.from({ length: steps + 1 }, (_, i) => at(a.plane, a.c, a.r, (a.k + i / steps) * 45))
  pts[0] = toUV(p); pts[steps] = toUV(q) // exact ends, so pieces and lines join cleanly
  return pts
}

export const arcMid = (a: Arc): [number, number] => at(a.plane, a.c, a.r, (a.k0 + a.n / 2) * 45)

/** Every valid arc with ends p and q: fewest eighths first, then lower on screen, then plane z, y, x. */
export function arcsThrough(p: Pt, q: Pt): Arc[] {
  const out: Arc[] = []
  for (const plane of PLANES) for (const r of [1, 0.5] as const) for (let i = 0; i < 8; i++) {
    const o = eighthPoint(plane, { t: 0, m: 0 }, r, i)
    const c = { t: p.t - o.t + 0, m: p.m - o.m + 0 }
    if ((p.rt ?? 0) !== o.rt || (p.rm ?? 0) !== o.rm) continue // the centre must be rational
    if (!Number.isInteger(2 * c.t) || !Number.isInteger(2 * c.m)) continue
    for (let j = 0; j < 8; j++) {
      if (j === i || !samePt(eighthPoint(plane, c, r, j), q)) continue
      out.push({ plane, c, r, k0: i, n: mod8(j - i) }, { plane, c, r, k0: j, n: mod8(i - j) })
    }
  }
  return out.sort((a, b) => a.n - b.n || arcMid(a)[1] - arcMid(b)[1] || PLANES.indexOf(a.plane) - PLANES.indexOf(b.plane))
}

export function arcSnapPoints(keys: ArcKey[]): Pt[] {
  const m = new Map<string, Pt>()
  for (const k of keys) for (const p of pieceEnds(k)) m.set(ptKey(p), p)
  return [...m.values()]
}
