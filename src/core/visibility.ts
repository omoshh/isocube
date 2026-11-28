import { HeightMap, visibleFaces } from './shape'
import { exactViews } from './exactViews'
import { shapeEdges } from './sketch'
import { rotateShape, type Shape } from './solid'

/** The figure seen from the opposite corner (back-right): cell (c, r) gets the height of (cols-1-c, rows-1-r). */
export const rotate180 = (hm: HeightMap): HeightMap => new HeightMap(hm.cols, hm.rows, [...hm.h].reverse())

/** Cubes [x, y, z] that a view shows: the top of a column, or the nearest at its height from the front or from the left. */
export function neededCubes(hm: HeightMap): [number, number, number][] {
  const H = (x: number, y: number) => hm.at(x, hm.rows - 1 - y)
  return hm.cubes().filter(([x, y, z]) => {
    if (z === H(x, y) - 1) return true
    let front = true, side = true
    for (let yy = 0; yy < y; yy++) if (H(x, yy) > z) front = false
    for (let xx = 0; xx < x; xx++) if (H(xx, y) > z) side = false
    return front || side
  })
}

/** Every needed cube shows a face in the front picture or in the back picture (round 3 rule). */
export function fairPicture(hm: HeightMap): boolean {
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`
  const seen = new Set([...visibleFaces(hm).values()].map(f => key(f.x, f.y, f.z)))
  for (const f of visibleFaces(rotate180(hm)).values()) seen.add(key(hm.cols - 1 - f.x, hm.rows - 1 - f.y, f.z))
  return neededCubes(hm).every(([x, y, z]) => seen.has(key(x, y, z)))
}

/** Round 4: every ramp and every needed cube shows in the front or the back picture; no line of the front picture
 *  or of a view ends between lattice points. */
export function fairShape(s: Shape, maxH: number): boolean {
  const { cols, rows } = s.hm, front = shapeEdges(s)
  if (front.partial || exactViews(s, maxH).partial) return false
  const seen = new Set(front.owners)
  for (const o of shapeEdges(rotateShape(s)).owners) {
    if (o.startsWith('r:')) { seen.add(o); continue }
    const [x, y, z] = o.slice(2).split(',').map(Number)
    seen.add(`c:${cols - 1 - x},${rows - 1 - y},${z}`)
  }
  return s.ramps.every((_, i) => seen.has('r:' + i)) && neededCubes(s.hm).every(([x, y, z]) => seen.has(`c:${x},${y},${z}`))
}
