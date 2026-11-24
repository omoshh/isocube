import { describe, expect, it } from 'vitest'
import { HeightMap, computeEdges, visibleFaces } from '../../src/core/shape'

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('shape', () => {
  it('oneCubeHasNineEdges', () => {
    const e = computeEdges(new HeightMap(1, 1, [1]))
    expect(e.shape.size).toBe(9)
    expect(e.seams.size).toBe(0)
  })
  it('one cube shows 3 faces / 6 triangles', () => {
    expect(visibleFaces(new HeightMap(1, 1, [1])).size).toBe(6)
  })
  it('twoFlatCubesHaveTwoSeams', () => {
    expect(computeEdges(new HeightMap(2, 1, [1, 1])).seams.size).toBe(2)
  })
  it('stepAddsEdges', () => {
    const a = computeEdges(new HeightMap(2, 1, [2, 1])).shape.size
    expect(a).toBeGreaterThan(computeEdges(new HeightMap(2, 1, [1, 1])).shape.size)
  })
  it('HeightMap basics', () => {
    const h = new HeightMap(2, 1, [2, 1])
    expect(h.at(5, 0)).toBe(0)
    expect(h.cubeCount).toBe(3)
    expect(h.cubes()).toContainEqual([1, 0, 0])
  })
  it('edgesAndSeamsDisjoint', () => {
    const rnd = mulberry32(7)
    for (let i = 0; i < 30; i++) {
      const h = new HeightMap(4, 4, Array.from({ length: 16 }, () => Math.floor(rnd() * 4)))
      const { shape, seams } = computeEdges(h)
      for (const s of seams) expect(shape.has(s)).toBe(false)
    }
  })
})
