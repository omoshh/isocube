import { describe, expect, it } from 'vitest'
import { START, countsAsSolved, loseLife, reveal, type LivesState } from '../../src/core/lives'

describe('lives', () => {
  it('threeFailsRestart', () => {
    let s: LivesState = START
    const steps: boolean[] = []
    for (let i = 0; i < 3; i++) { const r = loseLife(s); s = r.state; steps.push(r.restart) }
    expect(steps).toEqual([false, false, true])
    expect(s).toEqual(START)
    expect(loseLife(START).state.left).toBe(2)
  })
  it('revealNotSolved', () => {
    expect(countsAsSolved(reveal(START), true)).toBe(false)
    expect(countsAsSolved(reveal(START), false)).toBe(true)
    expect(countsAsSolved(START, true)).toBe(true)
  })
})

describe('restart keeps revealed', () => {
  it('last life lost after Answer stays revealed', () => {
    const r = loseLife({ left: 1, revealed: true })
    expect(r).toEqual({ state: { left: 3, revealed: true }, restart: true })
    expect(loseLife({ left: 1, revealed: false }).state).toEqual(START)
  })
})
