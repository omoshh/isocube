import { describe, it, expect } from 'vitest';
import { makeSolid, type V3 } from '../../src/core/solids';
import { markedPoints, planeThrough, cut, validCut, trueShape, similar } from '../../src/core/sections';

const P = (a: V3, b: V3, c: V3) => planeThrough(a, b, c)!;
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const ids = ['cube', 'cuboid', 'triPrism', 'hexPrism', 'sqPyramid', 'tetra'] as const;

describe('solids', () => {
  it.each(ids)('%s faces point away from centroid', (id) => {
    const s = makeSolid(id);
    const c = [0, 1, 2].map((k) => s.vertices.reduce((t, v) => t + v[k], 0) / s.vertices.length);
    for (const f of s.faces) {
      const [a, b, d] = [s.vertices[f[0]], s.vertices[f[1]], s.vertices[f[2]]];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      expect(n[0] * (a[0] - c[0]) + n[1] * (a[1] - c[1]) + n[2] * (a[2] - c[2])).toBeGreaterThan(0);
    }
  });
  it('markedPoints counts for the cube', () => {
    const s = makeSolid('cube');
    expect(markedPoints(s, 1)).toHaveLength(20);
    expect(markedPoints(s, 2)).toHaveLength(44);
    expect(markedPoints(s, 3)).toHaveLength(44);
  });
});

describe('cuts', () => {
  const cube = makeSolid('cube');
  it('cubeCornerTriangle is equilateral', () => {
    const poly = cut(cube, P([1, 0, 0], [0, 1, 0], [0, 0, 1]))!;
    expect(poly).toHaveLength(3);
    const [a, b, c] = poly;
    expect(dist(a, b)).toBeCloseTo(dist(b, c));
    expect(dist(b, c)).toBeCloseTo(dist(c, a));
  });
  it('cubeHexagon is a regular hexagon', () => {
    const poly = cut(cube, P([0.5, 0, 1], [1, 0.5, 0], [0, 1, 0.5]))!;
    expect(poly).toHaveLength(6);
    const hex: [number, number][] = [0, 1, 2, 3, 4, 5].map((k) => [Math.cos(k * Math.PI / 3), Math.sin(k * Math.PI / 3)]);
    expect(similar(trueShape(poly), hex)).toBe(true);
  });
  it('faceRejected', () => {
    expect(cut(cube, P([0, 0, 0], [1, 0, 0], [0, 1, 0]))).toBeNull();
  });
  it('collinearRejected', () => {
    expect(planeThrough([0, 0, 0], [1, 1, 1], [2, 2, 2])).toBeNull();
  });
  it('sliverRejected', () => {
    const pl = P([0.1, 0, 0], [0, 0.1, 0], [0, 0, 0.1]);
    expect(validCut(cube, pl, cut(cube, pl))).toBe(false);
    const ok = P([1, 0, 0], [0, 1, 0], [0, 0, 1]);
    expect(validCut(cube, ok, cut(cube, ok))).toBe(true);
  });
  it('vertex plus opposite edge midpoint does not duplicate points', () => {
    const poly = cut(cube, P([0, 0, 0], [1, 1, 0.5], [1, 0, 1]))!;
    expect(poly.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < poly.length; i++)
      for (let j = i + 1; j < poly.length; j++) expect(dist(poly[i], poly[j])).toBeGreaterThan(1e-6);
  });
});

describe('similar', () => {
  it('similarMirror', () => {
    const t: [number, number][] = [[0, 0], [3, 0], [0, 1]];
    const m: [number, number][] = [[0, 0], [-3, 0], [0, 1]];
    expect(similar(t, m)).toBe(true);
  });
  it('notSimilar', () => {
    expect(similar([[0, 0], [1, 0], [1, 1], [0, 1]], [[0, 0], [2, 0], [2, 1], [0, 1]])).toBe(false);
  });
});
