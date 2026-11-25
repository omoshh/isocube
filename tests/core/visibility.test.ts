import { describe, expect, it } from 'vitest'
import { HeightMap } from '../../src/core/shape'
import { fairPicture, neededCubes, rotate180 } from '../../src/core/visibility'

describe('rotate180', () => {
  it('turns the figure half a turn', () => {
    const hm = new HeightMap(3, 2, [1, 2, 3, 4, 5, 6])
    expect(rotate180(hm).h).toEqual([6, 5, 4, 3, 2, 1])
    expect(rotate180(rotate180(hm)).h).toEqual(hm.h)
  })
})

describe('neededCubes', () => {
  it('every cube of a lone column is needed: each is nearest in its row and column', () => {
    expect(neededCubes(new HeightMap(1, 1, [2]))).toHaveLength(2)
  })
  it('a cube behind another at the same height is not needed by the front view', () => {
    // 1 col, 2 rows (back, front): both height 1; the back cube is still the top of its column
    expect(neededCubes(new HeightMap(1, 2, [1, 1]))).toHaveLength(2)
  })
})

describe('fairPicture', () => {
  it('true when the hidden cube shows from the back (old RL1-007)', () => {
    expect(fairPicture(new HeightMap(3, 3, [0, 2, 1, 2, 1, 1, 1, 1, 2]))).toBe(true)
  })
  it('false when a needed cube is hidden from both sides', () => {
    expect(fairPicture(new HeightMap(3, 3, [2, 2, 2, 2, 1, 2, 2, 2, 2]))).toBe(false)
  })
  it('true for a single column', () => {
    expect(fairPicture(new HeightMap(1, 1, [3]))).toBe(true)
  })
})
