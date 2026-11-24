// Fold animation of a net onto a polycube. Port of foldPose in reference/index.html: all squares
// turn about their fold line by 0 or +-90 deg * t, relative to their parent; the root stays on the table.
import { foldMap, type Net, type Polycube } from './nets'

type V3 = [number, number, number]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
// rotate p about the line through h with unit direction u (Rodrigues)
const rot = (p: V3, h: V3, u: V3, th: number): V3 => {
  const v = sub(p, h), c = Math.cos(th), s = Math.sin(th)
  return add(h, add(add(mul(v, c), mul(cross(u, v), s)), mul(u, dot(u, v) * (1 - c))))
}
const ZERO: V3 = [0, 0, 0]

export class FoldAnimation {
  private flat: V3[] = [] // square centres at t=0 (z=0)
  private parent: number[] = []
  private hinge: { h: V3; u: V3; th: number }[] = []
  private faces: { cube: V3; normal: V3 }[]
  private a: V3 // world direction of net +c on the flat net
  private b: V3

  constructor(private net: Net, shape: Polycube) {
    const st = foldMap(net, shape)
    if (!st) throw new Error('net does not fold onto shape')
    this.faces = st.map(s => ({ cube: s.c, normal: s.n }))
    const root = st.findIndex(s => s.n[2] === -1 && s.c[2] === 0)
    if (root < 0) throw new Error('no square can lie on the bottom face')
    this.a = st[root].a; this.b = st[root].b
    const rc = add(st[root].c, [.5, .5, 0])
    this.flat = net.map(q => add(rc, add(mul(this.a, q.c - net[root].c), mul(this.b, q.r - net[root].r))))
    const at = new Map(net.map((q, i) => [q.c + ',' + q.r, i]))
    this.parent = net.map(() => -2)
    this.parent[root] = -1
    this.hinge = net.map(() => ({ h: ZERO, u: ZERO, th: 0 }))
    const queue = [root]
    while (queue.length) {
      const p = queue.shift()!
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = at.get(net[p].c + dc + ',' + (net[p].r + dr))
        if (j === undefined || this.parent[j] !== -2) continue
        this.parent[j] = p
        const d = sub(this.flat[j], this.flat[p]), u = cross([0, 0, 1], d)
        const h = add(this.flat[p], mul(d, .5))
        // pick 0 / +-90 deg so the child lands on its face once the parent chain is folded
        const want = add(add(st[j].c, [.5, .5, .5]), mul(st[j].n, .5))
        this.hinge[j] = { h, u, th: 0 }
        this.hinge[j].th = [0, 1, -1].map(k => k * Math.PI / 2)
          .find(th => this.dist(this.move(j, 1, this.flat[j], th), want) < 1e-6) ?? 0
        queue.push(j)
      }
    }
  }

  private dist = (p: V3, q: V3) => Math.hypot(...sub(p, q))
  /** Move point v (given at t=0, belonging to square i) to time t; `override` replaces square i's own angle. */
  private move(i: number, t: number, v: V3, override?: number): V3 {
    for (let k = i, first = true; this.parent[k] >= 0; k = this.parent[k], first = false) {
      const { h, u, th } = this.hinge[k]
      v = rot(v, h, u, t * (first && override !== undefined ? override : th))
    }
    return v
  }

  pose(cell: number, t: number): V3[] {
    const c = this.flat[cell]
    return [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]].map(([i, j]) =>
      this.move(cell, t, add(c, add(mul(this.a, i), mul(this.b, j)))))
  }

  finalFace(cell: number) { return this.faces[cell] }
}
