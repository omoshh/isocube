import { countsAsSolved } from '../../core/lives'
import { SectionAnimation } from '../../core/sectionAnim'
import { makeSectionPuzzle } from '../../core/sectionPuzzle'
import { createLives } from '../components/lives'
import { createTopBar } from '../components/topBar'
import { h, icon } from '../dom'
import { loadProgress, saveLast, updateProgress } from '../storage'
import { shapeSvg, solidSvg } from '../sectionRender'
import { S } from '../strings'

type Level = 1 | 2 | 3
// Same persistence as nets (localStorage `sections/<level>`), duplicated rather than shared: it is ~10 lines.
type Rec = { seed: number; answered: boolean; pick: number; wrong?: number[]; guessed?: boolean }
const fresh = (): Rec => ({ seed: Math.floor(Math.random() * 2 ** 32), answered: false, pick: -1 })
function readRec(level: Level): Rec {
  try {
    const r = JSON.parse(localStorage.getItem('sections/' + level) ?? 'null')
    if (Number.isInteger(r?.seed) && typeof r.answered === 'boolean' && Number.isInteger(r.pick)) return r
  } catch { /* fall through */ }
  return fresh()
}
const writeRec = (level: Level, r: Rec) => { try { localStorage.setItem('sections/' + level, JSON.stringify(r)) } catch { /* in-memory only */ } }

/** #/sections/<level>: the solid with three points, four true shapes A-D, then the cutting animation once answered. */
export async function mountSections(root: HTMLElement, level: Level) {
  let rec = readRec(level), raf = 0, dead = false
  void saveLast({ kind: 'sections', level, route: '#/sections/' + level })
  const main = h('main', { class: 'nets' })
  main.append(h('p', { class: 'hint', role: 'status', text: S.secPreparing }))
  root.append(main)
  const livesFor = () => createLives(`sections/${level}/${rec.seed}`)
  let lv = await livesFor()
  const done = (await loadProgress()).solved.filter(s => s.startsWith('X')).length
  let score = done
  // The first puzzle per solid builds a ~1-2 s cache: show "Preparing…" and generate after a tick instead of in a worker (simpler, UI paints first).
  await new Promise(r => setTimeout(r, 30))
  if (dead) return { destroy() {} }

  function render() {
    const lives = lv
    cancelAnimationFrame(raf)
    const p = makeSectionPuzzle(level, rec.seed), sa = new SectionAnimation(p)
    const select = h('nav', { class: 'seg', 'aria-label': S.sections },
      ...S.netLevelNames.map((t, i) => h('a', { class: 'btn btn-outline', href: `#/sections/${i + 1}`, text: t, 'aria-pressed': String(i + 1 === level) })))
    const scoreN = h('span', { class: 'score-n' }), scoreText = h('span'), scoreEl = h('span', { class: 'score' }, scoreN, ' ', scoreText)
    const setScore = () => { const [n, ...rest] = S.netScore(score).split(' '); scoreN.textContent = n; scoreText.textContent = rest.join(' ') }
    setScore()
    const msg = h('div', { class: 'netmsg' })
    const cards = p.options.map((shape, i) =>
      h('button', { class: 'netopt', 'aria-label': 'ABCD'[i], onclick: () => answer(i) }, shapeSvg(shape, p.optionAngles[i]), h('span', { class: 'lbl', text: 'ABCD'[i] })))
    const frames = Array.from({ length: 11 }, (_, k) => sa.at(k / 10))
    const card = solidSvg(p, S.sections), anim = solidSvg(p, S.secNote, frames)
    const box = h('div', { class: 'foldbox', hidden: !rec.answered })
    const slider = h('input', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': S.secAmount })
    const play = h('button', { class: 'btn btn-accent', text: S.secPlay })
    const result = h('div', { class: 'netresult', 'aria-live': 'polite', hidden: !rec.answered }, msg, play)
    const draw = (t: number) => anim.draw(sa.at(t))
    slider.addEventListener('input', () => { cancelAnimationFrame(raf); draw(+slider.value / 1000) })
    play.addEventListener('click', () => {
      cancelAnimationFrame(raf)
      const from = +slider.value >= 1000 ? 0 : +slider.value / 1000
      let t0: number | undefined
      const step = (ts: number) => {
        t0 ??= ts
        const k = Math.min(1, from + (ts - t0) / 3000)
        slider.value = String(Math.round(k * 1000)); draw(k)
        if (k < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    })
    draw(0)
    box.append(anim.svg, h('div', { class: 'foldctl' }, slider), h('div', { class: 'netq', text: S.secNote }))

    const mark = () => {
      for (const i of rec.wrong ?? []) { cards[i].classList.add('wrong'); cards[i].querySelector('.lbl')!.textContent = S.yourPick }
      if (!rec.answered) return
      cards[p.correct].classList.add('right')
      const badge = h('span', { class: 'badge' })
      badge.innerHTML = icon('<path d="M5 12l5 5 9-10"/>')
      cards[p.correct].append(badge)
      if (rec.pick !== p.correct) { cards[rec.pick].classList.add('wrong'); cards[rec.pick].querySelector('.lbl')!.textContent = S.yourPick }
      msg.textContent = rec.pick === p.correct ? S.secRight : S.secWrong
    }
    function answer(i: number) {
      if (rec.answered || rec.wrong?.includes(i)) return
      if (lives.on && i !== p.correct) { // a wrong pick costs a life; the correct shape stays hidden
        rec = { ...rec, guessed: true } // survives a restart and a reload: never counts as right first time
        if (lives.fail()) { rec = { ...rec, wrong: [] }; writeRec(level, rec); render(); lives.say(S.outOfLives); return }
        rec = { ...rec, wrong: [...(rec.wrong ?? []), i] }
        writeRec(level, rec); mark(); return
      }
      const first = !rec.guessed, id = `X${level}-${rec.seed}`
      rec = { ...rec, answered: true, pick: i }
      writeRec(level, rec)
      if (i === p.correct && first && countsAsSolved(lives.state, lives.on)) {
        void updateProgress(pr => {
          if (pr.solved.includes(id)) return pr
          score++; setScore()
          return { ...pr, solved: [...pr.solved, id] }
        })
      }
      mark(); box.hidden = result.hidden = false
    }
    mark()

    main.replaceChildren(
      createTopBar({ title: S.sections, subtitle: S.netLevelNames[level - 1], back: '/', lives: lives.el }),
      lives.notice,
      select,
      h('div', { class: 'netbar' }, scoreEl, h('button', { class: 'btn btn-outline', text: S.newShape, onclick: async () => { rec = fresh(); writeRec(level, rec); lv = await livesFor(); render() } })),
      h('div', { class: 'netshape sec' }, card.svg),
      h('div', { class: 'netq', text: S.secQ }),
      h('div', { class: 'netopts' }, ...cards), result, box,
      h('p', { class: 'hint', text: S.secHint }))
  }
  writeRec(level, rec)
  render()
  return { destroy() { dead = true; cancelAnimationFrame(raf); main.remove() } }
}
