import { describe, expect, it } from 'vitest'
import { accentUnlocked, hiddenAccents, nextAccent, shownAccent, solvedCount } from '../../src/core/unlocks'

describe('accentRules', () => {
  it('unlocks by threshold', () => {
    expect(accentUnlocked('yellow', 0, false)).toBe(true)
    expect(accentUnlocked('mint', 10, false)).toBe(true)
    expect(accentUnlocked('mint', 9, false)).toBe(false)
    expect(accentUnlocked('lilac', 24, false)).toBe(false)
    expect(accentUnlocked('sand', 200, false)).toBe(true)
  })
  it('unlockAll unlocks everything', () => {
    for (const a of ['mint', 'lilac', 'pink', 'lime', 'red', 'sand'] as const) expect(accentUnlocked(a, 0, true)).toBe(true)
  })
  it('nextAccent', () => {
    expect(nextAccent(0)).toEqual({ id: 'mint', left: 10 })
    expect(nextAccent(24)).toEqual({ id: 'lilac', left: 1 })
    expect(nextAccent(200)).toBeNull()
  })
  it('newSolvedCount', () => {
    const base = solvedCount({ solved: [], netsRight: 0, endlessSeeds: {} })
    expect(solvedCount({ solved: ['X1-5'], netsRight: 0, endlessSeeds: {} })).toBe(base + 1)
    expect(solvedCount({ solved: ['X1-5', 'S2-L3-004'], netsRight: 0, endlessSeeds: {} })).toBe(base + 2)
  })
  it('solvedCount', () => {
    expect(solvedCount({ solved: ['a', 'b'], netsRight: 3, endlessSeeds: {} })).toBe(5)
  })
})

describe('hidden accents per style', () => {
  it('Blueprint dark hides only red', () => {
    expect(hiddenAccents('blueprint', 'dark')).toEqual(['red'])
    expect(hiddenAccents('blueprint', 'light')).toEqual([])
    expect(hiddenAccents('paper', 'dark')).toEqual([])
    expect(hiddenAccents('concrete', 'dark')).toEqual([])
  })
  it('shownAccent falls back to yellow when hidden', () => {
    expect(shownAccent('red', 'blueprint', 'dark')).toBe('yellow')
    expect(shownAccent('red', 'blueprint', 'light')).toBe('red')
    expect(shownAccent('mint', 'blueprint', 'dark')).toBe('mint')
  })
})
