import { describe, expect, it } from 'vitest'
import { HeightMap } from '../../src/core/shape'
import { ISO, fromEntryRamps, mirrorShape, rampCells, rotateShape, shapeFaces, toEntryRamps, turnShape, validShape, type Shape } from '../../src/core/solid'

// rows run back to front: r = 0 is the back row; cube y = rows - 1 - r
const row = (h: number[]) => new HeightMap(h.length, 1, h)

describe('shapes with ramps', () => {
  it('valid only on a flat base, inside, without overlap, below maxH', () => {
    const on = (h: number[], ramps: Shape['ramps'], maxH = 3) => validShape({ hm: row(h), ramps }, maxH)
    expect(on([1, 1, 1], [{ x: 0, y: 0, len: 2, dir: 'E' }])).toBe(true)
    expect(on([1, 2, 1], [{ x: 0, y: 0, len: 2, dir: 'E' }])).toBe(false) // uneven base
    expect(on([1, 1, 1], [{ x: 2, y: 0, len: 2, dir: 'E' }])).toBe(false) // runs off the grid
    expect(on([1, 1, 1], [{ x: 2, y: 0, len: 2, dir: 'W' }])).toBe(true) // W: low end at x 2, covers 2 and 1
    expect(on([2, 2, 2], [{ x: 0, y: 0, len: 1, dir: 'E' }], 2)).toBe(false) // base + 1 > maxH
    expect(on([0, 0, 0], [{ x: 0, y: 0, len: 2, dir: 'E' }, { x: 1, y: 0, len: 1, dir: 'N' }])).toBe(false) // overlap
    expect(on([0, 0, 0], [{ x: 0, y: 0, len: 1, dir: 'N' }])).toBe(true) // on the floor
  })
  it('rampCells follow the direction from the low end', () => {
    expect(rampCells({ x: 2, y: 0, len: 3, dir: 'W' })).toEqual([[2, 0], [1, 0], [0, 0]])
    expect(rampCells({ x: 1, y: 0, len: 2, dir: 'N' })).toEqual([[1, 0], [1, 1]])
  })
  it('faces of a cube with an E ramp on it (iso view)', () => {
    const fs = shapeFaces({ hm: row([1]), ramps: [{ x: 0, y: 0, len: 1, dir: 'E' }] }, ISO)
    expect(fs.some(f => f.plane === 'top1')).toBe(false) // the ramp covers the cube top
    const slant = fs.filter(f => f.plane.startsWith('s:'))
    expect(slant).toHaveLength(1); expect(slant[0].pts).toHaveLength(4); expect(slant[0].owner).toBe('r:0')
    expect(fs.filter(f => f.owner === 'r:0' && f.plane === 'front0')).toHaveLength(1) // the front triangle
    expect(fs.some(f => f.owner === 'r:0' && f.plane.startsWith('rside'))).toBe(false) // the high wall faces away
    expect(fs.filter(f => f.owner === 'c:0,0,0').map(f => f.plane).sort()).toEqual(['front0', 'side0'])
  })
  it('a W ramp shows its high wall to the left', () => {
    const fs = shapeFaces({ hm: row([0]), ramps: [{ x: 0, y: 0, len: 1, dir: 'W' }] }, ISO)
    expect(fs.some(f => f.plane === 'side0' && f.owner === 'r:0')).toBe(true)
  })
  it('rotateShape mirrors cells and ramp directions; twice is the same', () => {
    const s: Shape = { hm: new HeightMap(3, 2, [1, 1, 1, 0, 0, 0]), ramps: [{ x: 0, y: 1, len: 2, dir: 'E' }] }
    const r = rotateShape(s)
    expect(r.ramps).toEqual([{ x: 2, y: 0, len: 2, dir: 'W' }])
    expect(r.hm.h).toEqual([0, 0, 0, 1, 1, 1])
    expect(rotateShape(r)).toEqual(s)
  })
  it('turnShape turns cells and ramp directions a quarter; 4 turns are the same, 2 are rotateShape', () => {
    const s: Shape = { hm: new HeightMap(3, 2, [1, 1, 1, 0, 0, 2]), ramps: [{ x: 0, y: 1, len: 2, dir: 'E' }] }
    const t = turnShape(s)
    expect([t.hm.cols, t.hm.rows]).toEqual([2, 3])
    expect(t.ramps).toEqual([{ x: 1, y: 2, len: 2, dir: 'S' }])
    expect(validShape(t, 3)).toBe(true)
    expect(turnShape(t)).toEqual(rotateShape(s))
    expect(turnShape(turnShape(turnShape(t)))).toEqual(s)
  })
  it('mirrorShape flips left and right; twice is the same', () => {
    const s: Shape = { hm: new HeightMap(3, 2, [1, 1, 1, 0, 0, 2]), ramps: [{ x: 0, y: 1, len: 2, dir: 'E' }] }
    const m = mirrorShape(s)
    expect(m.hm.h).toEqual([1, 1, 1, 2, 0, 0])
    expect(m.ramps).toEqual([{ x: 2, y: 1, len: 2, dir: 'W' }])
    expect(mirrorShape(m)).toEqual(s)
  })
  it('entry ramps round-trip', () => {
    const rs: Shape['ramps'] = [{ x: 1, y: 2, len: 3, dir: 'S' }]
    expect(fromEntryRamps(toEntryRamps(rs))).toEqual(rs)
  })
})
