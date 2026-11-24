import { makePuzzle } from '../core/generator'

// { id, level, seed } → { id, level, seed, cols, rows, h }; the queue drops replies it no longer wants.
self.onmessage = (e: MessageEvent<{ id: number; level: number; seed: number }>) => {
  const { id, level, seed } = e.data, { hm } = makePuzzle(level, seed)
  ;(self as unknown as Worker).postMessage({ id, level, seed, cols: hm.cols, rows: hm.rows, h: hm.h })
}
