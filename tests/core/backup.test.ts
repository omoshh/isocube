import { describe, expect, it } from 'vitest'
import { parseBackup, type Backup } from '../../src/core/backup'

const good: Backup = {
  app: 'isocube', version: 1, exportedAt: '2026-11-24T00:00:00.000Z',
  progress: { solved: ['V1-1', 'E2-5'], netsRight: 2, endlessSeeds: { 2: [5, 6] } },
  settings: { theme: 'dark', accent: 'mint', unlockAll: true, style: 'paper', lineWidth: 'normal' },
  drawings: { 'views/V1-1': { lines: ['a', 'b'], fills: { t1: 2 } } },
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
      { ...good, app: 'other' }, { ...good, version: 2 },
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
