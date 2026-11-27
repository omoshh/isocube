# Round 4 phase 2b — Endless size picker and slopes switch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Views Endless gets one Endless tile with a size picker (width, depth, height) and a Slopes switch; the worker makes puzzles of the picked size, with ramps when the switch is on.

**Architecture:** An Endless puzzle is made from a *job*: a level (`'1'`–`'6'`, old routes and Reverse, unchanged) or a spec key like `4x4x3` / `3x3x2s` (`s` = slopes). `makeEndless(spec, seed)` is deterministic, so `#/endless/<spec>/<seed>` always gives the same puzzle. The queue and worker carry the job string instead of a level number, and replies carry ramps. A 10 s timer on the "Generating…" screen offers a smaller size. Slopes are allowed only at small sizes (owner's choice 2026-11-27: picker now, fast solver as the next step).

**Tech Stack:** TypeScript, Vite, Vitest (+ jsdom, fake-indexeddb), Playwright.

**Spec:** `docs/2026-11-27-round4-design.md` (section "Endless (Views)"); phase 2a plan `docs/superpowers/plans/2026-11-27-round4-phase2a.md` for the slope code it reuses.

## Global Constraints

- Size picker: width 2–6, depth 2–6, height 1–6 (spec). With Slopes on: width and depth at most 3, height at most 3 (owner's choice: solver too slow above 3×3; `SLOPES_MAX` below, may go lower after the Task 1 measurement).
- Slopes off gives cube-only puzzles. No curves switch yet (phase 3).
- Generation runs in the worker. After 10 s without a puzzle: a short message and a way to pick a smaller size (spec: "about 10 seconds", builder's call).
- Endless saves its own settings (the last picked spec), default `3×3×2`, slopes off.
- Reverse Endless (one button per level) does not change. Old Views routes `#/endless/<1-6>/<seed>` still open (saved drawings and Continue point there).
- Save data: nothing is deleted or renamed. `progress.endlessSeeds` gets new string keys beside the old level keys.
- The Slopes set (`SL-001`…`SL-025`) must not change: `makeSlopeCandidate(seed)` keeps its exact output.
- Version 4.3 at the end. Merge and push to `main` without a PR after the final review.

## Review Focus

1. A tiny or odd size (2×2×1, 2×6×6, slopes 2×2×1) must not freeze or crash: it either gives a puzzle or shows the 10 s message (Task 1 measurement, Task 3 test).
2. Re-opening `#/endless/3x3x2s/<seed>` in a fresh session gives the same shape with the same ramps (Task 1 test, Task 3 test).
3. A hand-edited or bad spec in the URL or in storage (`9x9x9`, `3x3x5s`, `abc`) is clamped or refused, never passed to the generator (Task 1 test, Task 3 route test, Task 4 storage test).
4. Turning Slopes on while the size is 5×5×4 clamps the shown size to 3×3×3 at once, and Start uses the clamped size (Task 4 test).
5. Old Endless data (`endless/2/<seed>` drawing, `endlessSeeds[2]`) still opens and is never served twice (Task 3 test).

---

### Task 1: `makeEndless` in the core

**Files:**
- Modify: `src/core/generator.ts`
- Test: `tests/core/generator.test.ts`

**Interfaces:**
- Produces (all in `generator.ts`):
  - `type EndlessSpec = { cols: number; rows: number; maxH: number; slopes: boolean }`
  - `const SLOPES_MAX = 3` (largest width, depth and height with slopes)
  - `specKey(s: EndlessSpec): string` → `` `${cols}x${rows}x${maxH}${slopes ? 's' : ''}` ``
  - `parseSpec(key: string): EndlessSpec | null` — `/^([2-6])x([2-6])x([1-6])(s?)$/`; `null` when it does not match or when slopes and a value is above `SLOPES_MAX`.
  - `clampSpec(s: EndlessSpec): EndlessSpec` — limits to the picker ranges, and to `SLOPES_MAX` when slopes is on.
  - `slopeCandidate(cols: number, rows: number, maxH: number, r: Rng): Shape | null` — the body of today's `makeSlopeCandidate` after the size pick, with `3` replaced by `maxH`.
  - `makeEndless(s: EndlessSpec, seed: number): Shape` — `r = rng(seed)`; loops until found. Cubes: `sampleShape` + `fairPicture` + `countSolutions(…) === 1` (as `makePuzzle`, no random turn: the user picked width and depth). Slopes: `slopeCandidate(cols, rows, maxH, r)` until not null.
  - `makeSlopeCandidate(seed)` becomes the size pick + `slopeCandidate(cols, rows, 3, r)`, with the same calls on `r` in the same order.

- [ ] **Step 1: Write the failing tests** in `tests/core/generator.test.ts`, `describe('endless spec')`:
  - `specKeyRoundTrip`: `parseSpec(specKey(s))` equals `s` for `{4,4,3,false}` and `{3,2,2,true}`; `specKey({cols:3,rows:3,maxH:2,slopes:true})` is `'3x3x2s'`.
  - `parseSpecRefuses`: `null` for `'9x9x9'`, `'1x3x2'`, `'3x3x0'`, `'4x3x2s'`, `'3x3x4s'`, `'abc'`, `'3x3x2S'`.
  - `clampSpec`: `{5,5,4,true}` → `{3,3,3,true}`; `{9,1,0,false}` → `{6,2,1,false}`.
  - `slopeCandidateUnchanged`: for seeds `20261127…20261146`, `makeSlopeCandidate(seed)` gives the same result as before the change (record the old outputs first: run the old code once and paste the JSON of `seed → {h, ramps} | null` into the test).
  - `makeEndlessCubes`: `makeEndless({cols:4,rows:3,maxH:3,slopes:false}, 7)` has `hm.cols === 4`, `hm.rows === 3`, no ramps, max height ≤ 3, `fairPicture` true, `countSolutions(views(hm), 4, 3, 3) === 1`; a second call with seed 7 gives equal `h`.
  - `makeEndlessSlopes`: `makeEndless({cols:3,rows:3,maxH:2,slopes:true}, 7)` has ≥ 1 ramp, `fairShape` true, `countShapeSolutions(shapeViews(s, 2), 3, 3, 2, 2) === 1`; a second call gives equal `h` and ramps.

- [ ] **Step 2:** Run `npx vitest run tests/core/generator.test.ts` — the new tests FAIL (not defined), `slopeCandidateUnchanged` passes against the old code.
- [ ] **Step 3:** Implement the interfaces above.
- [ ] **Step 4:** Run `npx vitest run tests/core` — all PASS.
- [ ] **Step 5: Measure.** A scratch script (not committed) runs `makeEndless` for every slopes spec (width, depth 2–3, height 1–3) and the cube specs `2x2x1`, `6x6x6`, `5x6x5`, seeds 1–5, each with a 30 s cap, and prints the median time. Decision rule: a slopes size whose median is above 3 s on this PC (about 10 s on a phone) is excluded by lowering `SLOPES_MAX` or adding a rule to `clampSpec`/`parseSpec` (update the tests). Cube sizes are not limited (the 10 s message covers them). Put the table in the commit message.
- [ ] **Step 6:** Commit `feat(core): makeEndless for any size, with or without slopes`

### Task 2: Worker and queue carry a job string and ramps

**Files:**
- Modify: `src/worker/endless.worker.ts`, `src/ui/endless.ts` (class `EndlessQueue` only)
- Test: `tests/ui/endless.test.ts`

**Interfaces:**
- Consumes: `makePuzzle(level, seed)`, `makeEndless(spec, seed)`, `parseSpec`, `toEntryRamps` (`src/core/solid.ts`).
- Produces:
  - Worker message in: `{ id: number; job: string; seed: number }`. Out: `{ id, job, seed, cols, rows, h: number[], ramps: EntryRamp[] }`. A job of one digit is a level (`makePuzzle`, `ramps: []`); otherwise `makeEndless(parseSpec(job)!)`.
  - `export function makeJob(job: string, seed: number): Shape` in `src/core/generator.ts` (the dispatch above, so the worker and the test fake share it).
  - `EndlessQueue(job: string, makeWorker, used?)` — `readonly job: string` replaces `level`; `Result = { seed: number; hm: HeightMap; ramps: EntryRamp[] }`. Replies for another job are dropped (as for another level today).

- [ ] **Step 1:** Update `tests/ui/endless.test.ts`: the fake worker's `reply` uses `makeJob(m.job, m.seed)`; existing queue tests pass `'1'`/`'6'` and check `m.job`. New test `keepsSpecJob`: `new EndlessQueue('3x3x2s', …)`, flush, `next()` gives a result whose `ramps.length ≥ 1` and whose `h`/`ramps` equal `makeJob('3x3x2s', seed)`.
- [ ] **Step 2:** Run `npx vitest run tests/ui/endless.test.ts` — FAIL.
- [ ] **Step 3:** Implement. `mountEndless` callers pass `String(level)` for now so the app still builds.
- [ ] **Step 4:** Run `npx vitest run && npx tsc --noEmit` — PASS.
- [ ] **Step 5:** Commit `refactor: endless queue and worker take a job (level or size spec) and return ramps`

### Task 3: Endless screen for size specs, with the 10 s message

**Files:**
- Modify: `src/ui/endless.ts` (`mountEndless`), `src/ui/router.ts`, `src/ui/strings.ts`, `src/core/unlocks.ts` (`Progress.endlessSeeds: Record<string, number[]>`)
- Test: `tests/ui/endless.test.ts`

**Interfaces:**
- Consumes: `EndlessQueue(job)`, `parseSpec`, `mountPuzzle` (already takes `ramps`).
- Produces:
  - `mountEndless(root, job: string, seed: string, makeWorker?, mode?)`. Views routes: `#/endless/<job>/(new|<seed>)`. For a spec job: `id: E<job>-<seed>`, `key: endless/<job>/<seed>`, `maxH: spec.maxH`, `title: S.endless`, `subtitle: S.endlessSub(cols, rows, maxH, slopes)`, `nextRoute: #/endless/<job>/new`, `ramps` from the result; `saveLast` with `level: 0`. Level jobs keep today's ids, keys, titles and Reverse routes exactly.
  - Router: `/^\/endless\/([1-6]|[2-6]x[2-6]x[1-6]s?)\/(new|\d{1,10})$/`; a spec that `parseSpec` refuses shows `S.notFound`.
  - Strings: `endlessSub(cols, rows, h, slopes = false)` → `Endless, 3×3×2` or `Endless, 3×3×2, slopes`; `slowHint: 'No puzzle yet. A smaller size is faster.'`, `smaller: 'Pick a smaller size'`.
  - 10 s after the wait screen shows (`SLOW_MS = 10_000`, exported for the test), the text becomes `S.slowHint` and a `S.smaller` link to `#/levels/views` appears; generation goes on. The timer is cleared on destroy and when the puzzle opens.

- [ ] **Step 1: Write the failing tests** (fake timers where needed):
  - `specRouteOpensShape`: mount `'3x3x2s'`, `'new'`; flush; `location.hash` becomes `#/endless/3x3x2s/<seed>`; `progress.endlessSeeds['3x3x2s']` holds the seed; the subtitle reads `Endless, 3×3×2, slopes`.
  - `specColdOpenSameShape`: after `vi.resetModules()`, mount `'3x3x2s'`, `'<seed>'` gives the same answer (compare the puzzle's `h` and ramps via `makeJob`).
  - `slowHintAfter10s`: no flush; advance `SLOW_MS`; the page shows `S.slowHint` and a link to `#/levels/views`; destroy clears the timer (no error after more time).
  - `oldLevelRouteStillOpens`: a saved drawing at `endless/2/<seed>` and `endlessSeeds[2] = [seed]`; mount `'2'`, `'<seed>'` loads that drawing; `'2'`, `'new'` never serves that seed.
  - Router: `#/endless/9x9x9/new` and `#/endless/4x3x2s/new` show `S.notFound`.
- [ ] **Step 2:** Run `npx vitest run tests/ui/endless.test.ts` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run && npx tsc --noEmit` — PASS.
- [ ] **Step 5:** Commit `feat(ui): endless puzzles of any size spec, slow-generation hint`

### Task 4: Endless tile with the size picker on the Views levels screen

**Files:**
- Modify: `src/ui/screens/levels.ts`, `src/ui/storage.ts`, `src/ui/strings.ts`, `src/ui/styles/screens.css`
- Test: `tests/ui/home.test.ts` or a new `tests/ui/levels.test.ts` (whichever already mounts `mountLevels`; else new)

**Interfaces:**
- Consumes: `EndlessSpec`, `specKey`, `clampSpec`, `parseSpec`.
- Produces:
  - `loadEndlessSpec(): Promise<EndlessSpec>` and `saveEndlessSpec(s: EndlessSpec): Promise<void>` in `storage.ts`, key `'endless'`. Load: a stored value is run through `parseSpec(specKey(clampSpec(v)))`; anything bad gives the default `{ cols: 3, rows: 3, maxH: 2, slopes: false }`. Not part of the backup (a convenience; say so in the report).
  - Views mode: the per-level Endless buttons go away; after the last level tile comes a tile `data-set="endless"`: name `S.endless`, three stepper rows (`S.width`, `S.depth`, `S.height`: `−` button, value, `+` button, each button `aria-label` like `Width smaller` / `Width larger`, disabled at its limit), a Slopes switch (the `button.switch role="switch"` pattern from `settings.ts`, label `S.slopes`), and a Start link `a.btn.btn-accent` with `href = #/endless/<specKey(spec)>/new`. Each change runs `clampSpec`, updates the values, the limits and the href, and calls `saveEndlessSpec`.
  - Reverse mode keeps its per-level Endless buttons exactly.
  - Strings: `width: 'Width'`, `depth: 'Depth'`, `height: 'Height'`, `start: 'Start'`, `smallerLabel(n: string)` / `largerLabel(n: string)`.

- [ ] **Step 1: Write the failing tests:**
  - `viewsHasOneEndlessTile`: views mode has no `a[href^="#/endless/1/"]` … and one `[data-set="endless"]` whose Start href is `#/endless/3x3x2/new`.
  - `reverseKeepsLevelEndless`: reverse mode still has `#/reverse/E1-new` … `#/reverse/E6-new`.
  - `stepperLimits`: press Width `+` until disabled → value 6, href `#/endless/6x3x2/new`; Height `−` once → 1, its `−` disabled.
  - `slopesClamps`: set 5×5×4, press the Slopes switch → values 3×3×3, `aria-checked="true"`, href `#/endless/3x3x3s/new`, Width `+` disabled.
  - `specRemembered`: after the changes, a fresh `mountLevels` shows the same values (`loadEndlessSpec`); a stored `{cols: 9, rows: 'x'}` loads as the default.
- [ ] **Step 2:** Run the test file — FAIL.
- [ ] **Step 3:** Implement. CSS: stepper rows use the tile's spacing and `--` tokens from `docs/design/design-system.md`; buttons at least 44 px.
- [ ] **Step 4:** Run `npx vitest run && npx tsc --noEmit` — PASS.
- [ ] **Step 5:** Commit `feat(ui): Endless size picker and Slopes switch`

### Task 5: Version 4.3, checks, review, deploy

- [ ] Version 4.3 (`package.json`, `package-lock.json` lines 3 and 9, settings test).
- [ ] `npm run build && npm run e2e` OK.
- [ ] Browser check (Pixel 7 size): Views → Endless tile: pick 4×4×3, Start, a puzzle opens; Next gives another. Turn Slopes on: size clamps; Start gives a puzzle with a ramp; the answer and the back view look right. Pick 6×6×6: after 10 s the hint shows. Time each slopes size on the PC and note it. Screenshot.
- [ ] Final review; Critical/Important fixed with tests; merge `--ff-only`, push, watch deploy.
- [ ] Update memory (phase 2b live; next: fast solver step, then phase 3). Report to the owner: what works, how to try it, the slopes size limit and why, the 10 s hint, and that the picker setting is not in the backup file.
