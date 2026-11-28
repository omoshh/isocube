import { LEVELS, SLOPES_H, clampSpec, slopesSideMax, specKey, type EndlessSpec, type PuzzleEntry, type PuzzleFile } from '../../core/generator'
import { createTopBar } from '../components/topBar'
import { h } from '../dom'
import { loadEndlessSpec, loadLast, loadProgress, saveEndlessSpec } from '../storage'
import { S } from '../strings'

/** #/levels/views, #/levels/reverse and #/levels/shadows (levels 1-4, the light named per card, no Endless): one tile per level; one row per level (size, count, progress bar); a row opens to a numbered grid of its puzzles.
 *  Reverse has an Endless link per level; Views has one Endless tile with a size picker at the end. */
export async function mountLevels(root: HTMLElement, file: PuzzleFile, mode: 'views' | 'reverse' | 'shadows' = 'views') {
  const [progress, last, spec] = await Promise.all([loadProgress(), loadLast(), loadEndlessSpec()])
  const solved = new Set(progress.solved)
  const sid = (p: PuzzleEntry) => mode === 'reverse' ? 'R-' + p.id : mode === 'shadows' ? `S${p.level}-${p.id}` : p.id
  const href = (p: PuzzleEntry) => `#/${mode}/` + (mode === 'shadows' ? p.level + '/' : '') + p.id
  // "last played" is the tile holding the last puzzle; an Endless play (no puzzle route) marks its level's tile
  const lastRoute = last?.kind === mode ? last.route : undefined, byRoute = file.puzzles.some(p => href(p) === lastRoute)
  const lastLevel = last?.kind === mode && !byRoute ? last.level : undefined
  // round 4: Slopes sets by size, file levels 0, 2, 3 (Slopes 1, 2, 3)
  const slopes = [0, 2, 3].map(l => file.puzzles.filter(p => p.set === 'slopes' && p.level === l))
  const tile = (data: Record<string, string>, name: string, size: string, list: PuzzleEntry[], level: number, endless?: string) => {
    const n = list.filter(p => solved.has(sid(p))).length
    const bar = h('span', { class: 'bar', 'aria-hidden': 'true' }, h('span', { style: `width:${Math.round((100 * n) / list.length)}%` }))
    const state = n === list.length ? 'complete' : list.some(p => href(p) === lastRoute) || level === lastLevel ? 'last' : undefined
    const nums = list.map((p, i) => h('a', { class: 'num', href: href(p), 'data-solved': solved.has(sid(p)), text: i + 1 }))
    return h('section', { class: 'tile', 'data-state': state, ...data },
      h('details', {},
        h('summary', {}, h('span', { class: 'tile-name', text: name }), h('span', { class: 'tile-size', text: size }),
          h('span', { class: 'tile-count', text: S.solvedOf(n, list.length) }), bar),
        h('div', { class: 'nums' }, ...nums)),
      ...(endless ? [h('a', { class: 'btn btn-outline', href: endless, text: S.endless })] : []))
  }
  const el = h('div', { class: 'screen levels' },
    createTopBar({ title: mode === 'reverse' ? S.reverse : mode === 'shadows' ? S.shadows : S.views, back: '/' }),
    h('p', { class: 'levels-hint', text: S.levelsHint }),
    h('main', { class: 'tiles' },
      ...LEVELS.filter(L => mode !== 'shadows' || L.level <= 4).flatMap(L => [tile({ 'data-level': String(L.level) }, S.level(L.level), mode === 'shadows' ? S.lights[L.level - 1] : `${L.a}×${L.b}×${L.maxH}`,
        file.puzzles.filter(p => p.set === (mode === 'reverse' ? 'reverse' : 'level') && p.level === L.level), L.level, mode === 'reverse' ? `#/reverse/E${L.level}-new` : undefined),
        // round 4: the Slopes tiles follow level 2 in Views; an empty set is hidden (level -1: only its puzzles mark it)
        ...(mode === 'views' && L.level === 2 ? slopes.flatMap((list, i) => list.length ? [tile({ 'data-set': 'slopes', 'data-slopes': String(i + 1) }, S.slopesN(i + 1), S.slopesSizes[i], list, -1)] : []) : [])]),
      ...(mode === 'views' ? [endlessPicker(spec)] : [])))
  root.append(el)
  return { destroy: () => el.remove() }
}

/** The Views Endless tile: width, depth and height steppers, a Slopes switch, and Start (#/endless/<spec>/new). */
function endlessPicker(start: EndlessSpec): HTMLElement {
  let spec = clampSpec(start)
  const go = h('a', { class: 'btn btn-accent' , text: S.start })
  const rows = ([['cols', S.width, 2], ['rows', S.depth, 2], ['maxH', S.height, 1]] as const).map(([k, name, lo]) => {
    const val = h('span', { class: 'stepper-value', 'data-value': k })
    const less = h('button', { class: 'icon-btn', 'aria-label': S.smallerLabel(name), text: '−', onclick: () => set({ ...spec, [k]: spec[k] - 1 }) })
    const more = h('button', { class: 'icon-btn', 'aria-label': S.largerLabel(name), text: '+', onclick: () => set({ ...spec, [k]: spec[k] + 1 }) })
    const top = () => (spec.slopes ? (k === 'maxH' ? SLOPES_H : slopesSideMax(spec[k === 'cols' ? 'rows' : 'cols'])) : 6), low = () => (spec.slopes && k === 'maxH' ? 2 : lo)
    const sync = () => { val.textContent = String(spec[k]); less.disabled = spec[k] <= low(); more.disabled = spec[k] >= top() }
    return { el: h('div', { class: 'stepper' }, h('span', { class: 'stepper-name', text: name }), less, val, more), sync }
  })
  const sw = h('button', { class: 'switch', role: 'switch', 'aria-label': S.slopes, onclick: () => set({ ...spec, slopes: !spec.slopes }) })
  const sync = () => {
    rows.forEach(r => r.sync())
    sw.setAttribute('aria-checked', String(spec.slopes))
    go.setAttribute('href', `#/endless/${specKey(spec)}/new`)
  }
  const set = (s: EndlessSpec) => { spec = clampSpec(s); sync(); void saveEndlessSpec(spec) }
  sync()
  return h('section', { class: 'tile endless-picker', 'data-set': 'endless' },
    h('span', { class: 'tile-name', text: S.endless }),
    ...rows.map(r => r.el),
    h('div', { class: 'stepper' }, h('span', { class: 'stepper-name', text: S.slopes }), sw),
    h('div', { class: 'endless-start' }, go))
}
