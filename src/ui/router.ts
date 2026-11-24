import type { PuzzleFile } from '../core/generator'
import { h } from './dom'
import { mountLevels } from './screens/levels'
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

// shortcut: #/ is a link list until Task 18 builds home
function home(root: HTMLElement): Screen {
  const el = h('main', { class: 'placeholder' }, h('h1', { text: S.views }), h('a', { href: '#/levels/views', text: S.levels }))
  root.append(el)
  return { destroy: () => el.remove() }
}

const routes: [RegExp, Mount][] = [
  [/^\/$/, home],
  [/^\/levels\/views$/, mountLevels],
  [/^\/views\/([\w-]+)$/, (root, f, id) => f.puzzles.some(p => p.id === id) ? mountViewsPuzzle(root, f, id) : placeholder(root, S.notFound)],
  [/^\/endless\/(\d+)\/(\w+)$/, root => placeholder(root)],
  [/^\/levels\/reverse$/, root => placeholder(root)],
  [/^\/reverse\/([\w-]+)$/, root => placeholder(root)],
  [/^\/nets\/(\d+)$/, root => placeholder(root)],
  [/^\/draw(?:\/([\w-]+))?$/, root => placeholder(root)],
  [/^\/settings(?:\/accent)?$/, root => placeholder(root)],
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
