// The top, front and side views of a shape worked out exactly (whole numbers only), the same keys as `shapeViews`.
// In an axis view each point shows the first cell in depth order whose piece covers it there; the piece type names
// the face. Edges of cubes and ramps end on lattice points with slopes 0, ∞, ±1, ±½, ±⅓, so along a lattice piece every
// crossing with another edge sits at a multiple of 1/60: each piece is judged once per stretch between crossings.
import { CUBE, RAMP, segmentCrossing, type AxisView, type Curve, type Placed, type PieceType } from './pieces'
import { viewKey } from './shapeViews'
import { baseZ, type Shape } from './solid'
import type { ViewSet } from './views'

// Points are kept ×S. Crossings lie on the 1/60 grid and stretch midpoints on 1/120; a point one unit (≤ √10/S) off
// the piece is nearer to it than to any other edge line (those are ≥ 1/(120·√10) from a midpoint).
const S = 7200
const gcd = (a: number, b: number) => {
  a = Math.abs(a); b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}
// scratch space: crossings along one piece, and which pieces (code: lower end, direction) were seen in this view
const ts = new Int32Array(1024), stamp = new Int32Array(32 * 32 * 12)
let epoch = 0
/**
 * An outline in screen orientation relative to its piece: edges (x, y, dx, dy) and lattice pieces
 * (x, y, dx, dy, lower end x, y, direction code). Cached per outline array and view: placing it is then only an offset.
 */
type Rel = { edges: number[]; pieces: number[] }
const REL: Record<AxisView, WeakMap<readonly Curve[], Rel>> = { top: new WeakMap(), front: new WeakMap(), side: new WeakMap() }
function relOutline(cs: readonly Curve[], v: AxisView): Rel {
  const out: Rel = { edges: [], pieces: [] }, su = v === 'side' ? -1 : 1
  for (const c of cs) {
    if (c.kind !== 'segment') throw new Error('arc: phase 3')
    const ax = su * c.a[0], ay = -c.a[1], ex = su * c.b[0] - ax, ey = -c.b[1] - ay
    if (!ex && !ey) continue
    out.edges.push(ax, ay, ex, ey)
    const g = !ex ? Math.abs(ey) : !ey ? Math.abs(ex) : gcd(ex, ey), ux = ex / g, uy = ey / g
    if (ux > 3 || ux < -3 || uy > 1 || uy < -1) throw new Error('exactView: a segment steeper than the allowed slopes')
    const lo = ux > 0 || (!ux && uy > 0) // pieces are coded by their lower end and a direction pointing up
    for (let i = 0; i < g; i++) {
      const px = ax + ux * i, py = ay + uy * i
      out.pieces.push(px, py, ux, uy, lo ? px : px + ux, lo ? py : py + uy, Math.abs(ux) * 3 + (lo ? uy : -uy) + 1)
    }
  }
  return out
}
const CUBE_AT: Placed = { x: 0, y: 0, z: 0, len: 1, dir: 'E' }
const EDGES: number[] = [], SLOPED: number[] = [], PIECE_LIST: number[] = []
const keyOf: string[] = new Array(32 * 32 * 12).fill('')
const pieceKey = (code: number, px: number, py: number, dx: number, dy: number) =>
  keyOf[code] || (keyOf[code] = viewKey([px, py], [px + dx, py + dy])[0])
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
  const { hm } = s, C = hm.cols, R = hm.rows
  if (Math.max(C, R, Z) >= 32) throw new Error('exactView: grids up to 31')
  const hs: number[] = []
  for (let x = 0; x < C; x++) for (let y = 0; y < R; y++) hs[x * R + y] = hm.at(x, R - 1 - y)
  if (Math.max(...hs) > Z || s.ramps.some(r => baseZ(s, r) >= Z)) throw new Error('exactView: the shape is taller than Z')
  const H = (x: number, y: number) => (x < 0 || y < 0 || x >= C || y >= R ? 0 : hs[x * R + y])
  const capOf: (Occ | undefined)[] = []
  const ramps: Occ[] = []
  s.ramps.forEach((r, k) => {
    const p: Placed = { ...r, z: baseZ(s, r) }
    ramps.push({ t: RAMP, p, i: 0, id: -1 - k })
    RAMP.cells(p).forEach(([x, y], i) => { capOf[x * R + y] = { t: RAMP, p, i, id: -1 - k } })
  })
  const cubes: Occ[] = []
  const occ = (x: number, y: number, z: number): Occ | undefined => {
    const h = H(x, y), id = (x * R + y) * (Z + 1) + z
    if (z < h) return (cubes[id] ??= { t: CUBE, p: { x, y, z, len: 1, dir: 'E' }, i: 0, id })
    return z === h ? capOf[x * R + y] : undefined
  }
  // what fills unit cube (x, y, z) of space
  const at = (x: number, y: number, z: number): PieceType | undefined => {
    if (x < 0 || y < 0 || x >= C || y >= R || z < 0) return undefined
    const c = x * R + y, h = hs[c]
    return z < h ? CUBE : z === h ? capOf[c]?.t : undefined
  }
  return { Z, C, R, H, hs, capOf, occ, at, ramps }
}

