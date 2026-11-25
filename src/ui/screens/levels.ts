import { LEVELS, type PuzzleEntry, type PuzzleFile } from '../../core/generator'
import { createTopBar } from '../components/topBar'
import { h } from '../dom'
import { loadLast, loadProgress } from '../storage'
import { S } from '../strings'

/** #/levels/views, #/levels/reverse and #/levels/shadows (levels 1-4, the light named per card, no Endless): one tile per level; a tile opens to a numbered grid of its puzzles. */
export async function mountLevels(root: HTMLElement, file: PuzzleFile, mode: 'views' | 'reverse' | 'shadows' = 'views') {
  const [progress, last] = await Promise.all([loadProgress(), loadLast()])
  const solved = new Set(progress.solved)
  const sid = (p: PuzzleEntry) => mode === 'reverse' ? 'R-' + p.id : mode === 'shadows' ? `S${p.level}-${p.id}` : p.id
  const lastLevel = last?.kind === mode ? last.level : undefined
  const tile = (data: Record<string, string>, name: string, size: string, list: PuzzleEntry[], level: number, endless?: string) => {
    const n = list.filter(p => solved.has(sid(p))).length
    const dots = h('span', { class: 'dots', 'aria-hidden': 'true' }, ...list.map(p => h('span', { class: 'dot', 'data-solved': solved.has(sid(p)) })))
    const state = n === list.length ? 'complete' : level === lastLevel ? 'last' : undefined
    const nums = list.map((p, i) => h('a', { class: 'num', href: `#/${mode}/` + (mode === 'shadows' ? p.level + '/' : '') + p.id, 'data-solved': solved.has(sid(p)), text: i + 1 }))
    return h('section', { class: 'tile', 'data-state': state, ...data },
      h('details', {},
        h('summary', {}, h('span', { class: 'tile-name', text: name }), h('span', { class: 'tile-size', text: size }),
          h('span', { class: 'tile-count', text: S.solvedOf(n, list.length) }), dots),
        h('div', { class: 'nums' }, ...nums)),
      ...(endless ? [h('a', { class: 'btn btn-outline', href: endless, text: S.endless })] : []))
  }
  const el = h('div', { class: 'screen levels' },
    createTopBar({ title: mode === 'reverse' ? S.reverse : mode === 'shadows' ? S.shadows : S.views, back: '/' }),
    h('p', { class: 'levels-hint', text: S.levelsHint }),
    h('main', { class: 'tiles' },
      ...LEVELS.filter(L => mode !== 'shadows' || L.level <= 4).map(L => tile({ 'data-level': String(L.level) }, S.level(L.level), mode === 'shadows' ? S.lights[L.level - 1] : `${L.a}×${L.b}`,
        file.puzzles.filter(p => p.set === (mode === 'reverse' ? 'reverse' : 'level') && p.level === L.level), L.level, mode === 'shadows' ? undefined : mode === 'reverse' ? `#/reverse/E${L.level}-new` : `#/endless/${L.level}/new`))))
  root.append(el)
  return { destroy: () => el.remove() }
}
