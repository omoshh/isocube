// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const d = (n: number) => ({ lines: ['s' + n], fills: { t: n } })
const load = () => import('../../src/ui/storage')

beforeEach(() => { vi.resetModules(); vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); indexedDB = new IDBFactory() })
afterEach(() => { vi.useRealTimers(); vi.doUnmock('idb-keyval') })

describe('storage', () => {
  it('defaults', async () => {
    const s = await load()
    expect(await s.loadProgress()).toEqual({ solved: [], netsRight: 0, endlessSeeds: {} })
    expect(await s.loadSettings()).toEqual({ theme: 'system', accent: 'yellow', unlockAll: false, style: 'paper', lineWidth: 'normal', lives: true })
    expect(await s.storageAvailable()).toBe(true)
  })

  it('debounces, returns pending, lists, deletes', async () => {
    const s = await load()
    s.saveDrawing('views/a', d(1))
    expect(await s.loadDrawing('views/a')).toEqual(d(1)) // pending
    s.saveDrawing('draw/x', d(2))
    expect((await s.listDrawings('views/'))).toEqual(['views/a'])
    await s.deleteDrawing('views/a')
    expect(await s.loadDrawing('views/a')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(400)
    expect(await s.loadDrawing('views/a')).toBeUndefined()
    expect(await s.loadDrawing('draw/x')).toEqual(d(2))
  })

  it('flushOnHide', async () => {
    const idb = await import('idb-keyval')
    const s = await load()
    s.saveDrawing('views/a', d(1))
    expect(await idb.get('views/a')).toBeUndefined()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(await idb.get('views/a')).toEqual(d(1))
    s.saveDrawing('views/b', d(2))
    window.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(0)
    expect(await idb.get('views/b')).toEqual(d(2))
  })

  it('old settings without style load as paper', async () => {
    const s = await load()
    await s.saveSettings({ theme: 'dark', accent: 'mint', unlockAll: true } as never)
    expect(await s.loadSettings()).toEqual({ theme: 'dark', accent: 'mint', unlockAll: true, style: 'paper', lineWidth: 'normal', lives: true })
  })

  it('backupRoundTrip', async () => {
    const s = await load()
    await s.saveProgress({ solved: ['V1-1'], netsRight: 1, endlessSeeds: { 3: [9] } })
    await s.saveSettings({ theme: 'light', accent: 'pink', unlockAll: true, style: 'paper', lineWidth: 'normal', lives: true })
    s.saveDrawing('views/a', d(1)); s.saveDrawing('endless/3/9', d(2))
    const text = await s.exportBackup()
    expect(JSON.parse(text)).toMatchObject({ app: 'isocube', version: 2 })
    await s.deleteDrawing('views/a'); await s.saveProgress({ solved: [], netsRight: 0, endlessSeeds: {} })
    s.saveDrawing('draw/extra', d(5))
    expect(await s.importBackup(text)).toEqual({ ok: true })
    expect((await s.loadProgress()).solved).toEqual(['V1-1'])
    expect((await s.loadSettings()).accent).toBe('pink')
    expect(await s.loadDrawing('views/a')).toEqual(d(1))
    expect(await s.loadDrawing('draw/extra')).toBeUndefined()
  })

  it('v2 import restores lives, section seeds and the Continue record, replacing stale lives', async () => {
    const s = await load()
    await s.saveLives('shadow/2/a', { left: 1, revealed: false })
    await s.saveLast({ kind: 'sections', level: 2, route: '#/sections/2' })
    localStorage.setItem('sections/2', JSON.stringify({ seed: 77, answered: true, pick: 1 }))
    const text = await s.exportBackup()
    expect(JSON.parse(text)).toMatchObject({ lives: { 'shadow/2/a': { left: 1, revealed: false } }, sectionSeeds: { 2: [77] }, last: { route: '#/sections/2' } })
    await s.saveLives('shadow/2/a', { left: 3, revealed: false }); await s.saveLives('shadow/2/stale', { left: 0, revealed: true })
    await s.saveLast({ kind: 'nets', level: 1, route: '#/nets/1' })
    localStorage.setItem('sections/2', JSON.stringify({ seed: 1, answered: false, pick: -1 }))
    expect(await s.importBackup(text)).toEqual({ ok: true })
    expect(await s.loadLives('shadow/2/a')).toEqual({ left: 1, revealed: false })
    expect(await s.loadLives('shadow/2/stale')).toEqual({ left: 3, revealed: false }) // START: stale entry removed
    expect((await s.loadLast())?.route).toBe('#/sections/2')
    expect(JSON.parse(localStorage.getItem('sections/2')!).seed).toBe(77)
  })

  it('import keeps the local section record when the seed matches', async () => {
    const s = await load()
    localStorage.setItem('sections/2', JSON.stringify({ seed: 77, answered: false, pick: -1, wrong: [1], guessed: true }))
    const text = await s.exportBackup()
    expect(await s.importBackup(text)).toEqual({ ok: true })
    expect(JSON.parse(localStorage.getItem('sections/2')!)).toEqual({ seed: 77, answered: false, pick: -1, wrong: [1], guessed: true })
    localStorage.setItem('sections/2', JSON.stringify({ seed: 5, answered: true, pick: 0, guessed: true }))
    expect(await s.importBackup(text)).toEqual({ ok: true })
    expect(JSON.parse(localStorage.getItem('sections/2')!)).toEqual({ seed: 77, answered: false, pick: -1 })
  })

  it('v1 import keeps lives, Continue and section seeds', async () => {
    const s = await load()
    await s.saveLives('shadow/2/a', { left: 1, revealed: false })
    await s.saveLast({ kind: 'nets', level: 1, route: '#/nets/1' })
    const { lives: _l, sectionSeeds: _s, last: _t, ...v1 } = JSON.parse(await s.exportBackup())
    expect(await s.importBackup(JSON.stringify({ ...v1, version: 1 }))).toEqual({ ok: true })
    expect(await s.loadLives('shadow/2/a')).toEqual({ left: 1, revealed: false })
    expect((await s.loadLast())?.route).toBe('#/nets/1')
  })

  it('badBackupRejected leaves data untouched', async () => {
    const s = await load()
    await s.saveProgress({ solved: ['keep'], netsRight: 0, endlessSeeds: {} })
    s.saveDrawing('draw/k', d(1))
    const good = JSON.parse(await s.exportBackup())
    for (const bad of ['{nope', JSON.stringify({ ...good, app: 'x' }), JSON.stringify({ ...good, version: 3 }), JSON.stringify({ ...good, settings: undefined })]) {
      const r = await s.importBackup(bad)
      expect(r.ok).toBe(false)
      expect(r.error).toBeTruthy()
    }
    expect((await s.loadProgress()).solved).toEqual(['keep'])
    expect(await s.loadDrawing('draw/k')).toEqual(d(1))
  })

  it('storageFallback: failing IndexedDB keeps working in memory', async () => {
    vi.doMock('idb-keyval', () => {
      const fail = () => Promise.reject(new Error('QuotaExceededError'))
      return { get: fail, set: fail, del: fail, keys: fail }
    })
    const s = await load()
    await s.saveProgress({ solved: ['a'], netsRight: 0, endlessSeeds: {} })
    s.saveDrawing('draw/q', d(1))
    await s.flush()
    expect(await s.storageAvailable()).toBe(false)
    expect((await s.loadProgress()).solved).toEqual(['a'])
    expect(await s.loadDrawing('draw/q')).toEqual(d(1))
    expect(await s.listDrawings('draw/')).toEqual(['draw/q'])
  })

  it('import write failure reports ok:false and does not delete stale drawings', async () => {
    const store = new Map<string, unknown>()
    let failSet = false
    vi.doMock('idb-keyval', () => ({
      get: async (k: string) => store.get(k),
      set: async (k: string, v: unknown) => { if (failSet) throw new Error('QuotaExceededError'); store.set(k, v) },
      del: async (k: string) => { store.delete(k) },
      keys: async () => [...store.keys()],
    }))
    const s = await load()
    await s.saveProgress({ solved: ['old'], netsRight: 0, endlessSeeds: {} })
    s.saveDrawing('draw/stale', d(1)); await s.flush()
    const text = JSON.stringify({ app: 'isocube', version: 1, exportedAt: 'x', progress: { solved: ['new'], netsRight: 0, endlessSeeds: {} },
      settings: { theme: 'dark', accent: 'yellow', unlockAll: false }, drawings: { 'views/n': d(2) } })
    failSet = true
    const r = await s.importBackup(text)
    expect(r.ok).toBe(false)
    expect(r.error).toBeTruthy()
    expect(store.get('draw/stale')).toEqual(d(1))
    expect(store.get('progress')).toMatchObject({ solved: ['old'] })
  })

  it('updateProgress serialises overlapping updates', async () => {
    const s = await load()
    await Promise.all([
      s.updateProgress(p => ({ ...p, solved: [...p.solved, 'a'] })),
      s.updateProgress(p => ({ ...p, endlessSeeds: { ...p.endlessSeeds, 2: [7] } })),
    ])
    const p = await s.loadProgress() // idb-keyval keeps its store across tests, so check only these two changes
    expect(p.solved).toContain('a')
    expect(p.endlessSeeds[2]).toEqual([7])
  })
})
