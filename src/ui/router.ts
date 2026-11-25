import type { PuzzleFile } from '../core/generator'
import { h } from './dom'
import { mountEndless } from './endless'
import { mountAccents } from './screens/accents'
import { mountHome } from './screens/home'
import { mountSettings } from './screens/settings'
import { mountDrawing, mountDrawList } from './screens/draw'
import { mountNets } from './screens/nets'
import { mountSections } from './screens/sections'
import { mountLevels } from './screens/levels'
import { mountReversePuzzle } from './screens/reversePuzzle'
import { mountShadowPuzzle } from './screens/shadowPuzzle'
import { mountViewsPuzzle } from './screens/viewsPuzzle'
import { S } from './strings'

/** Every screen mounts itself into the root and removes everything it added on destroy(). */
export type Screen = { destroy(): void }
type Mount = (root: HTMLElement, puzzles: PuzzleFile, ...params: string[]) => Screen | Promise<Screen>

export const navigate = (route: string): void => { location.hash = route }

function placeholder(root: HTMLElement, text = S.notBuilt): Screen {
  const el = h('main', { class: 'placeholder' }, h('p', { text }), h('a', { href: '#/', text: S.back }))
  root.append(el)
  return { destroy: () => el.remove() }
}

const routes: [RegExp, Mount][] = [
  [/^\/$/, root => mountHome(root)],
  [/^\/levels\/views$/, (root, f) => mountLevels(root, f)],
  [/^\/levels\/shadows$/, (root, f) => mountLevels(root, f, 'shadows')],
  [/^\/shadows\/([1-4])\/([\w-]+)$/, (root, f, level, id) => f.puzzles.some(p => p.id === id && p.set === 'level' && p.level === +level) ? mountShadowPuzzle(root, f, +level, id) : placeholder(root, S.notFound)],
  [/^\/views\/([\w-]+)$/, (root, f, id) => f.puzzles.some(p => p.id === id) ? mountViewsPuzzle(root, f, id) : placeholder(root, S.notFound)],
  [/^\/endless\/([1-6])\/(new|\d{1,10})$/, (root, _f, level, seed) => mountEndless(root, +level, seed)],
  [/^\/levels\/reverse$/, (root, f) => mountLevels(root, f, 'reverse')],
  [/^\/reverse\/E([1-6])-(new|\d{1,10})$/, (root, _f, level, seed) => mountEndless(root, +level, seed, undefined, 'reverse')],
  [/^\/reverse\/([\w-]+)$/, (root, f, id) => f.puzzles.some(p => p.id === id) ? mountReversePuzzle(root, f, id) : placeholder(root, S.notFound)],
  [/^\/nets\/([1-3])$/, (root, _f, level) => mountNets(root, +level as 1 | 2 | 3)],
  [/^\/sections\/([1-3])$/, (root, _f, level) => mountSections(root, +level as 1 | 2 | 3)],
  [/^\/draw(?:\/([\w-]+))?$/, (root, _f, id) => id ? mountDrawing(root, id) : mountDrawList(root)],
  [/^\/settings$/, root => mountSettings(root)],
  [/^\/settings\/accent$/, root => mountAccents(root)],
]

/** Mount the screen for location.hash now and on every hashchange; returns a stop function. */
export function startRouter(root: HTMLElement, puzzles: PuzzleFile): () => void {
  let cur: Screen | undefined, n = 0
  async function show() {
    const id = ++n
    cur?.destroy(); cur = undefined
    const path = location.hash.replace(/^#/, '') || '/'
    const hit = routes.find(([re]) => re.test(path))
    const s = hit ? await hit[1](root, puzzles, ...path.match(hit[0])!.slice(1)) : placeholder(root)
    if (id === n) cur = s
    else s.destroy() // the route changed while this screen was loading
  }
  window.addEventListener('hashchange', show)
  void show()
  return () => { window.removeEventListener('hashchange', show); cur?.destroy() }
}
