// Piece types: what a shape is built from (round 4: a cube and a ramp; curved pieces plug in here later).
import { axisPlane, rampCells, slopePlane, type Dir, type P3 } from './solid'

/** A placed piece: (x, y) its first cell (a ramp's low-end cell), z its base; `len` and `dir` mean nothing for a cube. */
export type Placed = { x: number; y: number; z: number; len: 1 | 2 | 3; dir: Dir }
/** A face of a piece with its outward normal. */
export type PieceFace = { pts: P3[]; plane: string; n: P3 }
export type AxisView = 'top' | 'front' | 'side'

export type PieceType = {
  name: string
  /** The cells (x, y) the piece stands on; the piece fills heights z … z + 1 above each. */
  cells(p: Placed): [number, number][]
  /** Its faces that can face a viewer above, in front or at the side, with outward normals; the caller culls covered ones. */
  faces(p: Placed): PieceFace[]
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

const cube: PieceType = {
  name: 'cube',
  cells: p => [[p.x, p.y]],
  faces: ({ x, y, z }) => [
    { n: [0, 0, 1], pts: [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]] },
    { n: [0, -1, 0], pts: [[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]] },
    { n: [-1, 0, 0], pts: [[x, y, z], [x, y + 1, z], [x, y + 1, z + 1], [x, y, z + 1]] },
  ].map(f => ({ ...f, n: f.n as P3, pts: f.pts as P3[], plane: axisPlane(f.n as P3, f.pts[0] as P3) })),
  section: (p, _i, v) => (v === 'top' ? key('top', p.z + 1) : v === 'front' ? key('front', p.y) : key('side', p.x)),
}

const ramp: PieceType = {
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

/** Index 0 is the cube, 1 the ramp. */
export const PIECES: PieceType[] = [cube, ramp]
