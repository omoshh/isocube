import { LEVELS } from '../core/generator'
import { HeightMap } from '../core/shape'
import { h } from './dom'
import type { Screen } from './router'
import { mountReverse } from './screens/reversePuzzle'
import { mountPuzzle } from './screens/viewsPuzzle'
import { loadProgress, saveLast, updateProgress } from './storage'
import { S } from './strings'

type Result = { seed: number; hm: HeightMap }
type Reply = { id: number; level: number; seed: number; cols: number; rows: number; h: number[] }

const AHEAD = 2
let ids = 0 // global, so ids never repeat across queues or after cancel()

/**
 * Makes endless puzzles for one level in a worker, keeping AHEAD ready.
 * Seeds: random 32-bit (crypto.getRandomValues), skipping `used` and every seed this queue asked for.
 * Replies for another level or for an id no longer in flight (cancelled, disposed) are dropped.
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

  constructor(readonly level: number, private makeWorker: () => Worker, used: Iterable<number> = []) {
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
      const { id, level, seed, cols, rows, h } = e.data, job = this.jobs.get(id)
      if (level !== this.level || !job) return
      this.jobs.delete(id)
      job({ seed, hm: new HeightMap(cols, rows, h) })
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
    this.worker.postMessage({ id, level: this.level, seed })
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

// One queue per level while the user stays in that level's endless routes, so NEXT finds puzzles ready.
const queues = new Map<number, EndlessQueue>()
// hm of puzzles this session made, so opening one needs no second generation
const made = new Map<string, HeightMap>()

/**
 * #/endless/<level>/new (wait for the queue, record the seed, open it) and #/endless/<level>/<seed>;
 * mode 'reverse': #/reverse/E<level>-new and #/reverse/E<level>-<seed>. Both modes share progress.endlessSeeds,
 * so a seed is never served twice in either mode.
 */
export async function mountEndless(root: HTMLElement, level: number, seed: string, makeWorker = realWorker, mode: 'views' | 'reverse' = 'views'): Promise<Screen> {
  const rev = mode === 'reverse', prefix = rev ? `#/reverse/E${level}-` : `#/endless/${level}/`
  const used = (await loadProgress()).endlessSeeds[level] ?? []
  let q = queues.get(level)
  if (!q) queues.set(level, q = new EndlessQueue(level, makeWorker, used))
  let dead = false, inner: Screen | undefined
  const wait = h('main', { class: 'placeholder' }, h('p', { text: S.generating }),
    h('button', { class: 'btn btn-outline', text: S.cancel, onclick: () => { location.hash = `#/levels/${mode}` } }))
  root.append(wait)

  const open = async (hm: HeightMap) => {
    wait.remove()
    void saveLast({ kind: rev ? 'reverse' : 'views', level, route: prefix + seed })
    const p = { cols: hm.cols, rows: hm.rows, maxH: LEVELS[level - 1].maxH, h: hm.h, subtitle: S.endlessSub(hm.cols, hm.rows, LEVELS[level - 1].maxH), nextRoute: prefix + 'new' }
    const s = rev
      ? await mountReverse(root, { ...p, id: `R-E${level}-${seed}`, key: `reverse/E${level}-${seed}`, title: `${S.reverse}: ${S.level(level).toLowerCase()}` })
      : await mountPuzzle(root, { ...p, id: `E${level}-${seed}`, key: `endless/${level}/${seed}`, title: S.level(level) })
    if (dead) s.destroy(); else inner = s
  }

  if (seed === 'new') {
    const failed = () => { if (!dead) wait.querySelector('p')!.textContent = S.generateFailed }
    q.next().then(async r => {
      if (dead) return
      made.set(`${level}/${r.seed}`, r.hm)
      await updateProgress(p => ({ ...p, endlessSeeds: { ...p.endlessSeeds, [level]: [...(p.endlessSeeds[level] ?? []), r.seed] } }))
      if (!dead) location.replace(prefix + r.seed) // Back skips the "Generating…" step
    }, failed) // cancel/dispose reject after this screen is gone (dead)
  } else {
    const hm = made.get(`${level}/${seed}`)
    if (hm) await open(hm)
    else q.make(+seed).then(r => { if (!dead) { made.set(`${level}/${seed}`, r.hm); return open(r.hm) } }, () => { if (!dead) wait.querySelector('p')!.textContent = S.generateFailed })
  }

  return {
    destroy() {
      dead = true
      wait.remove(); inner?.destroy()
      // the router has already moved location.hash: leaving this level's endless mode stops its worker
      if (!location.hash.startsWith(prefix)) { q.dispose(); queues.delete(level) }
    },
  }
}
