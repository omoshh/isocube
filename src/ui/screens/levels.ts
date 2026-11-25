import { LEVELS, type PuzzleEntry, type PuzzleFile } from '../../core/generator'
import { createTopBar } from '../components/topBar'
import { h } from '../dom'
import { loadLast, loadProgress } from '../storage'
import { S } from '../strings'

/** #/levels/views and #/levels/reverse: one tile per level and Classic; a tile opens to a numbered grid of its puzzles. */
export async function mountLevels(root: HTMLElement, file: PuzzleFile, mode: 'views' | 'reverse' = 'views') {
  const pre = mode === 'reverse' ? 'R-' : ''
  const solved = new Set((await loadProgress()).solved.filter(s => s.startsWith(pre)).map(s => s.slice(pre.length)))
  const last = await loadLast(), lastLevel = last?.kind === mode ? last.level : undefined
  const tile = (data: Record<string, string>, name: string, size: string, list: PuzzleEntry[], level: number, endless?: string) => {
    const n = list.filter(p => solved.has(p.id)).length
    const dots = h('span', { class: 'dots', 'aria-hidden': 'true' }, ...list.map(p => h('span', { class: 'dot', 'data-solved': solved.has(p.id) })))
    const state = n === list.length ? 'complete' : level === lastLevel ? 'last' : undefined
    const nums = list.map((p, i) => h('a', { class: 'num', href: `#/${mode}/` + p.id, 'data-solved': solved.has(p.id), text: i + 1 }))
    return h('section', { class: 'tile', 'data-state': state, ...data },
      h('details', {},
        h('summary', {}, h('span', { class: 'tile-name', text: name }), h('span', { class: 'tile-size', text: size }),
          h('span', { class: 'tile-count', text: S.solvedOf(n, list.length) }), dots),
        h('div', { class: 'nums' }, ...nums)),
      ...(endless ? [h('a', { class: 'btn btn-outline', href: endless, text: S.endless })] : []))
  }
  const el = h('div', { class: 'screen levels' },
    createTopBar({ title: mode === 'reverse' ? S.reverse : S.views, back: '/' }),
    h('p', { class: 'levels-hint', text: S.levelsHint }),
    h('main', { class: 'tiles' },
      ...LEVELS.map(L => tile({ 'data-level': String(L.level) }, S.level(L.level), `${L.a}×${L.b}`,
        file.puzzles.filter(p => p.set === (mode === 'reverse' ? 'reverse' : 'level') && p.level === L.level), L.level, mode === 'reverse' ? `#/reverse/E${L.level}-new` : `#/endless/${L.level}/new`)),
      tile({ 'data-set': 'classic' }, S.classic, '', file.puzzles.filter(p => p.set === 'classic'), 0)))
  root.append(el)
  return { destroy: () => el.remove() }
}