function view1(sc: ReturnType<typeof scene>, v: AxisView, covered: Map<string, boolean> | null) {
  const { Z, C, R, H, hs, capOf, occ, at, ramps } = sc
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

  // every piece's outline (the sketch's edges), in screen coordinates, split into lattice pieces
  const edges = EDGES, sloped = SLOPED, pieces = PIECE_LIST, rels = REL[v]
  let ne = 0, ns0 = 0, np = 0, lastCs: readonly Curve[] | null = null, lastRel: Rel | undefined
  const outline = (t: PieceType, p: Placed) => {
    const cs = t.outline(p, v, at)
    if (!cs.length) return
    let r = cs === lastCs ? lastRel : rels.get(cs) // most calls repeat the last outline (a cube's square)
    if (!r) rels.set(cs, (r = relOutline(cs, v)))
    lastCs = cs; lastRel = r
    // screen = (±u, −w) of the outline + the piece's place: top (x, R − y), front (x, Z − z), side (R − y, Z − z)
    const bx = v === 'side' ? R - p.y : p.x, by = v === 'top' ? R - p.y : Z - p.z
    const re = r.edges, rp = r.pieces
    for (let e = 0; e < re.length; e += 4) {
      const ax = re[e] + bx, ay = re[e + 1] + by, ex = re[e + 2], ey = re[e + 3]
      edges[ne++] = ax; edges[ne++] = ay; edges[ne++] = ex; edges[ne++] = ey
      if (ex && ey) { sloped[ns0++] = ax; sloped[ns0++] = ay; sloped[ns0++] = ex; sloped[ns0++] = ey }
    }
    for (let e = 0; e < rp.length; e += 7) {
      const code = ((rp[e + 4] + bx) * 32 + rp[e + 5] + by) * 12 + rp[e + 6]
      if (stamp[code] !== epoch) { stamp[code] = epoch; pieces[np++] = rp[e] + bx; pieces[np++] = rp[e + 1] + by; pieces[np++] = rp[e + 2]; pieces[np++] = rp[e + 3]; pieces[np++] = code }
    }
  }
  const unit = CUBE_AT // one scratch cube, moved through the stacks
  for (let x = 0; x < C; x++) for (let y = 0; y < R; y++) for (let z = 0; z < H(x, y); z++) { unit.x = x; unit.y = y; unit.z = z; outline(CUBE, unit) }
  for (const o of ramps) outline(o.t, o.p)

  const keys = new Set<string>()
  let partial = false
  for (let n = 0; n < np; n += 5) {
    const px = pieces[n], py = pieces[n + 1], dx = pieces[n + 2], dy = pieces[n + 3]
    const es = dx && dy ? edges : sloped, nes = dx && dy ? ne : ns0
    let m = 0
    // an axis piece meets axis edges only at lattice points (its ends), so it needs only the sloped edges
    for (let e = 0; e < nes; e += 4) {
      const T = segmentCrossing(px, py, dx, dy, es[e], es[e + 1], es[e + 2], es[e + 3])
      if (T < 0) continue
      if (m === ts.length - 2) throw new Error('exactView: too many crossings on one piece')
      ts[m++] = T
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
    if (kinds & 4) { const k = pieceKey(pieces[n + 4], px, py, dx, dy); keys.add(mixed ? k + '#p' : k) }
  }
  return { keys, covered: covered!, partial }
}
