/** Lives for one puzzle: 3 to start, one lost per failed Check or wrong net pick; Answer marks it revealed. */
export type LivesState = { left: 0 | 1 | 2 | 3; revealed: boolean }
export const START: LivesState = { left: 3, revealed: false }

export function loseLife(s: LivesState): { state: LivesState; restart: boolean } {
  if (s.left <= 1) return { state: START, restart: true }
  return { state: { ...s, left: (s.left - 1) as LivesState['left'] }, restart: false }
}
export const reveal = (s: LivesState): LivesState => ({ ...s, revealed: true })
export const countsAsSolved = (s: LivesState, livesOn: boolean) => !livesOn || !s.revealed
