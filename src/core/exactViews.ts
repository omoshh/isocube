// The top, front and side views of a shape worked out exactly (whole numbers only), the same keys as `shapeViews`.
// In an axis view each point shows the first cell in depth order whose piece covers it there; the piece type names
// the face. Edges of cubes and ramps end on lattice points with slopes 0, ∞, ±1, ±½, ±⅓, so along a lattice piece every
// crossing with another edge sits at a multiple of 1/60: each piece is judged once per stretch between crossings.
import { PIECES, type AxisView, type PieceFace, type Placed, type PieceType } from './pieces'
import { viewKey } from './shapeViews'
import { FRONT, SIDE, TOP, baseZ, type Dir, type P3, type Shape } from './solid'
import type { ViewSet } from './views'

// Points are kept ×S. Crossings lie on the 1/60 grid and stretch midpoints on 1/120; a point one unit (≤ √10/S) off
// the piece is nearer to it than to any other edge line (those are ≥ 1/(120·√10) from a midpoint).
const S = 7200
const gcd = (a: number, b: number) => {
  a = Math.abs(a); b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}
const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
let unitCube: PieceFace[] | null = null
const cubeFaces = () => (unitCube ??= PIECES[0].faces({ x: 0, y: 0, z: 0, len: 1, dir: 'E' }))
const rampAt0 = new Map<string, PieceFace[]>()
const rampFaces = (dir: Dir, len: 1 | 2 | 3) => {
  let fs = rampAt0.get(dir + len)
  if (!fs) rampAt0.set(dir + len, (fs = PIECES[1].faces({ x: 0, y: 0, z: 0, len, dir })))
  return fs
}
// scratch space: crossings along one piece, and which pieces (code: lower end, direction) were seen in this view
const ts = new Int32Array(1024), stamp = new Int32Array(32 * 32 * 12)
let epoch = 0
const EDGES: number[] = [], SLOPED: number[] = [], PIECE_LIST: number[] = []
const keyOf: string[] = new Array(32 * 32 * 12).fill('')
const pieceKey = (code: number, px: number, py: number, dx: number, dy: number) =>
  keyOf[code] || (keyOf[code] = viewKey([px, py], [px + dx, py + dy])[0])
const DIR = { top: TOP, front: FRONT, side: SIDE }
type Occ = { t: PieceType; p: Placed; i: number; id: number }

/** One view, with `covered` as `viewSketch` gives it: per piece, whether both sides show a face all along it. */
export const exactView = (s: Shape, Z: number, v: AxisView) => view1(scene(s, Z), v, new Map<string, boolean>())

/** The 3 views; a piece seen only in part is keyed `<piece>#p` (as `shapeViews`). */
export function exactViews(s: Shape, Z: number): ViewSet & { partial: boolean } {
  const sc = scene(s, Z), t = view1(sc, 'top', null), f = view1(sc, 'front', null), d = view1(sc, 'side', null)
  return { top: t.keys, front: f.keys, side: d.keys, partial: t.partial || f.partial || d.partial }
}

/** The shape as cells: stack heights and, per cell, the piece that fills each unit of height. */
function scene(s: Shape, Z: number) {
  const { hm } = s, C = hm.cols, R = hm.rows, [cube, ramp] = PIECES
  if (Math.max(C, R, Z) >= 32) throw new Error('exactView: grids up to 31')
  const hs: number[] = []
  for (let x = 0; x < C; x++) for (let y = 0; y < R; y++) hs[x * R + y] = hm.at(x, R - 1 - y)
  if (Math.max(...hs) > Z || s.ramps.some(r => baseZ(s, r) >= Z)) throw new Error('exactView: the shape is taller than Z')
  const H = (x: number, y: number) => (x < 0 || y < 0 || x >= C || y >= R ? 0 : hs[x * R + y])
  const capOf: (Occ | undefined)[] = []
  s.ramps.forEach((r, k) => {
    const p: Placed = { ...r, z: baseZ(s, r) }
    ramp.cells(p).forEach(([x, y], i) => { capOf[x * R + y] = { t: ramp, p, i, id: -1 - k } })
  })
  const cubes: Occ[] = []
  const occ = (x: number, y: number, z: number): Occ | undefined => {
    const h = H(x, y), id = (x * R + y) * (Z + 1) + z
    if (z < h) return (cubes[id] ??= { t: cube, p: { x, y, z, len: 1, dir: 'E' }, i: 0, id })
    return z === h ? capOf[x * R + y] : undefined
  }
  return { s, Z, C, R, H, hs, capOf, occ }
}

