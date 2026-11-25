import type { Drawing } from './drawing'
import { ACCENTS, STYLES, type Progress, type Settings } from './unlocks'

export type Backup = { app: 'isocube'; version: 1; exportedAt: string; progress: Progress; settings: Settings; drawings: Record<string, Drawing> }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const strs = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string')
const nums = (v: unknown): v is number[] => Array.isArray(v) && v.every(x => typeof x === 'number' && Number.isFinite(x))

export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error })
  let b: unknown
  try { b = JSON.parse(text) } catch { return fail('This file is not valid JSON.') }
  if (!isObj(b) || b.app !== 'isocube') return fail('This is not an Isocube backup file.')
  if (b.version !== 1) return fail('This backup has an unsupported version.')
  if (typeof b.exportedAt !== 'string') return fail('The backup date is missing.')

  const p = b.progress
  if (!isObj(p)) return fail('The progress data is missing.')
  if (!strs(p.solved)) return fail('The solved list is invalid.')
  if (typeof p.netsRight !== 'number' || !Number.isFinite(p.netsRight)) return fail('The nets counter is invalid.')
  if (!isObj(p.endlessSeeds) || !Object.values(p.endlessSeeds).every(nums)) return fail('The endless seeds are invalid.')

  const s = b.settings
  if (!isObj(s)) return fail('The settings are missing.')
  if (s.theme !== 'system' && s.theme !== 'light' && s.theme !== 'dark') return fail('The theme setting is invalid.')
  if (!ACCENTS.some(a => a.id === s.accent)) return fail('The accent setting is invalid.')
  if (s.style === undefined) s.style = 'paper' // backups from before styles
  if (!STYLES.includes(s.style as never)) return fail('The style setting is invalid.')
  if (typeof s.unlockAll !== 'boolean') return fail('The unlock-all setting is invalid.')

  if (!isObj(b.drawings)) return fail('The drawings are missing.')
  for (const [k, d] of Object.entries(b.drawings)) {
    if (!isObj(d) || !strs(d.lines) || !isObj(d.fills) || !Object.values(d.fills).every(v => typeof v === 'number') || (d.name !== undefined && typeof d.name !== 'string'))
      return fail(`The drawing "${k}" is invalid.`)
  }
  return { ok: true, backup: b as unknown as Backup }
}
