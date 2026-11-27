// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeJob, makePuzzle } from '../../src/core/generator'
import { toEntryRamps } from '../../src/core/solid'

type Msg = { id: number; job: string; seed: number }
type Fake = { onmessage: ((e: { data: unknown }) => void) | null; inbox: Msg[]; terminated: boolean; postMessage(m: Msg): void; terminate(): void }

const reply = (m: Msg) => { const { hm, ramps } = makeJob(m.job, m.seed); return { ...m, cols: hm.cols, rows: hm.rows, h: hm.h, ramps: toEntryRamps(ramps) } }

// Direct-call stand-in for the worker: requests wait in `inbox` until flush() answers them through makePuzzle.
function fakeWorkers() {
  const all: Fake[] = []
  const make = () => {
    const w: Fake = { onmessage: null, inbox: [], terminated: false, postMessage(m) { this.inbox.push(m) }, terminate() { this.terminated = true } }
    all.push(w)
    return w as unknown as Worker
  }
  const flush = () => { for (const w of all) while (!w.terminated && w.inbox.length) w.onmessage?.({ data: reply(w.inbox.shift()!) }) }
  return { all, make, flush }
}

const load = async () => ({ endless: await import('../../src/ui/endless'), storage: await import('../../src/ui/storage') })
const sized = () => {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 412, height: 915, right: 412, bottom: 915, x: 0, y: 0, toJSON() {} })
  document.body.appendChild(el)
  return el
}

beforeEach(() => { vi.resetModules(); vi.restoreAllMocks(); indexedDB = new IDBFactory(); document.body.replaceChildren(); location.hash = '#/levels/views' })

describe('EndlessQueue', () => {
  it('keepsTwoReady', async () => {
    const seeds = [5, 7, 9, 11]
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(a => { (a as Uint32Array)[0] = seeds.shift()!; return a })
    const { endless } = await load()
    const f = fakeWorkers()
    const q = new endless.EndlessQueue('1', f.make, [5]) // 5 is already used
    expect(f.all[0].inbox.map(m => m.seed)).toEqual([7, 9])
    expect(f.all[0].inbox.every(m => m.job === '1')).toBe(true)
    f.flush()
    const a = await q.next()
    expect(a.seed).toBe(7)
    expect(a.hm.h).toEqual(makePuzzle(1, 7).hm.h)
    expect(f.all[0].inbox.map(m => m.seed)).toEqual([11]) // topped back up to 2
    expect((await q.next()).seed).toBe(9) // already ready, no flush needed
    q.dispose()
  })

  it('cancelStopsWorker', async () => {
    const { endless } = await load()
    const f = fakeWorkers()
    const q = new endless.EndlessQueue('6', f.make)
    const waiting = q.next()
    const old = f.all[0].inbox[0]
    q.cancel()
    await expect(waiting).rejects.toThrow('cancelled')
    expect(f.all[0].terminated).toBe(true)
    expect(f.all.length).toBe(2) // a fresh worker
    expect(f.all[1].inbox.length).toBe(2)
    // a stale reply (cancelled id) reaching the new worker's handler is dropped
    f.all[1].onmessage!({ data: { ...old, cols: 5, rows: 6, h: new Array(30).fill(1) } })
    const p = q.next()
    let got = false
    const settled = p.then(() => { got = true }, e => e)
    await Promise.resolve()
    expect(got).toBe(false)
    q.dispose()
    expect(f.all[1].terminated).toBe(true)
    expect(await settled).toEqual(new Error('cancelled'))
  })

  it('noCrossLevelResult', async () => {
    const { endless } = await load()
    const f = fakeWorkers()
    const q6 = new endless.EndlessQueue('6', f.make)
    void q6.next().catch(() => {})
    const late = f.all[0].inbox[0]
    q6.dispose()
    const q2 = new endless.EndlessQueue('2', f.make)
    // a level 6 answer that still arrives (even with a colliding id) must not count for level 2
    for (const m of f.all[1].inbox) f.all[1].onmessage!({ data: { ...late, id: m.id, cols: 5, rows: 6, h: new Array(30).fill(1) } })
    f.flush()
    for (let i = 0; i < 3; i++) {
      const r = await q2.next()
      f.flush()
      expect(r.hm.h).toEqual(makePuzzle(2, r.seed).hm.h)
      expect(r.hm.cols * r.hm.rows).toBe(12)
    }
    expect(f.all[0].terminated).toBe(true) // the level 6 worker was stopped and never answered
    expect(f.all[0].inbox[0]).toBe(late)
    q2.dispose()
  })

  it('seedReopens', async () => {
    const { endless } = await load()
    const f = fakeWorkers()
    const q = new endless.EndlessQueue('3', f.make)
    const a = q.make(12345), b = q.make(12345)
    f.flush()
    expect((await a).hm.h).toEqual((await b).hm.h)
    expect((await a).hm.h).toEqual(makePuzzle(3, 12345).hm.h)
    q.dispose()
  })
})

