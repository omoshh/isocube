// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const probe = vi.hoisted(() => ({ ok: true }))
vi.mock('../../src/ui/storage', async orig => ({ ...(await orig<typeof import('../../src/ui/storage')>()), storageAvailable: async () => probe.ok }))

import { mountAccents } from '../../src/ui/screens/accents'
import { mountSettings } from '../../src/ui/screens/settings'
import { loadSettings, saveSettings, updateProgress } from '../../src/ui/storage'

const root = () => document.getElementById('root')!
const row = (id: string) => root().querySelector<HTMLElement>(`[data-accent="${id}"]`)!
const tick = () => new Promise(r => setTimeout(r, 20))

beforeEach(async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  document.body.innerHTML = '<div id="root"></div>'
  document.documentElement.removeAttribute('style')
  probe.ok = true
  await saveSettings({ theme: 'system', accent: 'yellow', unlockAll: false, style: 'paper' })
  await updateProgress(() => ({ solved: [], netsRight: 0, endlessSeeds: {} }))
})

describe('settings and accents', () => {
  it('lockedAccentNotSelectable', async () => {
    await mountAccents(root())
    expect(row('mint').getAttribute('aria-disabled')).toBe('true')
    row('mint').click(); await tick()
    expect((await loadSettings()).accent).toBe('yellow')
  })

  it('style row sets and saves the style', async () => {
    await mountSettings(root())
    const btns = [...root().querySelectorAll<HTMLElement>('[data-style-btn]')]
    expect(btns.map(b => b.textContent)).toEqual(['Paper', 'Blueprint', 'Concrete'])
    expect(btns[0].getAttribute('aria-pressed')).toBe('true')
    btns[2].click(); await tick()
    expect((await loadSettings()).style).toBe('concrete')
    expect(document.documentElement.dataset.style).toBe('concrete')
    expect(btns.map(b => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
  })

  it('accent picker hides red in Blueprint dark; saved red survives', async () => {
    await saveSettings({ theme: 'dark', accent: 'red', unlockAll: true, style: 'blueprint' })
    document.documentElement.dataset.theme = 'dark' // applyTheme has run at boot
    await mountAccents(root())
    expect(root().querySelector('[data-accent="red"]')).toBeNull()
    expect(row('mint')).not.toBeNull()
    expect((await loadSettings()).accent).toBe('red')
  })

  it('unlockAllUnlocks', async () => {
    await mountSettings(root())
    const sw = root().querySelector<HTMLElement>('[role="switch"]')!
    expect(sw.getAttribute('aria-checked')).toBe('false')
    sw.click(); await tick()
    expect(sw.getAttribute('aria-checked')).toBe('true')
    expect((await loadSettings()).unlockAll).toBe(true)
    root().innerHTML = ''
    await mountAccents(root())
    expect(row('sand').getAttribute('aria-disabled')).toBe(null)
  })

  it('accentChangesCheckColour', async () => {
    await saveSettings({ theme: 'system', accent: 'yellow', unlockAll: true, style: 'paper' })
    await mountAccents(root())
    row('mint').click(); await tick()
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('var(--accent-mint)')
    expect((await loadSettings()).accent).toBe('mint')
  })

  it('accentFallsBackToYellowWhenRelocked', async () => {
    await saveSettings({ theme: 'system', accent: 'sand', unlockAll: true, style: 'paper' })
    await mountSettings(root())
    root().querySelector<HTMLElement>('[role="switch"]')!.click(); await tick()
    expect(await loadSettings()).toMatchObject({ unlockAll: false, accent: 'yellow' })
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('var(--accent-yellow)')
  })

  it('importBadFileShowsError', async () => {
    await mountSettings(root())
    const input = root().querySelector<HTMLInputElement>('input[type="file"]')!
    const file = new File(['not json'], 'x.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file] })
    input.dispatchEvent(new Event('change')); await tick()
    expect(root().querySelector('[data-msg]')!.textContent!.length).toBeGreaterThan(0)
    expect(root().querySelector('[data-msg]')!.getAttribute('data-ok')).toBe('false')
  })

  it('importUnreadableFileShowsErrorAndResets', async () => {
    await mountSettings(root())
    const input = root().querySelector<HTMLInputElement>('input[type="file"]')!
    const file = { text: () => Promise.reject(new Error('boom')) } as unknown as File
    Object.defineProperty(input, 'files', { value: [file] })
    input.dispatchEvent(new Event('change')); await tick()
    expect(root().querySelector('[data-msg]')!.textContent).toBe('boom')
  })

  it('storageWarningShown', async () => {
    probe.ok = false
    await mountSettings(root())
    expect(root().querySelector('[data-storage-warning]')).not.toBeNull()
    root().innerHTML = ''; probe.ok = true
    await mountSettings(root())
    expect(root().querySelector('[data-storage-warning]')).toBeNull()
  })
})
