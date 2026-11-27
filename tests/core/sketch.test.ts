import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { linePieces } from '../../src/core/geometry'
import type { PuzzleFile } from '../../src/core/generator'
import { computeEdges, HeightMap } from '../../src/core/shape'
import { shapeEdges } from '../../src/core/sketch'

const file: PuzzleFile = JSON.parse(readFileSync('public/puzzles.json', 'utf8'))
const key = (t: number, m: number, t2: number, m2: number) => linePieces({ a: { t, m }, b: { t: t2, m: m2 } })

describe('sketch: iso edges', () => {
  it('cube-only: the same lines and seams as computeEdges for level puzzles', () => {
    const some = file.puzzles.filter(p => p.set === 'level')
    for (const p of some) {
      const hm = new HeightMap(p.cols, p.rows, p.h), a = computeEdges(hm), b = shapeEdges({ hm, ramps: [] })
      expect([...b.shape].sort(), p.id).toEqual([...a.shape].sort())
      expect([...b.seams].sort(), p.id).toEqual([...a.seams].sort())
      expect(b.partial, p.id).toBe(false)
    }
  })
  it('an E ramp of length 2 on the floor: its slanted front edge is a line', () => {
    const e = shapeEdges({ hm: new HeightMap(2, 1, [0, 0]), ramps: [{ x: 0, y: 0, len: 2, dir: 'E' }] })
    for (const k of key(0, 0, 2, 1)) expect(e.shape).toContain(k)
    expect(e.owners).toContain('r:0')
  })
  it('two ramps side by side with the same slope: a seam between them', () => {
    const e = shapeEdges({ hm: new HeightMap(1, 2, [0, 0]), ramps: [{ x: 0, y: 0, len: 1, dir: 'E' }, { x: 0, y: 1, len: 1, dir: 'E' }] })
    for (const k of key(-1, 1, 0, 2)) { expect(e.seams).toContain(k); expect(e.shape).not.toContain(k) }
  })
  it('a W ramp of length 1 (slope seen edge-on) does not break the picture', () => {
    const e = shapeEdges({ hm: new HeightMap(1, 1, [0]), ramps: [{ x: 0, y: 0, len: 1, dir: 'W' }] })
    expect(e.partial).toBe(false)
    expect(e.shape.size).toBeGreaterThan(0)
  })
  it('a slanted edge half hidden behind a tall column is partial', () => {
    // back row (y 1) on the floor with an E ramp of length 2; a column of 2 in the front row at x 1
    const e = shapeEdges({ hm: new HeightMap(3, 2, [0, 0, 0, 0, 2, 0]), ramps: [{ x: 0, y: 1, len: 2, dir: 'E' }] })
    expect(e.partial).toBe(true)
  })
})
