export type V3 = [number, number, number];
export type SolidId = 'cube' | 'cuboid' | 'triPrism' | 'hexPrism' | 'sqPyramid' | 'tetra';
export type Solid = { id: SolidId; vertices: V3[]; faces: number[][]; edges: [number, number][] };

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Faces are given in any vertex order per face; orientation is fixed here (convex solids only).
function build(id: SolidId, vertices: V3[], faces: number[][]): Solid {
  const c = [0, 1, 2].map((k) => vertices.reduce((t, v) => t + v[k], 0) / vertices.length) as V3;
  const out = faces.map((f) => {
    const [a, b, d] = [vertices[f[0]], vertices[f[1]], vertices[f[2]]];
    return dot(cross(sub(b, a), sub(d, a)), sub(a, c)) > 0 ? f : [...f].reverse();
  });
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  for (const f of out)
    f.forEach((v, i) => {
      const w = f[(i + 1) % f.length];
      const k = Math.min(v, w) + ',' + Math.max(v, w);
      if (!seen.has(k)) { seen.add(k); edges.push([Math.min(v, w), Math.max(v, w)]); }
    });
  return { id, vertices, faces: out, edges };
}

function box(id: SolidId, sx: number): Solid {
  const v: V3[] = [];
  for (let i = 0; i < 8; i++) v.push([(i & 1) * sx, (i >> 1) & 1, (i >> 2) & 1]);
  return build(id, v, [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]]);
}

function prism(id: SolidId, n: number): Solid {
  const r = 1 / (2 * Math.sin(Math.PI / n)); // circumradius for side 1
  const v: V3[] = [];
  for (const z of [0, 1]) for (let i = 0; i < n; i++) v.push([r * Math.cos(2 * Math.PI * i / n), r * Math.sin(2 * Math.PI * i / n), z]);
  const ring = [...Array(n).keys()];
  const faces = [ring, ring.map((i) => i + n), ...ring.map((i) => [i, (i + 1) % n, (i + 1) % n + n, i + n])];
  return build(id, v, faces);
}

export function makeSolid(id: SolidId): Solid {
  switch (id) {
    case 'cube': return box(id, 1);
    case 'cuboid': return box(id, 2);
    case 'triPrism': return prism(id, 3);
    case 'hexPrism': return prism(id, 6);
    case 'sqPyramid':
      return build(id, [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0.5, 0.5, 1]],
        [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]]);
    case 'tetra': {
      const h = Math.sqrt(2 / 3);
      return build(id, [[0, 0, 0], [1, 0, 0], [0.5, Math.sqrt(3) / 2, 0], [0.5, Math.sqrt(3) / 6, h]],
        [[0, 1, 2], [0, 1, 3], [1, 2, 3], [2, 0, 3]]);
    }
  }
}
