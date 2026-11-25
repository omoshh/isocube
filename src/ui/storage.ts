import { del, get, keys, set } from 'idb-keyval'
import { parseBackup, type Backup } from '../core/backup'
import { START, type LivesState } from '../core/lives'
import type { Drawing } from '../core/drawing'
import type { Progress, Settings } from '../core/unlocks'

const DEBOUNCE_MS = 300
const DRAW_PREFIXES = ['views/', 'reverse/', 'draw/', 'endless/', 'shadow/']

// Every write is mirrored in `mem`. If any IndexedDB call fails (private window, quota),
// `idbOk` goes false for the session and `mem` serves everything.
const mem = new Map<string, unknown>()
let idbOk = true

async function run<T>(op: () => Promise<T>, fallback: () => T): Promise<T> {
  if (idbOk) {
    try { return await op() } catch { idbOk = false }
  }
  return fallback()
}

const rawGet = <T>(k: string) => run(() => get<T>(k), () => mem.get(k) as T | undefined)
const rawSet = (k: string, v: unknown) => { mem.set(k, v); return run(() => set(k, v), () => {}) }
const rawDel = (k: string) => { mem.delete(k); return run(() => del(k), () => {}) }
const rawKeys = () => run(async () => (await keys()).map(String), () => [...mem.keys()])

const pending = new Map<string, { d: Drawing; timer: ReturnType<typeof setTimeout> }>()

export async function flush(): Promise<void> {
  const items = [...pending.entries()]
  pending.clear()
  await Promise.all(items.map(([k, { d, timer }]) => { clearTimeout(timer); return rawSet(k, d) }))
}

export function saveDrawing(key: string, d: Drawing): void {
  const old = pending.get(key)
  if (old) clearTimeout(old.timer)
  mem.set(key, d) // keeps the value even if the debounced write later fails
  pending.set(key, { d, timer: setTimeout(() => {
    pending.delete(key)
    void rawSet(key, d)
  }, DEBOUNCE_MS) })
}

export async function loadDrawing(key: string): Promise<Drawing | undefined> {
  return pending.get(key)?.d ?? rawGet<Drawing>(key)
}

export async function listDrawings(prefix: string): Promise<string[]> {
  const all = new Set((await rawKeys()).filter(k => k.startsWith(prefix)))
  for (const k of pending.keys()) if (k.startsWith(prefix)) all.add(k)
  return [...all].sort()
}

export async function deleteDrawing(key: string): Promise<void> {
  const p = pending.get(key)
  if (p) { clearTimeout(p.timer); pending.delete(key) }
  await rawDel(key)
}

const DEFAULT_PROGRESS = (): Progress => ({ solved: [], netsRight: 0, endlessSeeds: {} })
const DEFAULT_SETTINGS = (): Settings => ({ theme: 'system', accent: 'yellow', unlockAll: false, style: 'paper', lineWidth: 'normal', lives: true })

export const loadProgress = async () => (await rawGet<Progress>('progress')) ?? DEFAULT_PROGRESS()
export const saveProgress = (p: Progress) => rawSet('progress', p)
// R13: every progress write goes through this chain, so overlapping read-modify-writes keep each other's changes.
let progressChain: Promise<unknown> = Promise.resolve()
export function updateProgress(fn: (p: Progress) => Progress): Promise<Progress> {
  const r = progressChain.then(async () => { const p = fn(await loadProgress()); await saveProgress(p); return p })
  progressChain = r.catch(() => {})
  return r
}
/** The puzzle screen opened last, for Home's Continue pill. n = number in its list (none for endless and Nets). */
const KINDS = ['views', 'reverse', 'nets', 'shadows'] as const // Sections removed for now (branch `sections`)
export type LastPuzzle = { kind: (typeof KINDS)[number]; level: number; n?: number; route: string }
export const saveLast = (l: LastPuzzle) => rawSet('last', l)
export async function loadLast(): Promise<LastPuzzle | undefined> {
  const l = await rawGet<LastPuzzle>('last')
  const ok = !!l && (KINDS as readonly string[]).includes(l.kind) && Number.isInteger(l.level) && typeof l.route === 'string' && l.route.startsWith('#/') && (l.n === undefined || Number.isInteger(l.n))
  return ok ? l : undefined
}
export const loadSettings = async (): Promise<Settings> => ({ ...DEFAULT_SETTINGS(), ...(await rawGet<Settings>('settings')) })
export const saveSettings = (s: Settings) => rawSet('settings', s)

// Own prefix, not in DRAW_PREFIXES: the backup carries lives in their own field.
const LIVES = 'lives/'
export async function loadLives(key: string): Promise<LivesState> {
  const v = await rawGet<LivesState>(LIVES + key)
  return v && [0, 1, 2, 3].includes(v.left) && typeof v.revealed === 'boolean' ? v : START
}
export const saveLives = (key: string, s: LivesState) => rawSet(LIVES + key, s)

