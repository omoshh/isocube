// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACCENTS } from '../../src/core/unlocks'
import { ACCENT_HEX, applyTheme, onAccent } from '../../src/ui/theme'

const css = readFileSync('src/ui/styles/tokens.css', 'utf8')
const block = (sel: string) => {
  const m = css.match(new RegExp(`${sel.replace(/[[\]"]/g, '\\$&')}\\s*\\{([^}]*)\\}`))
  if (!m) throw new Error('no block ' + sel)
  return m[1]
}
const tok = (b: string, name: string) => b.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim()
const light = block(':root[data-theme="light"]')
const dark = block(':root[data-theme="dark"]')
const root = block(':root')

const lum = (hex: string) => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe('tokens', () => {
  it('tokensMatchDesignSystem', () => {
    expect(tok(light, 'bg')).toBe('#F5F2EA')
    expect(tok(dark, 'bg')).toBe('#121214')
    expect(tok(light, 'mark-mistake')).toBe('#E4572E')
    expect(tok(dark, 'tone-3')).toBe('#ECEAE4')
    expect(tok(root, 'radius-button')).toBe('24px')
  })
  it('accent table mirrors tokens.css', () => {
    for (const a of ACCENTS) expect(ACCENT_HEX[a.id]).toBe(tok(root, 'accent-' + a.id))
  })
  it('onAccentContrast', () => {
    // Design-system red #E5383B tops out at 4.26:1 with either ink (needs a design decision); it must still pass 3:1 (bold/large text).
    for (const a of ACCENTS)
      expect(contrast(onAccent(ACCENT_HEX[a.id]), ACCENT_HEX[a.id])).toBeGreaterThanOrEqual(a.id === 'red' ? 3 : 4.5)
    expect(onAccent('#FFD23F')).toBe('#16161A')
    expect(onAccent('#000000')).toBe('#FFFFFF')
  })
  it('marksNotAccents', () => {
    const accents = Object.values(ACCENT_HEX).map(h => h.toUpperCase())
    for (const b of [light, dark])
      for (const m of ['mark-missing', 'mark-mistake']) expect(accents).not.toContain(tok(b, m)!.toUpperCase())
  })
})

describe('applyTheme', () => {
  const base = { theme: 'system' as const, accent: 'mint' as const, unlockAll: false }
  afterEach(() => vi.unstubAllGlobals())
  it('sets accent vars and explicit theme', () => {
    applyTheme({ ...base, theme: 'dark' })
    const el = document.documentElement
    expect(el.dataset.theme).toBe('dark')
    expect(el.style.getPropertyValue('--accent')).toBe('var(--accent-mint)')
    expect(el.style.getPropertyValue('--on-accent')).toBe(onAccent(ACCENT_HEX.mint))
  })
  it('systemThemeFollows', () => {
    let fire = () => {}
    const mq = { matches: false, addEventListener: (_: string, f: () => void) => { fire = f }, removeEventListener: vi.fn() }
    vi.stubGlobal('matchMedia', () => mq)
    applyTheme(base)
    expect(document.documentElement.dataset.theme).toBe('light')
    mq.matches = true
    fire()
    expect(document.documentElement.dataset.theme).toBe('dark')
    applyTheme({ ...base, theme: 'light' })
    expect(mq.removeEventListener).toHaveBeenCalled()
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