function view1(sc: ReturnType<typeof scene>, v: AxisView, covered: Map<string, boolean> | null) {
  const { s, Z, C, R, H, hs, capOf, occ } = sc
  if (++epoch === 2 ** 31) { stamp.fill(0); epoch = 1 }
  let seenId = 0 // the piece of the last face `seen` found (a face = its piece and its plane)
  const look = (o: Occ | undefined, u: number, w: number): string | null => {
    const plane = o ? o.t.section(o.p, o.i, v, u, w, S) : null
    if (plane !== null) seenId = o!.id
    return plane
  }
  // screen point (×S) → the plane seen there; screen axes as in shapeViews: top (x, R − y), front (x, Z − z), side (R − y, Z − z)
  const seen = (U: number, V: number): string | null => {
    if (v === 'top') {
      const x = Math.floor(U / S), yw = R * S - V, y = Math.floor(yw / S)
      if (x < 0 || y < 0 || x >= C || y >= R) return null
      const h = H(x, y)
      return look(capOf[x * R + y] ?? (h ? occ(x, y, h - 1) : undefined), U - x * S, yw - y * S)
    }
    const zw = Z * S - V, z = Math.floor(zw / S), dw = zw - z * S
    if (z < 0) return null
    if (v === 'front') {
      const x = Math.floor(U / S)
      if (x < 0 || x >= C) return null
      for (let y = 0; y < R; y++) if (z <= hs[x * R + y]) { const k = look(occ(x, y, z), U - x * S, dw); if (k) return k }
    } else {
      const yw = R * S - U, y = Math.floor(yw / S)
      if (y < 0 || y >= R) return null
      for (let x = 0; x < C; x++) if (z <= hs[x * R + y]) { const k = look(occ(x, y, z), yw - y * S, dw); if (k) return k }
    }
    return null
  }

  // projected edges of every face facing the viewer, culled as `shapeFaces` does (the sketch's pieces)
  const view = DIR[v], edges = EDGES, sloped = SLOPED, pieces = PIECE_LIST
  let ne = 0, ns0 = 0, np = 0
  const addFace = (pts: P3[], dx: number, dy: number, dz: number) => {
    for (let j = 0; j < pts.length; j++) {
      const p = pts[j], q = pts[(j + 1) % pts.length]
      const ax = v === 'side' ? R - p[1] - dy : p[0] + dx, ay = v === 'top' ? R - p[1] - dy : Z - p[2] - dz
      const ex = (v === 'side' ? R - q[1] - dy : q[0] + dx) - ax, ey = (v === 'top' ? R - q[1] - dy : Z - q[2] - dz) - ay
      if (!ex && !ey) continue
      edges[ne++] = ax; edges[ne++] = ay; edges[ne++] = ex; edges[ne++] = ey
      if (ex && ey) { sloped[ns0++] = ax; sloped[ns0++] = ay; sloped[ns0++] = ex; sloped[ns0++] = ey }
      const g = !ex ? Math.abs(ey) : !ey ? Math.abs(ex) : gcd(ex, ey), ux = ex / g, uy = ey / g
      if (ux > 3 || ux < -3 || uy > 1 || uy < -1) throw new Error('exactView: an edge steeper than the piece codes allow')
      for (let i = 0; i < g; i++) {
        const px = ax + ux * i, py = ay + uy * i, qx = px + ux, qy = py + uy
        const lo = ux > 0 || (!ux && uy > 0), code = (((lo ? px : qx) * 32 + (lo ? py : qy)) * 4 + Math.abs(ux)) * 3 + (lo ? uy : -uy) + 1
        if (stamp[code] !== epoch) { stamp[code] = epoch; pieces[np++] = px; pieces[np++] = py; pieces[np++] = ux; pieces[np++] = uy; pieces[np++] = code }
      }
    }
  }
  const capped = (x: number, y: number) => capOf[x * R + y] !== undefined
  const filled = (x: number, y: number, z: number) => z >= 0 && z < H(x, y)
  for (const f of cubeFaces()) {
    if (dot(f.n, view) <= 0) continue
    for (let x = 0; x < C; x++) for (let y = 0; y < R; y++) for (let z = 0; z < H(x, y); z++) {
      const hidden = f.n[2] > 0 ? filled(x, y, z + 1) || (z === H(x, y) - 1 && capped(x, y)) : filled(x + f.n[0], y + f.n[1], z)
      if (!hidden) addFace(f.pts, x, y, z)
    }
  }
  for (const r of s.ramps) for (const f of rampFaces(r.dir, r.len)) if (dot(f.n, view) > 0) addFace(f.pts, r.x, r.y, baseZ(s, r))

  const lines: string[] = []
  let partial = false
  for (let n = 0; n < np; n += 5) {
    const px = pieces[n], py = pieces[n + 1], dx = pieces[n + 2], dy = pieces[n + 3]
    const es = dx && dy ? edges : sloped, nes = dx && dy ? ne : ns0
    let m = 0
    // an axis piece meets axis edges only at lattice points (its ends), so it needs only the sloped edges
    for (let e = 0; e < nes; e += 4) {
      const fx = es[e + 2], fy = es[e + 3], den = dx * fy - dy * fx
      if (!den) continue // parallel: a collinear edge ends on lattice points, never inside a piece
      const qx = es[e] - px, qy = es[e + 1] - py, nt = qx * fy - qy * fx, ns = qx * dy - qy * dx
      if (den > 0 ? nt <= 0 || nt >= den || ns < 0 || ns > den : nt >= 0 || nt <= den || ns > 0 || ns < den) continue
      if ((60 * nt) % den) throw new Error(`crossing off the 1/60 grid on ${pieceKey(pieces[n + 4], px, py, dx, dy)}`)
      if (m === ts.length - 2) throw new Error('exactView: too many crossings on one piece')
      ts[m++] = (60 * nt) / den
    }
    ts[m++] = 0
    ts[m++] = 60
    if (m > 2) ts.subarray(0, m).sort()
    let kinds = 0, both = true // kinds: 1 nothing, 2 seam, 4 line
    for (let j = 1; j < m; j++) {
      if (ts[j] === ts[j - 1]) continue
      const M = (ts[j - 1] + ts[j]) * 60, U = px * S + dx * M, V = py * S + dy * M // midpoint, ×S
      const L = seen(U - dy, V + dx), lid = seenId, Rt = seen(U + dy, V - dx)
      if (!L || !Rt) both = false
      kinds |= !L && !Rt ? 1 : !L || !Rt ? 4 : L !== Rt ? 4 : lid === seenId ? 1 : 2
    }
    covered?.set(pieceKey(pieces[n + 4], px, py, dx, dy), both)
    const mixed = (kinds & (kinds - 1)) !== 0
    if (mixed) partial = true
    if (kinds & 4) { const k = pieceKey(pieces[n + 4], px, py, dx, dy); lines.push(mixed ? k + '#p' : k) }
  }
  return { keys: new Set(lines), covered: covered!, partial }
}