describe('EndlessQueue jobs', () => {
  it('keepsSpecJob', async () => {
    const { endless } = await load()
    const f = fakeWorkers()
    const q = new endless.EndlessQueue('3x3x2s', f.make)
    expect(f.all[0].inbox.every(m => m.job === '3x3x2s')).toBe(true)
    f.flush()
    const r = await q.next(), want = makeJob('3x3x2s', r.seed)
    expect(r.ramps.length).toBeGreaterThan(0)
    expect([r.hm.cols, r.hm.rows, r.hm.h, r.ramps]).toEqual([3, 3, want.hm.h, toEntryRamps(want.ramps)])
    q.dispose()
  }, 60_000)

  it('levelJobIsMakePuzzle', () => {
    expect(makeJob('2', 99).hm.h).toEqual(makePuzzle(2, 99).hm.h)
    expect(makeJob('2', 99).ramps).toEqual([])
  })
})

describe('endless screen', () => {
  it('new → records the seed, opens the puzzle; leaving stops the worker', async () => {
    const { endless, storage } = await load()
    const f = fakeWorkers()
    let root = sized()
    location.hash = '#/endless/1/new'
    let s = await endless.mountEndless(root, '1', 'new', f.make)
    expect(root.textContent).toContain('Generating…')
    f.flush()
    await vi.waitFor(() => expect(location.hash).toMatch(/^#\/endless\/1\/\d+$/))
    const seed = +location.hash.split('/')[3]
    expect((await storage.loadProgress()).endlessSeeds[1]).toEqual([seed])
    s.destroy()
    expect(f.all[0].terminated).toBe(false) // still in endless level 1: the queue stays
    root = sized()
    s = await endless.mountEndless(root, '1', String(seed), f.make)
    await vi.waitFor(() => expect(root.querySelector('.vp')).toBeTruthy()) // from memory, no worker round trip
    expect(root.textContent).toContain('Level 1')
    expect(root.textContent).toContain('Endless')
    location.hash = '#/levels/views'
    s.destroy()
    expect(f.all[0].terminated).toBe(true)
    expect(root.children.length).toBe(0)
  })

  it('worker error rejects the wait and shows a message', async () => {
    const { endless } = await load()
    const f = fakeWorkers()
    const root = sized()
    const s = await endless.mountEndless(root, '3', 'new', f.make)
    ;(f.all[0] as unknown as { onerror: () => void }).onerror()
    await vi.waitFor(() => expect(root.textContent).toContain('Could not generate'))
    s.destroy()
  })

  it('level 6 left mid-generation: worker stops, reopening level 2 shows level 2', async () => {
    const { endless } = await load()
    const f = fakeWorkers()
    const root = sized()
    location.hash = '#/endless/6/new'
    const s6 = await endless.mountEndless(root, '6', 'new', f.make)
    const cancel = [...root.querySelectorAll('button')].find(b => b.textContent === 'Cancel')!
    cancel.click()
    expect(location.hash).toBe('#/levels/views')
    s6.destroy() // what the router does on hashchange
    expect(f.all[0].terminated).toBe(true)
    location.hash = '#/endless/2/new'
    const s2 = await endless.mountEndless(root, '2', 'new', f.make)
    expect(f.all.length).toBe(2)
    f.flush()
    await vi.waitFor(() => expect(location.hash).toMatch(/^#\/endless\/2\/\d+$/))
    s2.destroy()
  })
})

describe('endless size specs (round 4)', () => {
  it('specRouteOpensShape', async () => {
    const { endless, storage } = await load()
    const f = fakeWorkers()
    const root = sized()
    location.hash = '#/endless/3x3x2s/new'
    const s = await endless.mountEndless(root, '3x3x2s', 'new', f.make)
    expect(f.all[0].inbox.every(m => m.job === '3x3x2s')).toBe(true)
    f.flush()
    await vi.waitFor(() => expect(location.hash).toMatch(/^#\/endless\/3x3x2s\/\d+$/))
    const seed = +location.hash.split('/')[3]
    expect((await storage.loadProgress()).endlessSeeds['3x3x2s']).toEqual([seed])
    s.destroy()
    const s2 = await endless.mountEndless(root, '3x3x2s', String(seed), f.make)
    await vi.waitFor(() => expect(root.querySelector('.vp')).toBeTruthy())
    expect(root.textContent).toContain('Endless, 3×3×2, slopes')
    location.hash = '#/levels/views'
    s2.destroy()
  }, 60_000)

  it('specColdOpenAsksForThatSeed', async () => {
    const { endless } = await load()
    const f = fakeWorkers()
    const root = sized()
    location.hash = '#/endless/4x3x2/777'
    const s = await endless.mountEndless(root, '4x3x2', '777', f.make)
    expect(f.all[0].inbox.some(m => m.job === '4x3x2' && m.seed === 777)).toBe(true)
    f.flush()
    await vi.waitFor(() => expect(root.querySelector('.vp')).toBeTruthy())
    expect(root.textContent).toContain('Endless, 4×3×2')
    location.hash = '#/levels/views'
    s.destroy()
  })

  it('slowHintAfter10s', async () => {
    const { endless } = await load()
    const f = fakeWorkers()
    const root = sized()
    location.hash = '#/endless/6x6x6/new'
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const s = await endless.mountEndless(root, '6x6x6', 'new', f.make)
      expect(root.textContent).not.toContain('smaller size')
      vi.advanceTimersByTime(endless.SLOW_MS)
      expect(root.textContent).toContain('No puzzle yet. A smaller size is faster.')
      expect(root.querySelector('a[href="#/levels/views"]')?.textContent).toBe('Pick a smaller size')
      location.hash = '#/levels/views'
      s.destroy()
      expect(vi.getTimerCount()).toBe(0)
    } finally { vi.useRealTimers() }
  })

  it('oldLevelRouteNeverServesUsedSeed', async () => {
    const seeds = [41, 42, 43, 44, 45]
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(a => { (a as Uint32Array)[0] = seeds.shift()!; return a })
    const { endless, storage } = await load()
    await storage.saveProgress({ solved: [], netsRight: 0, endlessSeeds: { 2: [41] } })
    const f = fakeWorkers()
    const root = sized()
    location.hash = '#/endless/2/new'
    const s = await endless.mountEndless(root, '2', 'new', f.make)
    const asked = f.all[0].inbox.map(m => [m.job, m.seed])
    expect(asked.length).toBeGreaterThan(0)
    expect(asked).not.toContainEqual(['2', 41])
    expect(asked.every(([job]) => job === '2')).toBe(true)
    location.hash = '#/levels/views'
    s.destroy()
  })

  it('routerRefusesBadSpec', async () => {
    const { startRouter, navigate } = await import('../../src/ui/router')
    const root = sized()
    navigate('/endless/9x9x9/new')
    const stop = startRouter(root, { version: 1, puzzles: [] })
    await vi.waitFor(() => expect(root.textContent).toContain('not built yet')) // no route matches
    navigate('/endless/3x3x3s/new')
    await vi.waitFor(() => expect(root.textContent).toContain('Puzzle not found'))
    stop()
  })
})
