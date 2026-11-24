import type { SegKey } from './geometry'
import type { EdgeSet } from './shape'
import type { ViewSet } from './views'

// For views the sets hold gridSegKey strings (SegKey is string).
export type CheckResult = { missing: Set<SegKey>; mistakes: Set<SegKey>; correct: boolean }

const diff = (a: Set<string>, b: Set<string>, skip?: Set<string>) =>
  new Set([...a].filter(k => !b.has(k) && !skip?.has(k)))

function result(missing: Set<string>, mistakes: Set<string>): CheckResult {
  return { missing, mistakes, correct: missing.size === 0 && mistakes.size === 0 }
}

export const checkDrawing = (drawn: Set<SegKey>, answer: EdgeSet): CheckResult =>
  result(diff(answer.shape, drawn), diff(drawn, answer.shape, answer.seams))

export function checkViews(drawn: ViewSet, answer: ViewSet) {
  const f = (k: keyof ViewSet) => result(diff(answer[k], drawn[k]), diff(drawn[k], answer[k]))
  const top = f('top'), front = f('front'), side = f('side')
  return { top, front, side, correct: top.correct && front.correct && side.correct }
}
