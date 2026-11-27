// Shapes made of cube stacks and ramps (round 4), as 3D faces for the general sketch.
import { CUBE, RAMP } from './pieces'
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

export const rampCells = (r: Ramp): [number, number][] => {
  const out: [number, number][] = [], [dx, dy] = STEP[r.dir]
  for (let i = 0; i < r.len; i++) out.push([r.x + dx * i + 0, r.y + dy * i + 0])
  return out
}

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

const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Plane key of an axis-aligned face from its outward normal; cube faces get the keys `facePlane` uses. */
export function axisPlane(n: P3, p: P3): string {
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

/** Every face that faces the viewer (`view` points towards the viewer). Cube faces covered by a cube or a ramp are left out. */
export function shapeFaces(s: Shape, view: P3): Face3[] {
  const { hm } = s, out: Face3[] = []
  const capped = new Set(s.ramps.flatMap(r => rampCells(r).map(([x, y]) => x + ',' + y)))
  const filled = (x: number, y: number, z: number) => z >= 0 && z < H(hm, x, y)
  for (const [x, y, z] of hm.cubes()) {
    const owner = `c:${x},${y},${z}`
    for (const f of CUBE.faces({ x, y, z, len: 1, dir: 'E' })) {
      const show = f.n[2] > 0 ? !filled(x, y, z + 1) && !(z === H(hm, x, y) - 1 && capped.has(x + ',' + y)) : !filled(x + f.n[0], y + f.n[1], z)
      if (show && dot(f.n, view) > 1e-9) out.push({ pts: f.pts, plane: f.plane, owner })
    }
  }
  s.ramps.forEach((r, i) => {
    for (const f of RAMP.faces({ ...r, z: baseZ(s, r) })) if (dot(f.n, view) > 1e-9) out.push({ pts: f.pts, plane: f.plane, owner: 'r:' + i })
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
