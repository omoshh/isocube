// Piece types: what a shape is built from (round 4: a cube and a ramp; curved pieces plug in here later).
import { FRONT, SIDE, TOP, axisPlane, rampCells, slopePlane, type Dir, type P3 } from './solid'

/** A placed piece: (x, y) its first cell (a ramp's low-end cell), z its base; `len` and `dir` mean nothing for a cube. */
export type Placed = { x: number; y: number; z: number; len: 1 | 2 | 3; dir: Dir }
/** A face of a piece with its outward normal. */
export type PieceFace = { pts: P3[]; plane: string; n: P3 }
export type AxisView = 'top' | 'front' | 'side'
/**
 * A piece's outline in one view, in view-plane coordinates: top (x, y), front (x, z), side (y, z).
 * A segment runs between lattice points with slope 0, ∞, ±1, ±½ or ±⅓ (its crossings then stay on the 1/60 grid).
 */
export type Curve = { kind: 'segment'; a: [number, number]; b: [number, number] }
  // shortcut: arcs (cylinders, roofs, quarter-rounds) arrive in phase 3; the kind is reserved, exactView throws on it
  | { kind: 'arc'; centre: [number, number]; r: number; from: number; to: number }

export type PieceType = {
  name: string
  /** The cells (x, y) the piece stands on; the piece fills heights z … z + 1 above each. */
  cells(p: Placed): [number, number][]
  /** Its faces that can face a viewer above, in front or at the side, with outward normals; the caller culls covered ones. */
  faces(p: Placed): PieceFace[]
  /**
   * The outline of its faces that face viewer `v`, minus faces a neighbour covers (`at` tells what fills a unit cube
   * of space), relative to the piece's (x, y, z) in view-plane coordinates. These are the sketch's edges: the lines of
   * the view can only lie on them. The caller must not change the array (piece types share them); `p` is read only
   * during the call.
   */
  outline(p: Placed, v: AxisView, at: (x: number, y: number, z: number) => PieceType | undefined): readonly Curve[]
  /**
   * The plane key of the face seen at one point of cell `i` of the piece, or null when the piece does not cover it there.
   * (u, w) is the point inside the cell scaled by S (0 … S): top (x, y), front (x, z), side (y, z), from the cell's low
   * corner. Points that another cell of the same piece always hides in front may report any plane of the piece.
   */
  section(p: Placed, i: number, v: AxisView, u: number, w: number, S: number): string | null
}

const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const mean = (ps: P3[]): P3 => [0, 1, 2].map(k => ps.reduce((s, p) => s + p[k], 0) / ps.length) as P3

// plane keys are looked up for every sampled point, so they are built once
const keys: Record<'top' | 'front' | 'side', string[]> = { top: [], front: [], side: [] }
const key = (prefix: 'top' | 'front' | 'side', n: number) => (keys[prefix][n + 8] ??= prefix + n)
const slopeKeys = new Map<number, string>()
const slopeKey = (r: Placed) => {
  const code = (((('EWNS'.indexOf(r.dir) * 4 + r.len) * 64 + r.x) * 64 + r.y) * 64) + r.z
  let k = slopeKeys.get(code)
  if (k === undefined) slopeKeys.set(code, (k = slopePlane(r, r.z)))
  return k
}
const STEP: Record<Dir, [number, number]> = { E: [1, 0], W: [-1, 0], N: [0, 1], S: [0, -1] }

const seg = (a: [number, number], b: [number, number]): Curve => ({ kind: 'segment', a, b })
const SQUARE: readonly Curve[] = [seg([0, 0], [1, 0]), seg([1, 0], [1, 1]), seg([1, 1], [0, 1]), seg([0, 1], [0, 0])], NONE: readonly Curve[] = []
/** View-plane coordinates of a 3D point. */
const plane2 = (v: AxisView, p: P3): [number, number] => (v === 'top' ? [p[0], p[1]] : v === 'front' ? [p[0], p[2]] : [p[1], p[2]])
// a function: solid.ts imports this file, so solid's constants exist only once calls start
const VIEW_DIR = () => ({ top: TOP, front: FRONT, side: SIDE })

export const CUBE: PieceType = {
  name: 'cube',
  cells: p => [[p.x, p.y]],
  faces: ({ x, y, z }) => [
    { n: [0, 0, 1], pts: [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]] },
    { n: [0, -1, 0], pts: [[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]] },
    { n: [-1, 0, 0], pts: [[x, y, z], [x, y + 1, z], [x, y + 1, z + 1], [x, y, z + 1]] },
  ].map(f => ({ ...f, n: f.n as P3, pts: f.pts as P3[], plane: axisPlane(f.n as P3, f.pts[0] as P3) })),
  // as shapeFaces: a top face is covered by anything above it, a front or side face only by a cube
  outline: ({ x, y, z }, v, at) =>
    (v === 'top' ? !at(x, y, z + 1) : v === 'front' ? at(x, y - 1, z) !== CUBE : at(x - 1, y, z) !== CUBE) ? SQUARE : NONE,
  section: (p, _i, v) => (v === 'top' ? key('top', p.z + 1) : v === 'front' ? key('front', p.y) : key('side', p.x)),
}

