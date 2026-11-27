// Shapes made of cube stacks and ramps (round 4), as 3D faces for the general sketch.
import { HeightMap } from './shape'

export type Dir = 'N' | 'E' | 'S' | 'W'
/** (x, y) is the low-end cell (cube coordinates: x = column, y = rows − 1 − row); the ramp covers `len` cells in `dir`. */
export type Ramp = { x: number; y: number; len: 1 | 2 | 3; dir: Dir }
export type Shape = { hm: HeightMap; ramps: Ramp[] }
export type P3 = [number, number, number]
/** A visible-side face: its corners, a plane key (faces with the same key lie in one plane), and who it belongs to. */
export type Face3 = { pts: P3[]; plane: string; owner: string }

/** View directions (towards the viewer). */
export const ISO: P3 = [-1, -1, 1]
export const TOP: P3 = [0, 0, 1], FRONT: P3 = [0, -1, 0], SIDE: P3 = [-1, 0, 0]

const STEP: Record<Dir, [number, number]> = { E: [1, 0], W: [-1, 0], N: [0, 1], S: [0, -1] }
const FLIP: Record<Dir, Dir> = { E: 'W', W: 'E', N: 'S', S: 'N' }

export const rampCells = (r: Ramp): [number, number][] =>
  Array.from({ length: r.len }, (_, i) => [r.x + STEP[r.dir][0] * i + 0, r.y + STEP[r.dir][1] * i + 0])

const H = (hm: HeightMap, x: number, y: number) => hm.at(x, hm.rows - 1 - y)
export const baseZ = (s: Shape, r: Ramp) => H(s.hm, r.x, r.y)

export function validShape(s: Shape, maxH: number): boolean {
  const used = new Set<string>()
  for (const r of s.ramps) {
    const b = baseZ(s, r)
    if (b + 1 > maxH) return false
    for (const [x, y] of rampCells(r)) {
      if (x < 0 || y < 0 || x >= s.hm.cols || y >= s.hm.rows || H(s.hm, x, y) !== b || used.has(x + ',' + y)) return false
      used.add(x + ',' + y)
    }
  }
  return true
}

const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const mean = (ps: P3[]): P3 => [0, 1, 2].map(k => ps.reduce((s, p) => s + p[k], 0) / ps.length) as P3

/** Plane key of an axis-aligned face from its outward normal; cube faces get the keys `facePlane` uses. */
function axisPlane(n: P3, p: P3): string {
  if (n[2] > 0) return 'top' + p[2]
  if (n[2] < 0) return 'bottom' + p[2]
  if (n[1] < 0) return 'front' + p[1]
  if (n[1] > 0) return 'back' + p[1]
  return (n[0] < 0 ? 'side' : 'rside') + p[0]
}

/** Plane key of a ramp's slanted face, from the plane itself: z = b + (u − low)/len rising along +u (E, N) or
 *  z = b + (low − u)/len along −u (W, S); so ramps end to end on one slope share a key. */
export function slopePlane(r: Ramp, b: number): string {
  const low = r.dir === 'E' ? r.x : r.dir === 'W' ? r.x + 1 : r.dir === 'N' ? r.y : r.y + 1
  const up = r.dir === 'E' || r.dir === 'N'
  return `s:${r.dir === 'E' || r.dir === 'W' ? 'x' : 'y'}${up ? '+' : '-'}:${r.len}:${up ? b * r.len - low : b * r.len + low}`
}

function rampFaces(r: Ramp, i: number, b: number): { pts: P3[]; plane: string; owner: string; n: P3 }[] {
  // (a, w, z): a = distance up the slope from the low edge, w = across it
  const L = r.len
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
    return { pts, n, plane: plane ?? axisPlane(n, pts[0]), owner: 'r:' + i }
  })
}

/** Every face that faces the viewer (`view` points towards the viewer). Cube faces covered by a cube or a ramp are left out. */
export function shapeFaces(s: Shape, view: P3): Face3[] {
  const { hm } = s, out: Face3[] = []
  const capped = new Set(s.ramps.flatMap(r => rampCells(r).map(([x, y]) => x + ',' + y)))
  const filled = (x: number, y: number, z: number) => z >= 0 && z < H(hm, x, y)
  for (const [x, y, z] of hm.cubes()) {
    const owner = `c:${x},${y},${z}`
    const top = !filled(x, y, z + 1) && !(z === H(hm, x, y) - 1 && capped.has(x + ',' + y))
    const faces: [boolean, P3, P3[]][] = [
      [top, [0, 0, 1], [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]],
      [!filled(x, y - 1, z), [0, -1, 0], [[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]]],
      [!filled(x - 1, y, z), [-1, 0, 0], [[x, y, z], [x, y + 1, z], [x, y + 1, z + 1], [x, y, z + 1]]],
    ]
    for (const [show, n, pts] of faces) if (show && dot(n, view) > 1e-9) out.push({ pts, plane: axisPlane(n, pts[0]), owner })
  }
  s.ramps.forEach((r, i) => {
    for (const f of rampFaces(r, i, baseZ(s, r))) if (dot(f.n, view) > 1e-9) out.push({ pts: f.pts, plane: f.plane, owner: f.owner })
  })
  return out
}

/** The shape turned 180° about the vertical axis (the back picture). */
export function rotateShape(s: Shape): Shape {
  const { cols, rows } = s.hm
  return {
    hm: new HeightMap(cols, rows, [...s.hm.h].reverse()), // as rotate180 (kept here: visibility imports this file)
    ramps: s.ramps.map(r => ({ x: cols - 1 - r.x, y: rows - 1 - r.y, len: r.len, dir: FLIP[r.dir] })),
  }
}

export type EntryRamp = [number, number, 1 | 2 | 3, Dir]
export const toEntryRamps = (rs: Ramp[]): EntryRamp[] => rs.map(r => [r.x, r.y, r.len, r.dir])
export const fromEntryRamps = (es: EntryRamp[]): Ramp[] => es.map(([x, y, len, dir]) => ({ x, y, len, dir }))
