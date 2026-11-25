import { HeightMap, visibleFaces } from './shape'

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
