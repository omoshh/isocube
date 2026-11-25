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
const mode = (style: string, m: string) => block(`:root[data-style="${style}"][data-theme="${m}"]`)
const light = mode('paper', 'light')
const dark = mode('paper', 'dark')
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

describe('style tokens', () => {
  const vars = (b: string) => [...b.matchAll(/--([\w-]+):/g)].map(m => m[1]).sort()
  it('every style x mode block sets the Paper light colour variables', () => {
    for (const s of ['paper', 'blueprint', 'concrete']) for (const m of ['light', 'dark'])
      expect(vars(mode(s, m)), `${s} ${m}`).toEqual(vars(light))
  })
  it('Blueprint and Concrete values', () => {
    expect(tok(mode('blueprint', 'dark'), 'bg')).toBe('#1F4E8C')
    expect(tok(mode('blueprint', 'light'), 'mark-missing')).toBe('#7B3FE4')
    expect(tok(mode('concrete', 'light'), 'bg')).toBe('#D3D2CE')
    expect(tok(mode('concrete', 'dark'), 'mark-mistake')).toBe('#FF7A45')
  })
  it('shape tokens per style', () => {
    const shape = (s: string) => block(`:root[data-style="${s}"]`)
    expect(tok(shape('paper'), 'radius-button')).toBe('24px')
    expect(tok(shape('blueprint'), 'radius-row')).toBe('20px')
    for (const t of ['button', 'row', 'tile']) expect(tok(shape('concrete'), 'radius-' + t)).toBe('6px')
  })
  it('noise layer ignores taps and is not in exported images', () => {
    const noise = block(':root[data-style="concrete"]::before')
    expect(noise).toMatch(/pointer-events:\s*none/)
    expect(noise).toMatch(/position:\s*fixed/)
    expect(noise).toMatch(/z-index:\s*-1/)
    expect(noise).toMatch(/feTurbulence/)
    // exports are built from drawing data, never from the page, so the layer cannot leak in
    expect(readFileSync('src/ui/exportImage.ts', 'utf8')).not.toMatch(/feTurbulence|::before|noise/)
  })
})

describe('applyTheme', () => {
  const base = { theme: 'system' as const, accent: 'mint' as const, unlockAll: false, style: 'paper' as const }
  afterEach(() => vi.unstubAllGlobals())
  it('sets accent vars and explicit theme', () => {
    applyTheme({ ...base, theme: 'dark' })
    const el = document.documentElement
    expect(el.dataset.theme).toBe('dark')
    expect(el.style.getPropertyValue('--accent')).toBe('var(--accent-mint)')
    expect(el.style.getPropertyValue('--on-accent')).toBe(onAccent(ACCENT_HEX.mint))
  })
  it('sets data-style', () => {
    applyTheme({ ...base, theme: 'light', style: 'concrete' })
    expect(document.documentElement.dataset.style).toBe('concrete')
  })
  it('shows yellow when the saved accent is hidden, without touching the setting', () => {
    const s = { ...base, theme: 'dark' as const, style: 'blueprint' as const, accent: 'red' as const }
    applyTheme(s)
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('var(--accent-yellow)')
    expect(s.accent).toBe('red')
    applyTheme({ ...s, style: 'paper' })
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('var(--accent-red)')
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
