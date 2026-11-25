import { shownAccent, type Accent, type Settings } from '../core/unlocks'

/** Mirror of the --accent-<id> values in tokens.css; tests/ui/theme.test.ts keeps them equal. */
export const ACCENT_HEX: Record<Accent, string> = {
  yellow: '#FFD23F', mint: '#3DDC97', lilac: '#B9A6FF', pink: '#FF8FC7',
  lime: '#C6F432', red: '#E5383B', sand: '#E8C9A0',
}

const DARK_INK = '#16161A'
const WHITE = '#FFFFFF'

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function onAccent(hex: string): '#16161A' | '#FFFFFF' {
  const l = luminance(hex)
  return (l + 0.05) / (luminance(DARK_INK) + 0.05) >= (1.05) / (l + 0.05) ? DARK_INK : WHITE
}

let stopListening: (() => void) | undefined

export function applyTheme(s: Settings): void {
  stopListening?.()
  stopListening = undefined
  const el = document.documentElement
  el.dataset.style = s.style
  const w = { thin: 1.5, normal: 2, thick: 3 }[s.lineWidth]
  el.style.setProperty('--stroke-line', `${w}px`)
  el.style.setProperty('--stroke-missing', `${w + 1.5}px`)
  el.style.setProperty('--stroke-mistake', `${w + 2}px`)
  // The shown accent depends on the mode, so it is set together with it.
  const paint = (mode: 'light' | 'dark') => {
    el.dataset.theme = mode
    const a = shownAccent(s.accent, s.style, mode)
    el.style.setProperty('--accent', `var(--accent-${a})`)
    el.style.setProperty('--on-accent', onAccent(ACCENT_HEX[a]))
  }
  if (s.theme === 'system') {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const set = () => paint(mq.matches ? 'dark' : 'light')
    set()
    mq.addEventListener('change', set)
    stopListening = () => mq.removeEventListener('change', set)
  } else {
    paint(s.theme)
  }
}