export async function storageAvailable(): Promise<boolean> {
  await rawSet('__probe', 1); await rawDel('__probe')
  return idbOk
}

const drawingKeys = async () => (await rawKeys()).filter(k => DRAW_PREFIXES.some(p => k.startsWith(p)))

const SECTION_LEVELS = [1, 2, 3]
const readSectionSeed = (level: number): number | undefined => {
  try { const r = JSON.parse(localStorage.getItem('sections/' + level) ?? 'null'); return Number.isInteger(r?.seed) ? r.seed : undefined } catch { return undefined }
}

export async function exportBackup(): Promise<string> {
  await flush()
  const drawings: Record<string, Drawing> = {}
  for (const k of await drawingKeys()) { const d = await rawGet<Drawing>(k); if (d) drawings[k] = d }
  const lives: Record<string, LivesState> = {}
  for (const k of (await rawKeys()).filter(k => k.startsWith(LIVES))) { const v = await loadLives(k.slice(LIVES.length)); lives[k.slice(LIVES.length)] = v }
  const sectionSeeds: Record<number, number[]> = {}
  for (const l of SECTION_LEVELS) { const sd = readSectionSeed(l); if (sd !== undefined) sectionSeeds[l] = [sd] }
  const last = await loadLast()
  const b: Backup = { app: 'isocube', version: 3, exportedAt: new Date().toISOString(), progress: await loadProgress(), settings: await loadSettings(), drawings, lives, sectionSeeds, ...(last ? { last } : {}) }
  return JSON.stringify(b)
}

export async function importBackup(text: string): Promise<{ ok: boolean; error?: string }> {
  const r = parseBackup(text)
  if (!r.ok) return { ok: false, error: r.error } // nothing written
  const { backup } = r
  await flush()
  const wasOk = idbOk
  const stale = (await drawingKeys()).filter(k => !(k in backup.drawings))
  // A v1 backup has no lives, so it must not wipe them: only a v2 import replaces them.
  if (backup.version >= 2) stale.push(...(await rawKeys()).filter(k => k.startsWith(LIVES) && !(k.slice(LIVES.length) in backup.lives)))
  // New data first, stale deletes last: a failure midway never leaves old data deleted.
  for (const [k, d] of Object.entries(backup.drawings)) await rawSet(k, d)
  for (const [k, v] of Object.entries(backup.lives)) await rawSet(LIVES + k, v)
  for (const [l, seeds] of Object.entries(backup.sectionSeeds)) if (seeds.length) {
    try {
      if (JSON.parse(localStorage.getItem('sections/' + l) ?? 'null')?.seed === seeds[0]) continue // same puzzle already here: keep answered/wrong/guessed
      localStorage.setItem('sections/' + l, JSON.stringify({ seed: seeds[0], answered: false, pick: -1 })) } catch { /* in-memory only */ }
  }
  if (backup.last) await saveLast(backup.last as LastPuzzle)
  await updateProgress(() => backup.progress)
  await saveSettings(backup.settings)
  if (wasOk && !idbOk) return { ok: false, error: 'Storage failed while importing. The backup was not saved permanently.' }
  for (const k of stale) await rawDel(k)
  if (backup.version < 3) await deleteOldPuzzleData() // a backup from before round 3 brings old puzzle data back
  return { ok: true }
}

// Round 3 regenerated every Views/Reverse/Shadows puzzle and dropped Classic: data saved for the old ones is deleted.
const OLD_ID = /^(R-|S\d-)?(L|RL)\d-\d{3}$|^(R-)?C-\d{3}$/
const OLD_KEY = ['views/L', 'views/C', 'reverse/RL', 'reverse/C', 'shadow/']
const OLD_ROUTE = ['#/views/L', '#/views/C', '#/reverse/RL', '#/reverse/C', '#/shadows/']
const PUZZLE_SET = 3

async function deleteOldPuzzleData() {
  await flush()
  await updateProgress(p => ({ ...p, solved: p.solved.filter(id => !OLD_ID.test(id)) }))
  for (const k of await rawKeys()) {
    const key = k.startsWith(LIVES) ? k.slice(LIVES.length) : k
    if (OLD_KEY.some(o => key.startsWith(o))) await rawDel(k)
  }
  const last = await rawGet<LastPuzzle>('last')
  if (last && OLD_ROUTE.some(r => String(last.route).startsWith(r))) await rawDel('last')
}

/** Once per device: deletes data of the puzzles from before round 3. */
export async function purgeOldPuzzles(): Promise<void> {
  if ((await rawGet<number>('puzzleSet')) === PUZZLE_SET) return
  await deleteOldPuzzleData()
  await rawSet('puzzleSet', PUZZLE_SET)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flush() })
  window.addEventListener('pagehide', () => { void flush() })
}
