// Top, front and side views of shapes with ramps, in the screen coordinates `viewLines` uses
// (top: (x, rows − y); front: (x, Z − z); side: (rows − y, Z − z)). Cube-only shapes give exactly `views(hm)`.
import type { P2 } from './areas'
import { sketch, type Sketch } from './sketch'
import { FRONT, SIDE, TOP, shapeFaces, type P3, type Shape } from './solid'
import type { ViewSet } from './views'

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a))
const pk = (p: P2) => p[0] + 0 + ':' + (p[1] + 0)

/** A view segment between integer points, split at every integer point on it; keys like `gridSegKey`. */
export function viewKey(a: P2, b: P2): string[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], g = gcd(dx, dy), out: string[] = []
  for (let i = 0; i < g; i++) {
    const p: P2 = [a[0] + dx / g * i, a[1] + dy / g * i], q: P2 = [a[0] + dx / g * (i + 1), a[1] + dy / g * (i + 1)]
    const A = pk(p), B = pk(q)
    out.push(A < B ? A + '|' + B : B + '|' + A)
  }
  return out
}

type Proj = { to2: (p: P3) => P2; lift: (q: P2) => P3; D: P3; view: P3 }
function projs(s: Shape, Z: number): Record<keyof ViewSet, Proj> {
  const R = s.hm.rows
  return {
    top: { to2: ([x, y]) => [x, R - y], lift: ([a, b]) => [a, R - b, 0], D: [0, 0, -1], view: TOP },
    front: { to2: ([x, , z]) => [x, Z - z], lift: ([a, b]) => [a, 0, Z - b], D: [0, 1, 0], view: FRONT },
    side: { to2: ([, y, z]) => [R - y, Z - z], lift: ([a, b]) => [0, R - a, Z - b], D: [1, 0, 0], view: SIDE },
  }
}

export type ShapeViews = ViewSet & { partial: boolean; covered: Record<keyof ViewSet, Map<string, boolean>> }

/** One view's sketch; line keys of pieces seen only in part get `#p`. */
export function viewSketch(s: Shape, Z: number, v: keyof ViewSet): Sketch & { keys: Set<string> } {
  const p = projs(s, Z)[v], k = sketch(shapeFaces(s, p.view), p.to2, p.lift, p.D, viewKey)
  return { ...k, keys: new Set([...k.lines].map(x => (k.partials.has(x) ? x + '#p' : x))) }
}

/** The 3 views; a piece seen only in part is keyed `<piece>#p`. */
export function shapeViews(s: Shape, Z: number): ShapeViews {
  const out = { partial: false, covered: {} } as ShapeViews
  for (const v of ['top', 'front', 'side'] as const) {
    const k = viewSketch(s, Z, v)
    out[v] = k.keys
    out.covered[v] = k.covered
    if (k.partial) out.partial = true
  }
  return out
}

/** Each view's visible-side faces as 2D polygons (the grey fill of the views panel). */
export function viewFills(s: Shape, Z: number): Record<keyof ViewSet, P2[][]> {
  const ps = projs(s, Z)
  const f = (v: keyof ViewSet) => shapeFaces(s, ps[v].view).map(face => face.pts.map(ps[v].to2))
  return { top: f('top'), front: f('front'), side: f('side') }
}
