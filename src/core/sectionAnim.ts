import { cut, planeThrough } from './sections'
import type { SectionPuzzle } from './sectionPuzzle'
import type { V3 } from './solids'

// proj(x,y,z) = (x - y, y + z) drops d = (1,1,-1) to a point. Viewer sits on the other side (the top
// face is seen, +x/+y recede), so the direction toward the viewer is -d, normalised.
const S = Math.sqrt(3)
const VIEW: V3 = [-1 / S, -1 / S, 1 / S]

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

export type SectionFrame = { planeOffset: number; cutVisible: boolean; cutPoly3d: V3[] }

export class SectionAnimation {
  private readonly poly: V3[]
  private readonly centroid: V3
  private readonly start: number
  private readonly axis: V3
  private readonly angle: number

  constructor(p: SectionPuzzle) {
    const pl = planeThrough(...p.points)!
    this.poly = cut(p.solid, pl)!
    this.centroid = [0, 1, 2].map((k) => this.poly.reduce((t, q) => t + q[k], 0) / this.poly.length) as V3
    // planeOffset: signed distance along n from the cut plane; t = 0 puts the plane 1 below the whole solid
    const lo = Math.min(...p.solid.vertices.map((v) => dot(pl.n, v)))
    this.start = lo - 1 - pl.d
    // turn the normal (either sign) to the viewer by the smaller angle
    const n: V3 = dot(pl.n, VIEW) < 0 ? [-pl.n[0], -pl.n[1], -pl.n[2]] : pl.n
    const ax = cross(n, VIEW), al = Math.hypot(...ax)
    this.axis = al < 1e-12 ? [0, 0, 1] : [ax[0] / al, ax[1] / al, ax[2] / al]
    this.angle = Math.atan2(al, dot(n, VIEW))
  }

  at(t: number): SectionFrame {
    t = Math.min(1, Math.max(0, t))
    const planeOffset = t >= 0.4 ? 0 : this.start * (1 - t / 0.4)
    if (t < 0.4) return { planeOffset, cutVisible: false, cutPoly3d: [] }
    const th = this.angle * Math.max(0, (t - 0.6) / 0.4)
    const [c, s, k] = [Math.cos(th), Math.sin(th), this.axis]
    const cutPoly3d = this.poly.map((q) => { // Rodrigues about the centroid
      const v: V3 = [q[0] - this.centroid[0], q[1] - this.centroid[1], q[2] - this.centroid[2]]
      const kv = cross(k, v), kd = dot(k, v) * (1 - c)
      return [0, 1, 2].map((i) => v[i] * c + kv[i] * s + k[i] * kd + this.centroid[i]) as V3
    })
    return { planeOffset, cutVisible: true, cutPoly3d }
  }
}
