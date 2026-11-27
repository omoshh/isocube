import { LEVELS, parseSpec } from '../core/generator'
import { HeightMap } from '../core/shape'
import type { EntryRamp } from '../core/solid'
import { h } from './dom'
import type { Screen } from './router'
import { mountReverse } from './screens/reversePuzzle'
import { mountPuzzle } from './screens/viewsPuzzle'
import { loadProgress, saveLast, updateProgress } from './storage'
import { S } from './strings'

type Result = { seed: number; hm: HeightMap; ramps: EntryRamp[] }
type Reply = { id: number; job: string; seed: number; cols: number; rows: number; h: number[]; ramps: EntryRamp[] }

const AHEAD = 2
let ids = 0 // global, so ids never repeat across queues or after cancel()

/**
 * Makes endless puzzles for one job (a level '1'–'6' or a spec key like '3x3x2s') in a worker, keeping AHEAD ready.
 * Seeds: random 32-bit (crypto.getRandomValues), skipping `used` and every seed this queue asked for.
 * Replies for another job or for an id no longer in flight (cancelled, disposed) are dropped.
 * cancel(): terminates the worker, rejects pending next()/make() with Error('cancelled'), starts a fresh worker
 * and refills; ready puzzles are kept. dispose(): the same, but drops the ready puzzles and starts nothing.
 */
export class EndlessQueue {
  private worker!: Worker
  private ready: Result[] = []
  private waiters: ((r: Result) => void)[] = []
  private jobs = new Map<number, (r: Result) => void>()
  private fails = new Set<(e: Error) => void>()
  private filling = 0
  private used: Set<number>

  constructor(readonly job: string, private makeWorker: () => Worker, used: Iterable<number> = []) {
    this.used = new Set(used)
    this.start()
  }

  next(): Promise<Result> {
    const r = this.ready.shift()
    if (r) { this.fill(); return Promise.resolve(r) }
    return this.wait(res => { this.waiters.push(res); this.fill() })
  }

  /** The puzzle for a known seed (a cold open of #/endless/<level>/<seed>); queued behind requests in flight. */
  make(seed: number): Promise<Result> {
    this.used.add(seed)
    return this.wait(res => this.post(seed, res))
  }

  cancel(): void { this.stop(); this.start() }
  dispose(): void { this.stop(); this.ready = [] }

  private start() {
    this.worker = this.makeWorker()
    this.worker.onerror = this.worker.onmessageerror = () => this.fail(new Error('worker'))
    this.worker.onmessage = (e: MessageEvent<Reply>) => {
      const { id, job, seed, cols, rows, h, ramps } = e.data, done = this.jobs.get(id)
      if (job !== this.job || !done) return
      this.jobs.delete(id)
      done({ seed, hm: new HeightMap(cols, rows, h), ramps })
    }
    this.fill()
  }

  private fail(err: Error) {
    for (const f of this.fails) f(err)
    this.fails.clear(); this.jobs.clear(); this.waiters = []; this.filling = 0
  }

  private stop() {
    this.worker.terminate()
    this.jobs.clear(); this.waiters = []; this.filling = 0
    const e = new Error('cancelled')
    for (const f of this.fails) f(e)
    this.fails.clear()
  }

  private wait(register: (res: (r: Result) => void) => void): Promise<Result> {
    return new Promise((resolve, reject) => {
      this.fails.add(reject)
      register(r => { this.fails.delete(reject); resolve(r) })
    })
  }

  private post(seed: number, job: (r: Result) => void) {
    const id = ++ids
    this.jobs.set(id, job)
    this.worker.postMessage({ id, job: this.job, seed })
  }

  private fill() {
    while (this.ready.length + this.filling - this.waiters.length < AHEAD) {
      const a = new Uint32Array(1)
      do crypto.getRandomValues(a); while (this.used.has(a[0]))
      this.used.add(a[0])
      this.filling++
      this.post(a[0], r => {
        this.filling--
        const w = this.waiters.shift()
        if (w) w(r); else this.ready.push(r)
      })
    }
  }
}

