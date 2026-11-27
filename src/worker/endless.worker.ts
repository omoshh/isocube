import { makeJob } from '../core/generator'
import { toEntryRamps } from '../core/solid'

// { id, job, seed } → { id, job, seed, cols, rows, h, ramps }; the queue drops replies it no longer wants.
self.onmessage = (e: MessageEvent<{ id: number; job: string; seed: number }>) => {
  const { id, job, seed } = e.data, { hm, ramps } = makeJob(job, seed)
  ;(self as unknown as Worker).postMessage({ id, job, seed, cols: hm.cols, rows: hm.rows, h: hm.h, ramps: toEntryRamps(ramps) })
}
