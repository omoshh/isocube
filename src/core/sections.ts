import type { Solid, V3 } from './solids';

export type Plane = { n: V3; d: number };
const EPS = 1e-9; // solids have size ~1, so absolute == scaled
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function dedupe(pts: V3[]): V3[] {
  const out: V3[] = [];
  for (const p of pts) if (!out.some((q) => len(sub(p, q)) < 1e-7)) out.push(p);
  return out;
}

export function markedPoints(s: Solid, level: 1 | 2 | 3): V3[] {
  const ts = level === 1 ? [0.5] : [1 / 3, 0.5, 2 / 3];
  return dedupe([...s.vertices, ...s.edges.flatMap(([a, b]) => ts.map((t) => lerp(s.vertices[a], s.vertices[b], t)))]);
}

export function planeThrough(a: V3, b: V3, c: V3): Plane | null {
  const n = cross(sub(b, a), sub(c, a));
  const l = len(n);
  if (l < EPS) return null;
  const u: V3 = [n[0] / l, n[1] / l, n[2] / l];
  return { n: u, d: dot(u, a) };
}

const side = (p: V3, pl: Plane) => dot(pl.n, p) - pl.d;

function normalOf(poly: V3[]): V3 { // Newell; length = 2 * area
  let n: V3 = [0, 0, 0];
  poly.forEach((p, i) => { const c = cross(p, poly[(i + 1) % poly.length]); n = [n[0] + c[0], n[1] + c[1], n[2] + c[2]]; });
  return n;
}
const area = (poly: V3[]) => len(normalOf(poly)) / 2;

export function cut(s: Solid, pl: Plane): V3[] | null {
  const nl = len(pl.n);
  if (nl < EPS) return null;
  const q = { n: pl.n.map((x) => x / nl) as V3, d: pl.d / nl };
  const sd = s.vertices.map((v) => side(v, q));
  if (s.faces.some((f) => f.every((i) => Math.abs(sd[i]) < EPS))) return null;
  const pts: V3[] = [];
  s.vertices.forEach((v, i) => { if (Math.abs(sd[i]) < EPS) pts.push(v); });
  for (const [a, b] of s.edges)
    if ((sd[a] > EPS && sd[b] < -EPS) || (sd[a] < -EPS && sd[b] > EPS))
      pts.push(lerp(s.vertices[a], s.vertices[b], sd[a] / (sd[a] - sd[b])));
  const u = dedupe(pts);
  if (u.length < 3) return null;
  const c = [0, 1, 2].map((k) => u.reduce((t, p) => t + p[k], 0) / u.length) as V3;
  const e1 = sub(u[0], c);
  const e1n = len(e1);
  const x: V3 = [e1[0] / e1n, e1[1] / e1n, e1[2] / e1n];
  const y = cross(q.n, x);
  const ang = (p: V3) => Math.atan2(dot(sub(p, c), y), dot(sub(p, c), x));
  const poly = u.sort((a, b) => ang(a) - ang(b));
  return area(poly) < EPS ? null : poly;
}

export function validCut(s: Solid, pl: Plane, poly: V3[] | null): boolean {
  if (!poly) return false;
  const nl = len(pl.n);
  const onFace = s.faces.some((f) => poly.every((p) => {
    const [a, b, c] = [s.vertices[f[0]], s.vertices[f[1]], s.vertices[f[2]]];
    const fn = cross(sub(b, a), sub(c, a));
    return Math.abs(dot(fn, sub(p, a))) / len(fn) < 1e-7;
  }));
  if (onFace || nl < EPS) return false;
  const biggest = Math.max(...s.faces.map((f) => area(f.map((i) => s.vertices[i]))));
  return area(poly) >= 0.05 * biggest;
}

export function trueShape(poly: V3[]): [number, number][] {
  const nn = normalOf(poly);
  const n: V3 = [nn[0] / len(nn), nn[1] / len(nn), nn[2] / len(nn)];
  const e = sub(poly[1], poly[0]);
  const x: V3 = [e[0] / len(e), e[1] / len(e), e[2] / len(e)];
  const y = cross(n, x);
  return poly.map((p) => [dot(sub(p, poly[0]), x), dot(sub(p, poly[0]), y)]);
}

// Side lengths (normalised by perimeter) and interior angles per vertex.
function signature(p: [number, number][]) {
  const n = p.length;
  const sides = p.map((a, i) => Math.hypot(p[(i + 1) % n][0] - a[0], p[(i + 1) % n][1] - a[1]));
  const per = sides.reduce((t, x) => t + x, 0);
  const angles = p.map((a, i) => {
    const b = p[(i + 1) % n], z = p[(i + n - 1) % n];
    return Math.abs(Math.atan2((b[0] - a[0]) * (z[1] - a[1]) - (b[1] - a[1]) * (z[0] - a[0]),
      (b[0] - a[0]) * (z[0] - a[0]) + (b[1] - a[1]) * (z[1] - a[1])));
  });
  return { sides: sides.map((x) => x / per), angles };
}

/** Same shape up to rotation, mirror and scale, within a relative tolerance (2% groups cuts; ~10% means "easy to tell apart"). */
export function similar(p: [number, number][], q: [number, number][], tol = 0.02): boolean {
  const n = p.length;
  if (n !== q.length || n < 3) return false;
  const close = (a: number, b: number) => Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b));
  const sp = signature(p);
  for (const cand of [q, [...q].reverse()]) {
    const sq = signature(cand);
    for (let k = 0; k < n; k++)
      if (sp.sides.every((x, i) => close(x, sq.sides[(i + k) % n])) && sp.angles.every((x, i) => close(x, sq.angles[(i + k) % n]))) return true;
  }
  return false;
}
