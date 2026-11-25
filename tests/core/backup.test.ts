import { describe, expect, it } from 'vitest'
import { parseBackup, type Backup } from '../../src/core/backup'

const good: Backup = {
  app: 'isocube', version: 2, exportedAt: '2026-11-24T00:00:00.000Z',
  progress: { solved: ['V1-1', 'E2-5'], netsRight: 2, endlessSeeds: { 2: [5, 6] } },
  settings: { theme: 'dark', accent: 'mint', unlockAll: true, style: 'paper', lineWidth: 'normal', lives: true },
  drawings: { 'views/V1-1': { lines: ['a', 'b'], fills: { t1: 2 } } },
  lives: { 'sections/1/5': { left: 2, revealed: false } }, sectionSeeds: { 1: [42] }, last: { kind: 'sections', level: 1, route: '#/sections/1' },
}

describe('parseBackup', () => {
  it('round-trips', () => {
    const r = parseBackup(JSON.stringify(good))
    expect(r).toEqual({ ok: true, backup: good })
  })
  it('old backup without style imports as paper', () => {
    const { style: _s, ...old } = good.settings
    const r = parseBackup(JSON.stringify({ ...good, settings: old }))
    expect(r).toEqual({ ok: true, backup: good })
  })
  it('old backup without lineWidth imports as normal', () => {
    const { lineWidth: _w, ...old } = good.settings
    expect(parseBackup(JSON.stringify({ ...good, settings: old }))).toEqual({ ok: true, backup: good })
  })
  it('rejects an invalid lineWidth', () => {
    expect(parseBackup(JSON.stringify({ ...good, settings: { ...good.settings, lineWidth: 'huge' } })).ok).toBe(false)
  })
  it('rejects bad input with a message', () => {
    const bad = (o: unknown) => parseBackup(typeof o === 'string' ? o : JSON.stringify(o))
    const cases: unknown[] = [
      'not json', '[]', 'null',
      { ...good, app: 'other' }, { ...good, version: 3 }, { ...good, version: 0 },
      { ...good, lives: { k: { left: 4, revealed: false } } }, { ...good, lives: { k: { left: 1 } } }, { ...good, lives: [] },
      { ...good, sectionSeeds: { 1: ['a'] } }, { ...good, sectionSeeds: [] }, { ...good, last: { kind: 'x' } },
      { ...good, exportedAt: 5 }, { ...good, progress: undefined },
      { ...good, progress: { ...good.progress, solved: [1] } },
      { ...good, progress: { ...good.progress, netsRight: 'x' } },
      { ...good, progress: { ...good.progress, endlessSeeds: { 1: ['a'] } } },
      { ...good, settings: { ...good.settings, theme: 'pink' } },
      { ...good, settings: { ...good.settings, accent: 'blue' } },
      { ...good, settings: { ...good.settings, unlockAll: 1 } },
      { ...good, settings: { ...good.settings, style: 'neon' } },
      { ...good, drawings: { k: { lines: [1], fills: {} } } },
      { ...good, drawings: { k: { lines: [], fills: { t: 'x' } } } },
      { ...good, drawings: { k: { lines: [] } } },
    ]
    for (const c of cases) {
      const r = bad(c)
      expect(r.ok, JSON.stringify(c)).toBe(false)
      if (!r.ok) expect(r.error.length).toBeGreaterThan(5)
    }
  })
})

describe('lives setting in backups', () => {
  it('old backup without lives imports as on', () => {
    const { lives: _l, ...old } = { ...good.settings, lives: false } as typeof good.settings & { lives: boolean }
    const r = parseBackup(JSON.stringify({ ...good, settings: old }))
    expect(r.ok && r.backup.settings.lives).toBe(true)
  })
  it('rejects a non-boolean lives', () => {
    expect(parseBackup(JSON.stringify({ ...good, settings: { ...good.settings, lives: 'yes' } })).ok).toBe(false)
  })
})

describe('backup v2', () => {
  it('v1BackupImports', () => {
    const { lives: _l, sectionSeeds: _s, last: _t, ...v1 } = good
    const r = parseBackup(JSON.stringify({ ...v1, version: 1 }))
    expect(r.ok && r.backup).toEqual({ ...v1, version: 1, lives: {}, sectionSeeds: {} })
  })
  it('v2RoundTrip', () => {
    expect(parseBackup(JSON.stringify(good))).toEqual({ ok: true, backup: good })
  })
})
