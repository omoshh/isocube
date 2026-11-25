import { del, get, keys, set } from 'idb-keyval'
import { parseBackup, type Backup } from '../core/backup'
import type { Drawing } from '../core/drawing'
import type { Progress, Settings } from '../core/unlocks'

const DEBOUNCE_MS = 300
const DRAW_PREFIXES = ['views/', 'reverse/', 'draw/', 'endless/']

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
const DEFAULT_SETTINGS = (): Settings => ({ theme: 'system', accent: 'yellow', unlockAll: false, style: 'paper', lineWidth: 'normal' })

export const loadProgress = async () => (await rawGet<Progress>('progress')) ?? DEFAULT_PROGRESS()
export const saveProgress = (p: Progress) => rawSet('progress', p)
// R13: every progress write goes through this chain, so overlapping read-modify-writes keep each other's changes.
let progressChain: Promise<unknown> = Promise.resolve()
export function updateProgress(fn: (p: Progress) => Progress): Promise<Progress> {
  const r = progressChain.then(async () => { const p = fn(await loadProgress()); await saveProgress(p); return p })
  progressChain = r.catch(() => {})
  return r
}
/** The puzzle screen opened last, for Home's Continue pill. level 0 = Classic; n = number in its list (none for endless and Nets). */
const KINDS = ['views', 'reverse', 'nets'] as const
export type LastPuzzle = { kind: (typeof KINDS)[number]; level: number; n?: number; route: string }
export const saveLast = (l: LastPuzzle) => rawSet('last', l)
export async function loadLast(): Promise<LastPuzzle | undefined> {
  const l = await rawGet<LastPuzzle>('last')
  const ok = !!l && (KINDS as readonly string[]).includes(l.kind) && Number.isInteger(l.level) && typeof l.route === 'string' && l.route.startsWith('#/') && (l.n === undefined || Number.isInteger(l.n))
  return ok ? l : undefined
}
export const loadSettings = async (): Promise<Settings> => ({ ...DEFAULT_SETTINGS(), ...(await rawGet<Settings>('settings')) })
export const saveSettings = (s: Settings) => rawSet('settings', s)

export async function storageAvailable(): Promise<boolean> {
  await rawSet('__probe', 1); await rawDel('__probe')
  return idbOk
}

const drawingKeys = async () => (await rawKeys()).filter(k => DRAW_PREFIXES.some(p => k.startsWith(p)))

export async function exportBackup(): Promise<string> {
  await flush()
  const drawings: Record<string, Drawing> = {}
  for (const k of await drawingKeys()) { const d = await rawGet<Drawing>(k); if (d) drawings[k] = d }
  const b: Backup = { app: 'isocube', version: 1, exportedAt: new Date().toISOString(), progress: await loadProgress(), settings: await loadSettings(), drawings }
  return JSON.stringify(b)
}

export async function importBackup(text: string): Promise<{ ok: boolean; error?: string }> {
  const r = parseBackup(text)
  if (!r.ok) return { ok: false, error: r.error } // nothing written
  const { backup } = r
  await flush()
  const wasOk = idbOk
  const stale = (await drawingKeys()).filter(k => !(k in backup.drawings))
  // New data first, stale deletes last: a failure midway never leaves old data deleted.
  for (const [k, d] of Object.entries(backup.drawings)) await rawSet(k, d)
  await updateProgress(() => backup.progress)
  await saveSettings(backup.settings)
  if (wasOk && !idbOk) return { ok: false, error: 'Storage failed while importing. The backup was not saved permanently.' }
  for (const k of stale) await rawDel(k)
  return { ok: true }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flush() })
  window.addEventListener('pagehide', () => { void flush() })
}
