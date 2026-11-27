// General hidden-line drawing: which edges of a set of faces show, seen along one direction.
// Every projected face edge is split into lattice pieces; a piece is a line when the nearest faces just left and just
// right of it differ in plane (or one side shows nothing), a seam when they differ but share a plane.
import { inPoly, type P2 } from './areas'
import { linePieces, type SegKey } from './geometry'
import type { EdgeSet } from './shape'
import { ISO, shapeFaces, type Face3, type P3, type Shape } from './solid'

export type Sketch = { lines: Set<string>; seams: Set<string>; partial: boolean; owners: Set<string>; covered: Map<string, boolean> }

const FRACTIONS = [0.11, 0.29, 0.47, 0.63, 0.87] // avoid ½, ⅓, ¼: edges of other faces often cross there
const EPS = 1e-4
const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const ends = (k: string): [P2, P2] => k.split('|').map(p => p.split(':').map(Number)) as [P2, P2]

/**
 * @param to2  3D point → 2D picture point (the coordinates keys use)
 * @param lift 2D picture point → some 3D point that projects to it
 * @param D    view direction, away from the viewer (depth grows along it)
 * @param key  2D segment → its lattice piece keys
 */
export function sketch(faces: Face3[], to2: (p: P3) => P2, lift: (q: P2) => P3, D: P3, key: (a: P2, b: P2) => string[]): Sketch {
  const fs = faces.map(f => {
    const poly = f.pts.map(to2), n = cross(sub(f.pts[1], f.pts[0]), sub(f.pts[2], f.pts[0]))
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1])
    return { f, poly, n, nD: dot(n, D), box: [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] }
  }).filter(g => Math.abs(g.nD) > 1e-12)
  const nearest = (q: P2) => {
    let best: (typeof fs)[number] | null = null, bs = Infinity
    for (const g of fs) {
      if (q[0] < g.box[0] || q[0] > g.box[1] || q[1] < g.box[2] || q[1] > g.box[3] || !inPoly(g.poly, q)) continue
      const s = dot(g.n, sub(g.f.pts[0], lift(q))) / g.nD
      if (s < bs) { bs = s; best = g }
    }
    return best?.f ?? null
  }

  const pieces = new Set<string>()
  for (const { f } of fs) for (let i = 0; i < f.pts.length; i++) {
    const a = to2(f.pts[i]), b = to2(f.pts[(i + 1) % f.pts.length])
    if (a[0] !== b[0] || a[1] !== b[1]) for (const k of key(a, b)) pieces.add(k)
  }

  const lines = new Set<string>(), seams = new Set<string>(), owners = new Set<string>(), covered = new Map<string, boolean>()
  let partial = false
  for (const k of pieces) {
    const [a, b] = ends(k), d: P2 = [b[0] - a[0], b[1] - a[1]], len = Math.hypot(d[0], d[1])
    const o: P2 = [-d[1] / len * EPS, d[0] / len * EPS]
    const kinds = new Set<string>()
    let both = true
    for (const t of FRACTIONS) {
      const c: P2 = [a[0] + d[0] * t, a[1] + d[1] * t]
      const L = nearest([c[0] + o[0], c[1] + o[1]]), R = nearest([c[0] - o[0], c[1] - o[1]])
      if (L) owners.add(L.owner)
      if (R) owners.add(R.owner)
      if (!L || !R) both = false
      kinds.add(!L && !R ? '' : L === R ? '' : L && R && L.plane === R.plane ? 'seam' : 'line')
    }
    covered.set(k, both)
    if (kinds.size > 1) partial = true
    if (kinds.has('line')) lines.add(k)
    else if (kinds.has('seam')) seams.add(k)
  }
  return { lines, seams, partial, owners, covered }
}

/** The iso picture of a shape (front view of the round), with lattice keys like `computeEdges`. */
export function shapeEdges(s: Shape): EdgeSet & { partial: boolean; owners: Set<string> } {
  const k = sketch(shapeFaces(s, ISO), ([x, y, z]) => [x - y, y + z], ([t, m]) => [t, 0, m], [1, 1, -1],
    (a, b) => linePieces({ a: { t: a[0], m: a[1] }, b: { t: b[0], m: b[1] } }) as SegKey[])
  return { shape: k.lines, seams: k.seams, partial: k.partial, owners: k.owners }
}
