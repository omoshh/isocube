import { proj, segTriangles, triAt, triEdges, type SegKey, type TriKey } from './geometry'

export class HeightMap {
  constructor(readonly cols: number, readonly rows: number, readonly h: number[]) {}
  at(c: number, r: number): number {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows ? this.h[r * this.cols + c] : 0
  }
  get cubeCount(): number { return this.h.reduce((a, b) => a + b, 0) }
  // cell (c, r) -> cube column x = c, y = rows - 1 - r (rows run back to front)
  cubes(): [number, number, number][] {
    const out: [number, number, number][] = []
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++)
      for (let z = 0; z < this.at(c, r); z++) out.push([c, this.rows - 1 - r, z])
    return out
  }
}

export type FaceDir = 'top' | 'front' | 'side'
export type Face = { x: number; y: number; z: number; dir: FaceDir }
export const facePlane = (f: Face): string =>
  f.dir === 'top' ? 'top' + (f.z + 1) : f.dir === 'front' ? 'front' + f.y : 'side' + f.x

type P3 = [number, number, number]
const quad = (f: Face): P3[] => {
  const { x, y, z } = f
  return f.dir === 'top' ? [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]
    : f.dir === 'front' ? [[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]]
    : [[x, y, z], [x, y + 1, z], [x, y + 1, z + 1], [x, y, z + 1]]
}

const S = Math.sqrt(3) / 2

export function visibleFaces(h: HeightMap): Map<TriKey, Face> {
  const filled = (x: number, y: number, z: number) => z >= 0 && z < h.at(x, h.rows - 1 - y)
  const best = new Map<TriKey, { f: Face; d: number }>()
  for (const [x, y, z] of h.cubes()) {
    const faces: Face[] = []
    if (!filled(x, y, z + 1)) faces.push({ x, y, z, dir: 'top' })
    if (!filled(x, y - 1, z)) faces.push({ x, y, z, dir: 'front' })
    if (!filled(x - 1, y, z)) faces.push({ x, y, z, dir: 'side' })
    for (const f of faces) {
      const q = quad(f), L = q.map(p => proj(...p))
      const dt = L[2].t - L[0].t, dm = L[2].m - L[0].m
      const unit = (dt === 0 && Math.abs(dm) === 1) || (dm === 0 && Math.abs(dt) === 1) || (dt !== 0 && dm === -dt && Math.abs(dt) === 1)
      for (const tr of unit ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]]) {
        const c = [0, 1, 2].map(k => tr.reduce((s, j) => s + q[j][k], 0) / 3)
        const p = proj(c[0], c[1], c[2])
        const key = triAt(p.t * S, p.m + p.t / 2), d = c[0] + c[1] - c[2] // smaller = nearer the viewer
        const cur = best.get(key)
        if (!cur || d < cur.d) best.set(key, { f, d })
      }
    }
  }
  return new Map([...best].map(([k, v]) => [k, v.f]))
}

export type EdgeSet = { shape: Set<SegKey>; seams: Set<SegKey> }

export function computeEdges(h: HeightMap): EdgeSet {
  const vis = visibleFaces(h), shape = new Set<SegKey>(), seams = new Set<SegKey>(), seen = new Set<SegKey>()
  for (const t of vis.keys()) for (const s of triEdges(t)) {
    if (seen.has(s)) continue
    seen.add(s)
    const [f1, f2] = segTriangles(s).map(k => vis.get(k))
    if (f1 === f2) continue
    if (!f1 || !f2 || facePlane(f1) !== facePlane(f2)) shape.add(s)
    else seams.add(s)
  }
  return { shape, seams }
}
