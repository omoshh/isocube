import { proj, segKey, type SegKey } from './geometry'
import type { HeightMap } from './shape'
import type { Bounds } from './drawing'

export type Light = 'down' | 'front' | 'side' | 'slant'

// Walls sit just behind / beside the bounding box: back wall at y = rows, side wall at x = cols.
// Cell keys: down "x,y" (floor square); front "x,z" (back wall); side "y,z" (side wall);
// slant "x,y,h" (floor half-cell; h=0 lower triangle (x,y)(x+1,y)(x+1,y+1), h=1 upper (x,y)(x,y+1)(x+1,y+1)).
export const wallPos = (h: HeightMap, light: Light): number => light === 'front' ? h.rows : light === 'side' ? h.cols : 0

export function shadowCells(h: HeightMap, light: Light): Set<string> {
  const out = new Set<string>()
  for (const [x, y, z] of h.cubes()) {
    if (light === 'down') out.add(`${x},${y}`)
    else if (light === 'front') out.add(`${x},${z}`)
    else if (light === 'side') out.add(`${y},${z}`)
    else {
      const a = x + z, b = y + z // base cell of the sheared cube; the shadow is a hexagon
      for (const k of [`${a},${b},0`, `${a},${b},1`, `${a + 1},${b + 1},0`, `${a + 1},${b + 1},1`, `${a + 1},${b},1`, `${a},${b + 1},0`]) out.add(k)
    }
  }
  return out
}

type P3 = [number, number, number]
function polygon(key: string, light: Light, w: number): P3[] {
  const [a, b, hh] = key.split(',').map(Number)
  if (light === 'down') return [[a, b, 0], [a + 1, b, 0], [a + 1, b + 1, 0], [a, b + 1, 0]]
  if (light === 'front') return [[a, w, b], [a + 1, w, b], [a + 1, w, b + 1], [a, w, b + 1]]
  if (light === 'side') return [[w, a, b], [w, a + 1, b], [w, a + 1, b + 1], [w, a, b + 1]]
  return hh === 0 ? [[a, b, 0], [a + 1, b, 0], [a + 1, b + 1, 0]] : [[a, b, 0], [a, b + 1, 0], [a + 1, b + 1, 0]]
}

/** `wall` is the wall plane coordinate (see wallPos); unused for floor lights. */
export function shadowOutline(cells: Set<string>, light: Light, wall = 0): Set<SegKey> {
  const out = new Set<SegKey>()
  for (const c of cells) {
    const p = polygon(c, light, wall)
    p.forEach((u, i) => {
      const v = p[(i + 1) % p.length], k = segKey(proj(...u), proj(...v))
      if (!out.delete(k)) out.add(k) // an edge shared by two shadow cells cancels
    })
  }
  return out
}

/** Drawable area of the floor or wall: the plane's corners in (t, v) with v = m + t/2. Slant floor extends by the max height. */
export function shadowPlaneBounds(h: HeightMap, light: Light): Bounds {
  const H = Math.max(0, ...h.h), w = wallPos(h, light)
  const corners: P3[] = light === 'down' ? [[0, 0, 0], [h.cols, 0, 0], [h.cols, h.rows, 0], [0, h.rows, 0]]
    : light === 'slant' ? [[0, 0, 0], [h.cols + H, 0, 0], [h.cols + H, h.rows + H, 0], [0, h.rows + H, 0]]
    : light === 'front' ? [[0, w, 0], [h.cols, w, 0], [h.cols, w, H], [0, w, H]]
    : [[w, 0, 0], [w, h.rows, 0], [w, h.rows, H], [w, 0, H]]
  const ts = corners.map(c => proj(...c)), vs = ts.map(p => p.m + p.t / 2), t = ts.map(p => p.t)
  return { t0: Math.min(...t), t1: Math.max(...t), v0: Math.min(...vs), v1: Math.max(...vs) }
}
