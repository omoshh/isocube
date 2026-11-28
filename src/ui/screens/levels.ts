import { LEVELS, clampSpec, specKey, type EndlessSpec, type PuzzleEntry, type PuzzleFile } from '../../core/generator'
import { createTopBar } from '../components/topBar'
import { h } from '../dom'
import { ENDLESS_MEDIAN_MS } from '../../core/endlessTimes'
import { GIVE_UP_MS } from '../endless'
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

/** Phone time = PC time × 3: an assumption, not measured. */
const PHONE_FACTOR = 3
/** Phone ms to find a puzzle with one answer: 0 when not measured, Infinity when never (rows × cols times like cols × rows). */
const phoneMs = (s: EndlessSpec) => {
  const v = ENDLESS_MEDIAN_MS[`${Math.min(s.cols, s.rows)}x${Math.max(s.cols, s.rows)}x${s.maxH}`]
  return v === undefined ? 0 : v === null ? Infinity : v * PHONE_FACTOR
}
/** "10 s" (to 5 s) under a minute, else "2 min". */
export function aboutTime(ms: number): string {
  const s = Math.round(ms / 5000) * 5
  return s < 60 ? `${s} s` : `${Math.round(ms / 60_000)} min`
}

/** The Views Endless tile: width, depth and height steppers, and Start (#/endless/<spec>/new). */
function endlessPicker(start: EndlessSpec): HTMLElement {
  let spec = clampSpec(start)
  const go = h('a', { class: 'btn btn-accent' , text: S.start })
  const rows = ([['cols', S.width, 2], ['rows', S.depth, 2], ['maxH', S.height, 1]] as const).map(([k, name, lo]) => {
    const val = h('span', { class: 'stepper-value', 'data-value': k })
    const less = h('button', { class: 'icon-btn', 'aria-label': S.smallerLabel(name), text: '−', onclick: () => set({ ...spec, [k]: spec[k] - 1 }) })
    const more = h('button', { class: 'icon-btn', 'aria-label': S.largerLabel(name), text: '+', onclick: () => set({ ...spec, [k]: spec[k] + 1 }) })
    const sync = () => { val.textContent = String(spec[k]); less.disabled = spec[k] <= lo; more.disabled = spec[k] >= 6 }
    return { el: h('div', { class: 'stepper' }, h('span', { class: 'stepper-name', text: name }), less, val, more), sync }
  })
  const note = h('p', { class: 'endless-note', 'aria-live': 'polite' })
  const sync = () => {
    rows.forEach(r => r.sync())
    // block at half the give-up time: a median that high still fails often (6x6x6: 3 of 7 seeds over 60 s on a phone)
    const ms = phoneMs(spec), blocked = ms > GIVE_UP_MS / 2
    if (blocked) go.removeAttribute('href'); else go.setAttribute('href', `#/endless/${specKey(spec)}/new`)
    if (blocked) go.setAttribute('aria-disabled', 'true'); else go.removeAttribute('aria-disabled')
    note.textContent = blocked ? S.tooBig : ms >= 5000 ? S.takesAbout(aboutTime(ms)) : ''
  }
  const set = (s: EndlessSpec) => { spec = clampSpec(s); sync(); void saveEndlessSpec(spec) }
  sync()
  return h('section', { class: 'tile endless-picker', 'data-set': 'endless' },
    h('span', { class: 'tile-name', text: S.endless }),
    ...rows.map(r => r.el),
    note,
    h('div', { class: 'endless-start' }, go))
}
