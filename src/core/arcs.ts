// Arcs of circles (radius ½ to 3) in the 3 face planes, kept exact: every end is an eighth point (k·45°).
import { parsePt, ptKey, samePt, toUV, type Line, type Pt } from './geometry'

/** The plane's normal: z = top, y = front (xz), x = side (yz). */
export type Plane = 'x' | 'y' | 'z'
export type Radius = 0.5 | 1 | 1.5 | 2 | 2.5 | 3
/** Starts at eighth k0 (0–7) and runs n eighths (1–8) counter-clockwise in the plane basis. */
export type Arc = { plane: Plane; c: Pt; r: Radius; k0: number; n: number }
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

export function eighthPoint(plane: Plane, c: Pt, r: Radius, k: number): Pt {
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
  return { plane: p.slice(1) as Plane, c: parsePt(c), r: Number(r) as Radius, k: Number(e) }
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
export function arcsThrough(p: Pt, q: Pt, radii: readonly Radius[] = [1, 0.5]): Arc[] {
  const out: Arc[] = []
  for (const plane of PLANES) for (const r of radii) for (let i = 0; i < 8; i++) {
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

export type Circle = { plane: Plane; c: Pt; r: Radius }
/** The plane's normal on the lattice: a cylinder grows this way. */
export const NORMAL: Record<Plane, Pt> = { z: Z, y: Y, x: X }

export function circlesOf(keys: ArcKey[]): Circle[] {
  const m = new Map<string, Circle>()
  for (const k of keys) { const a = parse(k); m.set(`${a.plane}|${ptKey(a.c)}|${a.r}`, { plane: a.plane, c: a.c, r: a.r }) }
  return [...m.values()]
}

/** The circle's drawn pieces moved n cells along its normal, plus the 2 side lines at the silhouette where the arcs reach. */
export function extrude(keys: ArcKey[], ci: Circle, n: number): { arcs: ArcKey[]; lines: Line[] } {
  const N = NORMAL[ci.plane], move = (p: Pt): Pt => ({ ...p, t: p.t + n * N.t + 0, m: p.m + n * N.m + 0 })
  const mine = keys.filter(k => { const a = parse(k); return a.plane === ci.plane && a.r === ci.r && samePt(a.c, ci.c) })
  const c2 = ptKey(move(ci.c))
  const arcs = mine.map(k => { const a = parse(k); return `A${a.plane}|${c2}|${a.r}|${a.k}` })
  // silhouette: the eighths farthest to each side of the normal's screen direction
  const d = toUV(N), side = (k: number) => { const [u, v] = toUV(eighthPoint(ci.plane, { t: 0, m: 0 }, ci.r, k)); return d[0] * v - d[1] * u }
  const ks = [0, 1, 2, 3, 4, 5, 6, 7].sort((a, b) => side(a) - side(b))
  const ends = new Set(mine.flatMap(k => pieceEnds(k).map(ptKey)))
  const lines = [ks[0], ks[7]].map(k => eighthPoint(ci.plane, ci.c, ci.r, k)).filter(p => ends.has(ptKey(p))).map(a => ({ a, b: move(a) }))
  return { arcs, lines }
}
