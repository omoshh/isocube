import { FoldAnimation } from '../../core/fold'
import { makeNetsPuzzle, type Net, type Polycube } from '../../core/nets'
import { createLives, type LivesCtl } from '../components/lives'
import { createTopBar } from '../components/topBar'
import { h, icon } from '../dom'
import { mk } from '../grid/gestures'
import { loadProgress, saveLast, updateProgress } from '../storage'
import { S } from '../strings'

type Level = 1 | 2 | 3
// The current puzzle survives a reload as localStorage `nets/<level>` (smaller than a storage.ts field; try/catch for blocked storage).
type Rec = { seed: number; answered: boolean; pick: number; wrong?: number[]; guessed?: boolean } // wrong: picks that cost a life (lives on)
const fresh = (): Rec => ({ seed: Math.floor(Math.random() * 2 ** 32), answered: false, pick: -1 })
function readRec(level: Level): Rec {
  try {
    const r = JSON.parse(localStorage.getItem('nets/' + level) ?? 'null')
    if (Number.isInteger(r?.seed) && typeof r.answered === 'boolean' && Number.isInteger(r.pick)) return r
  } catch { /* fall through */ }
  return fresh()
}
const writeRec = (level: Level, r: Rec) => { try { localStorage.setItem('nets/' + level, JSON.stringify(r)) } catch { /* in-memory only */ } }

const pts = (p: number[][]) => p.map(q => q.join(',')).join(' ')
const proj = ([x, y, z]: number[]) => [x - y, -((x + y) / 2 + z)] // reference proj, SVG y down
const fit = (svg: SVGSVGElement, all: number[][]) => {
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]), x0 = Math.min(...xs) - .3, y0 = Math.min(...ys) - .3
  svg.setAttribute('viewBox', `${x0} ${y0} ${Math.max(...xs) + .3 - x0} ${Math.max(...ys) + .3 - y0}`)
}