const realWorker = () => new Worker(new URL('../worker/endless.worker.ts', import.meta.url), { type: 'module' })

// One queue per job while the user stays in that job's endless routes, so NEXT finds puzzles ready.
const queues = new Map<string, EndlessQueue>()
// puzzles this session made, so opening one needs no second generation
const made = new Map<string, Result>()
/** After this long on "Generating…", suggest a smaller size (generation goes on). */
export const SLOW_MS = 10_000

/**
 * #/endless/<job>/new (wait for the queue, record the seed, open it) and #/endless/<job>/<seed>, where job is a level
 * '1'–'6' (old routes) or a size spec like '3x3x2s'; mode 'reverse' (levels only): #/reverse/E<level>-new and
 * #/reverse/E<level>-<seed>. Both modes share progress.endlessSeeds[job], so a seed is never served twice in either mode.
 */
export async function mountEndless(root: HTMLElement, job: string, seed: string, makeWorker = realWorker, mode: 'views' | 'reverse' = 'views'): Promise<Screen> {
  const rev = mode === 'reverse', prefix = rev ? `#/reverse/E${job}-` : `#/endless/${job}/`
  const spec = parseSpec(job), level = spec ? 0 : +job, maxH = spec ? spec.maxH : LEVELS[level - 1].maxH
  const used = (await loadProgress()).endlessSeeds[job] ?? []
  let q = queues.get(job)
  if (!q) queues.set(job, q = new EndlessQueue(job, makeWorker, used))
  let dead = false, inner: Screen | undefined
  const msg = h('p', { text: S.generating })
  const wait = h('main', { class: 'placeholder' }, msg,
    h('button', { class: 'btn btn-outline', text: S.cancel, onclick: () => { location.hash = `#/levels/${mode}` } }))
  root.append(wait)
  const slow = setTimeout(() => {
    if (dead || !wait.isConnected) return
    msg.textContent = S.slowHint
    wait.append(h('a', { class: 'btn btn-outline', href: '#/levels/views', text: S.smaller }))
  }, SLOW_MS)
  const failed = () => { clearTimeout(slow); if (!dead) msg.textContent = S.generateFailed }

  const open = async (r: Result) => {
    clearTimeout(slow)
    wait.remove()
    void saveLast({ kind: rev ? 'reverse' : 'views', level, route: prefix + seed })
    const { hm } = r
    const p = { cols: hm.cols, rows: hm.rows, maxH, h: hm.h, subtitle: S.endlessSub(hm.cols, hm.rows, maxH, spec?.slopes), nextRoute: prefix + 'new' }
    const s = rev
      ? await mountReverse(root, { ...p, id: `R-E${job}-${seed}`, key: `reverse/E${job}-${seed}`, title: `${S.reverse}: ${S.level(level).toLowerCase()}` })
      : await mountPuzzle(root, { ...p, ramps: r.ramps, id: `E${job}-${seed}`, key: `endless/${job}/${seed}`, title: spec ? S.endless : S.level(level) })
    if (dead) s.destroy(); else inner = s
  }

  if (seed === 'new') {
    q.next().then(async r => {
      if (dead) return
      made.set(`${job}/${r.seed}`, r)
      await updateProgress(p => ({ ...p, endlessSeeds: { ...p.endlessSeeds, [job]: [...(p.endlessSeeds[job] ?? []), r.seed] } }))
      if (!dead) location.replace(prefix + r.seed) // Back skips the "Generating…" step
    }, failed) // cancel/dispose reject after this screen is gone (dead)
  } else {
    const r = made.get(`${job}/${seed}`)
    if (r) await open(r)
    else q.make(+seed).then(r => { if (!dead) { made.set(`${job}/${seed}`, r); return open(r) } }, failed)
  }

  return {
    destroy() {
      dead = true
      clearTimeout(slow)
      wait.remove(); inner?.destroy()
      // the router has already moved location.hash: leaving this job's endless mode stops its worker
      if (!location.hash.startsWith(prefix)) { q.dispose(); queues.delete(job) }
    },
  }
}