// a ramp's outline at the origin, per direction, length and view (its faces are not covered by anything)
const rampOutlines: Curve[][] = []

export const RAMP: PieceType = {
  name: 'ramp',
  cells: p => rampCells(p),
  faces(r) {
    // (a, w, z): a = distance up the slope from the low edge, w = across it
    const L = r.len, b = r.z
    const at = ([a, w, z]: P3): P3 => r.dir === 'E' ? [r.x + a, r.y + w, z] : r.dir === 'W' ? [r.x + 1 - a, r.y + w, z]
      : r.dir === 'N' ? [r.x + w, r.y + a, z] : [r.x + w, r.y + 1 - a, z]
    const centre = at([L * 2 / 3, 0.5, b + 1 / 3])
    const raw: [P3[], string | null][] = [
      [[[0, 0, b], [0, 1, b], [L, 1, b + 1], [L, 0, b + 1]], slopePlane(r, b)],
      [[[0, 0, b], [L, 0, b], [L, 0, b + 1]], null],
      [[[0, 1, b], [L, 1, b], [L, 1, b + 1]], null],
      [[[L, 0, b], [L, 1, b], [L, 1, b + 1], [L, 0, b + 1]], null],
    ]
    return raw.map(([q, plane]) => {
      const pts = q.map(at)
      let n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))
      if (dot(n, sub(mean(pts), centre)) < 0) n = [-n[0], -n[1], -n[2]]
      return { pts, n, plane: plane ?? axisPlane(n, pts[0]) }
    })
  },
  outline(r, v) {
    const k = ('EWNS'.indexOf(r.dir) * 4 + r.len) * 3 + (v === 'top' ? 0 : v === 'front' ? 1 : 2)
    let segs = rampOutlines[k]
    if (!segs) {
      segs = []
      for (const f of RAMP.faces({ x: 0, y: 0, z: 0, len: r.len, dir: r.dir })) {
        const n = f.n, d = VIEW_DIR()[v]
        if (n[0] * d[0] + n[1] * d[1] + n[2] * d[2] <= 0) continue
        for (let j = 0; j < f.pts.length; j++) {
          const a = plane2(v, f.pts[j]), b = plane2(v, f.pts[(j + 1) % f.pts.length])
          if (a[0] !== b[0] || a[1] !== b[1]) segs.push(seg(a, b))
        }
      }
      rampOutlines[k] = segs
    }
    return segs
  },
  section(r, i, v, u, w, S) {
    if (v === 'top') return slopeKey(r)
    const c = r.x + STEP[r.dir][0] * i, d = r.y + STEP[r.dir][1] * i, L = r.len, along = r.dir === 'E' || r.dir === 'W'
    const facing = v === 'front' ? !along : along // the slope runs in depth: seen as the slope or as the high end
    if (facing) {
      if (w * L > (i + 1) * S) return null
      const up = r.dir === 'N' || r.dir === 'E' // rising away from the viewer: the slope shows
      return up ? slopeKey(r) : v === 'front' ? key('front', d) : key('side', c)
    }
    // the slope runs across the view: the side triangle, height a / L at distance a up the slope
    const a = r.dir === 'E' || r.dir === 'N' ? i * S + u : (i + 1) * S - u
    return w * L <= a ? (v === 'front' ? key('front', r.y) : key('side', r.x)) : null
  },
}

export const PIECES: PieceType[] = [CUBE, RAMP]

/**
 * Where lattice piece (px, py) + t·(dx, dy) crosses segment (ex, ey) + s·(fx, fy) inside the piece, as 60·t, or −1.
 * Whole numbers in, whole number out: segments of the allowed slopes cross on the 1/60 grid (checked).
 */
export function segmentCrossing(px: number, py: number, dx: number, dy: number, ex: number, ey: number, fx: number, fy: number): number {
  const den = dx * fy - dy * fx
  if (!den) return -1 // parallel: a collinear segment ends on lattice points, never inside a piece
  const qx = ex - px, qy = ey - py, nt = qx * fy - qy * fx, ns = qx * dy - qy * dx
  if (den > 0 ? nt <= 0 || nt >= den || ns < 0 || ns > den : nt >= 0 || nt <= den || ns > 0 || ns < den) return -1
  if ((60 * nt) % den) throw new Error('segmentCrossing: a crossing off the 1/60 grid (a slope beyond ±⅓?)')
  return (60 * nt) / den
}