function shapeSvg(shape: Polycube): SVGSVGElement {
  const svg = mk('svg', { role: 'img', 'aria-label': 'Shape' }), all: number[][] = []
  const cubes = [...shape].sort((a, b) => (-a[0] - a[1] + a[2]) - (-b[0] - b[1] + b[2]) || a[2] - b[2])
  for (const [x, y, z] of cubes) {
    for (const [q, cls] of [
      [[[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], 'k-top'],
      [[[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]], 'k-front'],
      [[[x, y, z], [x, y + 1, z], [x, y + 1, z + 1], [x, y, z + 1]], 'k-side'],
    ] as [number[][], string][]) {
      const P = q.map(proj); all.push(...P)
      mk('polygon', { points: pts(P), class: cls }, svg)
    }
  }
  fit(svg, all)
  return svg
}

function netSvg(net: Net): SVGSVGElement {
  const svg = mk('svg', { role: 'img' }), set = new Set(net.map(q => q.c + ',' + q.r))
  const mc = Math.min(...net.map(q => q.c)), mr = Math.min(...net.map(q => q.r))
  const W = Math.max(...net.map(q => q.c)) - mc + 1, H = Math.max(...net.map(q => q.r)) - mr + 1, side = Math.max(W, H, 4) + .6
  svg.setAttribute('viewBox', `${(W - side) / 2} ${(H - side) / 2} ${side} ${side}`)
  for (const q of net) mk('rect', { x: q.c - mc, y: H - 1 - (q.r - mr), width: 1, height: 1, class: 'ncell' }, svg)
  for (const q of net) {
    const x = q.c - mc, y = H - 1 - (q.r - mr)
    for (const [dc, dr, x1, y1, x2, y2] of [[1, 0, x + 1, y, x + 1, y + 1], [-1, 0, x, y, x, y + 1], [0, 1, x, y, x + 1, y], [0, -1, x, y + 1, x + 1, y + 1]]) {
      const nb = set.has(q.c + dc + ',' + (q.r + dr))
      if (nb && (dc < 0 || dr < 0)) continue // each fold once
      mk('line', { x1, y1, x2, y2, class: nb ? 'nline fold' : 'nline' }, svg)
    }
  }
  return svg
}

/** #/nets/<level>: shape, four nets A-D, then the fold box once answered. */
export async function mountNets(root: HTMLElement, level: Level) {
  let rec = readRec(level), raf = 0
  void saveLast({ kind: 'nets', level, route: '#/nets/' + level })
  const main = h('main', { class: 'nets' })
  root.append(main)
  const livesFor = () => createLives(`nets/${level}/${rec.seed}`)
  let lv = await livesFor()
  const netsRight = (await loadProgress()).netsRight
  let score = netsRight

  function render() {
    const lives: LivesCtl = lv
    cancelAnimationFrame(raf)
    const p = makeNetsPuzzle(level, rec.seed), fa = new FoldAnimation(p.options[p.correct], p.shape)
    const select = h('nav', { class: 'seg', 'aria-label': S.nets },
      ...S.netLevelNames.map((t, i) => h('a', { class: 'btn btn-outline', href: `#/nets/${i + 1}`, text: t, 'aria-pressed': String(i + 1 === level) })))
    const scoreN = h('span', { class: 'score-n' }), scoreEl = h('span', { class: 'score' }, scoreN, ' ')
    const scoreText = h('span')
    scoreEl.append(scoreText)
    const setScore = () => { const [n, ...rest] = S.netScore(score).split(' '); scoreN.textContent = n; scoreText.textContent = rest.join(' ') }
    setScore()
    const msg = h('div', { class: 'netmsg' })
    const cards = p.options.map((net, i) => {
      const c = h('button', { class: 'netopt', 'aria-label': 'ABCD'[i], onclick: () => answer(i) }, netSvg(net), h('span', { class: 'lbl', text: 'ABCD'[i] }))
      return c
    })
    const box = h('div', { class: 'foldbox', hidden: !rec.answered })
    const fsvg = mk('svg', { role: 'img', 'aria-label': S.foldNote })
    const slider = h('input', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': S.foldAmount })
    const play = h('button', { class: 'btn btn-accent', text: S.fold })
    const result = h('div', { class: 'netresult', 'aria-live': 'polite', hidden: !rec.answered }, msg, play)

    const quads = (t: number) => p.options[p.correct].map((_, i) => fa.pose(i, t))
    const all: number[][] = []
    for (let k = 0; k <= 10; k++) for (const q of quads(k / 10)) all.push(...q.map(proj))
    fit(fsvg, all)
    const draw = (t: number) => {
      fsvg.replaceChildren()
      const ranked = quads(t).map(q => {
        const n = [0, 1, 2].map(a => Math.abs((q[1][(a + 1) % 3] - q[0][(a + 1) % 3]) * (q[3][(a + 2) % 3] - q[0][(a + 2) % 3]) - (q[1][(a + 2) % 3] - q[0][(a + 2) % 3]) * (q[3][(a + 1) % 3] - q[0][(a + 1) % 3])))
        const c = [0, 1, 2].map(a => q.reduce((s, v) => s + v[a], 0) / 4)
        return { q, m: n.indexOf(Math.max(...n)), key: -c[0] - c[1] + c[2] }
      }).sort((a, b) => a.key - b.key)
      // the face's normal axis picks the tone as in the shape: x side, y front, z top
      for (const { q, m } of ranked) mk('polygon', { points: pts(q.map(proj)), class: ['k-side', 'k-front', 'k-top'][m] }, fsvg)
    }
    slider.addEventListener('input', () => { cancelAnimationFrame(raf); draw(+slider.value / 1000) })
    play.addEventListener('click', () => {
      cancelAnimationFrame(raf)
      const from = +slider.value >= 1000 ? 0 : +slider.value / 1000
      let t0: number | undefined
      const step = (ts: number) => {
        t0 ??= ts
        const k = Math.min(1, from + (ts - t0) / 1500)
        slider.value = String(Math.round(k * 1000)); draw(k)
        if (k < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    })
    draw(0)
    box.append(fsvg, h('div', { class: 'foldctl' }, slider), h('div', { class: 'netq', text: S.foldNote }))

    const mark = () => {
      for (const i of rec.wrong ?? []) { cards[i].classList.add('wrong'); cards[i].querySelector('.lbl')!.textContent = S.yourPick }
      if (!rec.answered) return
      cards[p.correct].classList.add('right')
      cards[p.correct].append(h('span', { class: 'badge' }))
      cards[p.correct].lastElementChild!.innerHTML = icon('<path d="M5 12l5 5 9-10"/>')
      const bad = rec.pick !== p.correct ? cards[rec.pick] : undefined
      if (bad) { bad.classList.add('wrong'); bad.querySelector('.lbl')!.textContent = S.yourPick }
      msg.textContent = rec.pick === p.correct ? S.netRight : S.netWrong
    }
    function answer(i: number) {
      if (rec.answered || rec.wrong?.includes(i)) return
      if (lives.on && i !== p.correct) { // a wrong pick costs a life; the correct net stays hidden
        rec = { ...rec, guessed: true } // survives a restart and a reload: never counts as right first time
        if (lives.fail()) { rec = { ...rec, wrong: [] }; writeRec(level, rec); render(); lives.say(S.outOfLives); return }
        rec = { ...rec, wrong: [...(rec.wrong ?? []), i] }
        writeRec(level, rec); mark(); return
      }
      const first = !rec.guessed
      rec = { ...rec, answered: true, pick: i }
      writeRec(level, rec)
      if (i === p.correct && first) { score++; setScore(); void updateProgress(pr => ({ ...pr, netsRight: pr.netsRight + 1 })) }
      mark(); box.hidden = result.hidden = false
    }
    mark()

    main.replaceChildren(
      createTopBar({ title: S.nets, subtitle: `${S.netLevelNames[level - 1]}, ${S.netLevels[level - 1]}`, back: '/', lives: lives.el }),
      lives.notice,
      select,
      h('div', { class: 'netbar' }, scoreEl, h('button', { class: 'btn btn-outline', text: S.newShape, onclick: async () => { rec = fresh(); writeRec(level, rec); lv = await livesFor(); render() } })),
      h('div', { class: 'netshape' }, shapeSvg(p.shape)),
      h('div', { class: 'netq', text: S.netQ }),
      h('div', { class: 'netopts' }, ...cards), result, box,
      h('p', { class: 'hint', text: S.netHint }))
  }
  writeRec(level, rec)
  render()
  return { destroy() { cancelAnimationFrame(raf); main.remove() } }
}
