# Round 4 phase 3a (cylinders, roof B, Curves sets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Views gets round pieces (cylinders 1×1, 2×2; half-cylinder roof B 2×1, 2×2) and three Curves sets of 25, with faint midpoint dots near the finger and snap points where a line meets a drawn silhouette line.

**Architecture:** Round pieces are new `PieceType`s in `src/core/pieces.ts`, listed in `Shape.curves`. The 3 axis views stay exact in `exactViews.ts` (circles added, as eighth keys); the iso picture uses the float `sketch` only to decide visibility of exact candidate elements (arc eighths, silhouette lines, lattice pieces), and clips partly hidden lines only at exact crossings with silhouette lines. The solver and generator get the pieces through `PIECES`; sets are made offline like Slopes.

**Tech Stack:** TypeScript, Vite, Vitest (jsdom), Playwright smoke test, `tsx` scripts.

**Spec:** `docs/superpowers/specs/2026-11-28-round4-phase3a-curves-design.md` (parent: `docs/2026-11-27-round4-design.md` with its amendments).

## Global Constraints

- `CLAUDE.md`: test first for `src/core`, one commit per task, report to the owner as "what works and how to try it".
- No new dependencies. Pixel 7 / Firefox Android is the main device.
- All answer and view keys are exact strings; no float may decide a key (floats may only decide visibility).
- Cube-only and Slopes puzzles: views, answers, back pictures and puzzle data stay exactly as now (existing tests must pass unchanged).
- Existing saves do not change; backup version stays 3; no data is deleted.
- Tests on the laptop: `npx vitest run --maxWorkers=3`. Generation: at most 3 jobs, under `systemd-inhibit`, watch temperatures (alert ≥ 99 °C 1 min or ≥ 95 °C 5 min), per-candidate wall-clock timeout.
- Owner rule: a set needing more than **60 s per accepted puzzle** (3 jobs, PC), or a set that cannot fill 25 puzzles with variety ≥ 3 cells, is not shipped; stop and report to the owner.
- Ids `CV-NNN` (file level 0, 3×3–3×4, maxH 3), `CV2-NNN` (level 2, 4×4×3), `CV3-NNN` (level 3, 4×5 or 5×4, maxH 4); set name `'curves'`.
- Version 4.6.0. Merge to `main` with `--ff-only`, push, no PR.

## Review Focus

1. A round piece on a stack whose back edges pass behind it: the answer must hold the visible part, ending exactly at the silhouette crossing, and the player must be able to snap there (Task 5 test `cylinder on a cube clips back edges at the silhouette`, Task 7 test `crossing snap point`).
2. A roof B end cap hidden behind a taller column in a view: the solver must not miss or invent a second answer (Task 4 brute-force test at 2×3×2 covers hidden caps).
3. Phase 1 Draw drawings with √2-end lines must still load, draw and erase after `linePieces` changes (Task 3 test `old √2-end keys still erase`).
4. Zoomed out below `MIN_DOT_SCALE`, no midpoint dot shows, so no midpoint snap may happen (Task 7 test `no hidden snap when zoomed out`).
5. The back picture (⟲) of a Curves puzzle clips lines behind round pieces the same exact way (Task 5 test `back picture clips exactly`).

---

### Task 1: Round pieces in the shape model and puzzle file

**Files:**
- Modify: `src/core/solid.ts` (types, `validShape`, `rotateShape`, `turnShape`, `mirrorShape`, entry helpers)
- Modify: `src/core/generator.ts` (`PuzzleEntry`, `entryShape`, `shapeDistance`)
- Test: `tests/core/solid.test.ts`, `tests/core/generator.test.ts`

**Interfaces:**
- Produces:
  - `export type Round = { kind: 'cyl'; x: number; y: number; d: 1 | 2 } | { kind: 'roof'; x: number; y: number; len: 1 | 2; axis: 'x' | 'y' }` — (x, y) is the lowest-x, lowest-y cell (cube coordinates as `Ramp`). A cylinder covers d×d cells. A roof covers `len` cells along its axis and 2 across it.
  - `Shape = { hm: HeightMap; ramps: Ramp[]; curves?: Round[] }` (optional: every existing `{ hm, ramps }` stays valid).
  - `roundCells(r: Round): [number, number][]`
  - `validShape(s, maxH)` also checks rounds: inside the grid, flat base, no overlap with ramps or rounds, base + 1 ≤ maxH.
  - `EntryRound = ['c', number, number, 1 | 2] | ['r', number, number, 1 | 2, 'x' | 'y']`; `toEntryRounds`, `fromEntryRounds`.
  - `PuzzleEntry.set` adds `'curves'`; `PuzzleEntry.curves?: EntryRound[]`; `entryShape` reads it.
  - Turned, mirrored and rotated shapes move rounds (a 2-cell span moves its low corner by the span: e.g. rotate: `x → cols − w − x`, `y → rows − h − y` for a w×h footprint; turn swaps a roof's axis).

- [ ] **Step 1: Write failing tests** in `tests/core/solid.test.ts`:
  - `roundCells` of `{kind:'roof',x:1,y:0,len:2,axis:'x'}` is `[[1,0],[2,0],[1,1],[2,1]]` (any order); `{kind:'cyl',x:0,y:0,d:2}` gives 4 cells.
  - `validShape` is false for a 2×2 cylinder over unequal heights, over a ramp cell, or past the grid edge; true on a flat 2×2 of height 1 with maxH 2, false with maxH 1.
  - For 20 random valid shapes with rounds (fixed seed): the cell sets of `rotateShape`, `turnShape`∘×4, `mirrorShape`∘×2 equal the expected moved cells, and 4 turns or 2 mirrors give back the same shape.
  - In `tests/core/generator.test.ts`: `entryShape` of an entry with `curves: [['c',0,0,1],['r',1,0,1,'y']]` gives the 2 rounds; `shapeDistance` counts a cell that changes from a cube top to a cylinder.
- [ ] **Step 2: Run** `npx vitest run tests/core/solid.test.ts tests/core/generator.test.ts --maxWorkers=3` — expect the new tests to FAIL (missing exports).
- [ ] **Step 3: Implement** the interfaces above. `shapeDistance` marks round cells like ramp cells (`c<d>.<i>` / `r<axis><len>.<i>`).
- [ ] **Step 4: Run** the full suite `npx vitest run --maxWorkers=3` — all PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat: round pieces (cylinders, roof B) in the shape model and puzzle file`.

### Task 2: Round piece types — faces, sections, outlines, exact views

**Files:**
- Modify: `src/core/pieces.ts` (new `CYL1`, `CYL2`, `ROOF`; `Curve` arc kind used for real; `starts`)
- Modify: `src/core/solid.ts` (`shapeFaces` adds round faces; covered cube tops under a round are left out as under a ramp)
- Modify: `src/core/exactViews.ts` (rounds in `scene`; arc outlines; arc pieces judged per stretch)
- Modify: `src/core/shapeViews.ts` (`viewFills` works with round faces; nothing else)
- Test: `tests/core/exactViews.test.ts`, `tests/core/shapeViews.test.ts`

**Interfaces:**
- Consumes: `Round`, `Shape.curves`, `roundCells` (Task 1).
- Produces:
  - Round pieces use `Placed`: cylinder `len` = d, `dir` unused (`'E'`); roof `len` = length along the axis, `dir` `'E'` for axis x, `'N'` for axis y.
  - `export const CYL1: PieceType, CYL2: PieceType, ROOF: PieceType` and `roundPiece(r: Round): { t: PieceType; p: Omit<Placed,'z'> }`.
  - A round's flat faces use the normal plane keys (`axisPlane`); its curved face uses one key per piece, `'cv:' + x + ',' + y + ',' + z`. `faces()` cuts the curved face into strips at every 360°/96 (96 is a multiple of 8, so eighth points are strip corners); all strips share the curved key.
  - View arc keys: `` `C${cx}:${cy}|${r}|${k}` `` — centre in view screen coordinates (as `viewKey`: top (x, rows − y), front (x, Z − z), side (rows − y, Z − z)), r = ½ or 1, k = eighth 0–7, counter-clockwise on screen starting at +x screen (screen y points down, so "counter-clockwise" means towards −y). A piece whose arc shows only in part is keyed `<key>#p`, and the view is `partial`.
  - `exactViews(s, Z)` keys for shapes with no rounds are unchanged.
- Geometry rules the views must follow (from the spec):
  - Cylinder: top = full circle (8 eighths), front and side = d-wide rectangle on grid lines, no inner line.
  - Roof axis x: side view = half circle (the 4 upper eighths, k 0–3 on screen) on a 2-wide base line; top and front = rectangles, no crest line. Axis y: the same with front and side swapped.
  - In a view, a lattice piece that meets a circle only at a tangent point (a rational point) is judged on both sides of it; a crossing at any other point is not on the 1/60 grid: compute it in floats only to split stretches, and if the piece then changes kind it is `#p` (partial). An arc eighth is judged by sampling its middle and both ends ± a small angle on both sides (inside/outside, offset 1/120 of a cell, sample points rounded to the ×S grid).

- [ ] **Step 1: Write failing tests** in `tests/core/exactViews.test.ts` (`describe('round pieces')`):
  - A lone 1×1 cylinder on the floor of a 1×1 grid, Z = 1: `top` is the 8 keys `C0.5:0.5|0.5|0…7` and nothing else; `front` and `side` are the 4 unit edges of the square `0:0`–`1:1`; `partial` false.
  - A 2×2 cylinder on a flat 2×2 of height 1, Z = 2: `top` = the 8 eighths of `C1:1|1|k` plus the 8 unit edges of the outer square (the corners show `top1`, the circle `top2`; the inner cell edges lie inside the circle). `front` = the 8 unit edges of the 2×2 outline plus the 2 unit pieces at height 1 (`front0` below, the curved face above); the inner vertical at x = 1 is not a line (both sides `front0` or both the curved face).
  - A roof `{kind:'roof',x:0,y:0,len:1,axis:'x'}` on a 1×2 floor (cols 1, rows 2), Z = 1: `side` = 4 eighth keys of `C1:1|1|0…3` + base line `0:1|1:1`, `1:1|2:1`; `top` and `front` = rectangles.
  - The same roof with a column of height 2 behind it in its view direction gives the column's outline crossing the half circle → `partial` true.
  - Shapes with no rounds: `exactViews` equals the stored views for 50 random slope shapes (the existing equality test against `shapeViews` passes unchanged).
- [ ] **Step 2: Run** `npx vitest run tests/core/exactViews.test.ts --maxWorkers=3` — FAIL.
- [ ] **Step 3: Implement** the piece types and the arc support in `exactViews` (`relOutline` handles `kind: 'arc'`; arcs never come from cubes or ramps, so the cube/ramp fast path is untouched).
- [ ] **Step 4: Run** the full suite — PASS; add `tests/core/shapeViews.test.ts` case: `viewFills` of the lone cylinder's top view is polygons covering the circle (area within 1% of π/4).
- [ ] **Step 5: Commit** `feat: cylinder and roof B piece types with exact axis views`.

### Task 3: Exact line splitting and silhouette crossings

**Files:**
- Modify: `src/core/geometry.ts` (`linePieces`)
- Modify: `src/core/snap.ts` (new `silhouetteCrossings`)
- Test: `tests/core/geometry.test.ts`, `tests/core/snap.test.ts`, `tests/core/drawing.test.ts`

**Interfaces:**
- Produces:
  - `linePieces(line)` also splits a line in one of the 3 lattice directions (`ISO_DIRS`) whose ends have √2 parts, at every lattice point and every half point strictly between its ends (same √2 parts at both ends ⇒ a lattice direction; the rational step test runs on the rational parts). Other lines keep today's behaviour (the old `shortcut:` comment goes).
  - `silhouetteCrossings(lines: SegKey[]): Pt[]` — for every drawn line with √2 parts in one lattice direction, every point where it crosses a lattice line of the other 2 directions (`t` = integer, `m` = integer, or `t + m` = integer), strictly inside the drawn line. Exact: only additions of halves and √2 halves.

- [ ] **Step 1: Write failing tests:**
  - With `p = eighthPoint('z', {t:0,m:0}, 0.5, 1)`: `linePieces({a: p, b: {...p, m: p.m + 2}})` gives 2 keys, split at `{...p, m: p.m + 1}`.
  - `old √2-end keys still erase` (drawing.test): a drawing saved with one unsplit √2 key loads, renders its key, and `erase` of that key removes it.
  - `silhouetteCrossings([segKey(p, {...p, m: p.m + 2})])` (p as above; a vertical line keeps `t`, `rt`) holds the points with `t + rt√2` fixed where `m + rm√2` is a whole number (`m = k − rm√2` form) or where `t + m` is whole, each strictly inside the line, compared by `ptKey`; `silhouetteCrossings` of a rational line is empty.
- [ ] **Step 2: Run** these 3 test files — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full suite — PASS (existing Draw and arc tests unchanged).
- [ ] **Step 5: Commit** `feat: exact splitting of √2 lattice lines and silhouette crossing points`.

### Task 4: Solver and brute force with round pieces

**Files:**
- Modify: `src/core/pieces.ts` (`PIECES = [CUBE, RAMP, CYL1, CYL2, ROOF]`, `starts` for the rounds)
- Modify: `src/core/fastSolver.ts` (key parsing: `ends` and `cap` read arc keys — an arc key's x span is `cx ± r`, its top `cy − r` for a full circle, `cy − r` for the upper half circle; the found `Shape` carries `curves`)
- Modify: `tests/helpers/bruteForce.ts` (`eachShape(cols, rows, maxH, f, o?: { rounds?: boolean })`)
- Modify: `src/core/rampSolver.ts` only if its tests break (it is the old reference; leave it cube+ramp)
- Test: `tests/core/fastSolver.test.ts`, `tests/core/bruteForce.test.ts`

**Interfaces:**
- Consumes: Task 1 shapes, Task 2 piece types and views.
- Produces: `solveShapes(v, cols, rows, maxH, o)` counts shapes made of cubes, ramps and rounds; signature unchanged. `starts(x, y)` for each round gives its placements whose other cells come later in the search order (column by column, front row first): cylinder 1 at (x, y); cylinder 2 and roofs from their low corner.

- [ ] **Step 1: Write failing tests:**
  - Brute force (`describe.each` over 2×2×2, 2×3×2, 3×2×2): for every view class with rounds that has no `partial` shape, `solveShapes(views, …, {limit: 99})` equals the class size; for every class, a member's `solveShapes` count ≥ 1. Mark the 2×3×2 case as the slow one (skip in CI with the existing skip pattern if it passes 60 s).
  - A known cube-and-ramp target keeps its count (existing tests).
- [ ] **Step 2: Run** `npx vitest run tests/core/fastSolver.test.ts tests/core/bruteForce.test.ts --maxWorkers=3` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full suite — PASS. Record in the commit message the time of the slowest brute-force case.
- [ ] **Step 5: Commit** `feat: solver knows cylinders and roof B (brute-force checked)`.

### Task 5: Iso picture and fairness with round pieces

**Files:**
- Modify: `src/core/sketch.ts` (`shapeEdges` for shapes with rounds; `sketch` gains candidate elements)
- Modify: `src/core/visibility.ts` (`fairShape` counts rounds; partly hidden seams allowed)
- Test: `tests/core/sketch.test.ts`, `tests/core/visibility.test.ts`

**Interfaces:**
- Consumes: Task 2 faces (strips share the `cv:` key), Task 3 `linePieces`, `silhouetteCrossings` maths, `arcs.ts` (`eighthPoint`, `arcPieces`, `extrude` silhouette rule).
- Produces:
  - `shapeEdges(s, o)` keeps its return type. For shapes with rounds, its `shape` set holds lattice line pieces, `ArcKey`s of visible ellipse eighths, and silhouette lines as `linePieces` keys; `owners` holds `'v:' + i` for round i.
  - Candidate elements: each round contributes the `ArcKey` eighths of its top and bottom ellipses (cylinder) or its 2 end half-ellipses and base edges (roof), and its 2 silhouette lines (the eighth points farthest to each side of the axis' screen direction, as `extrude` picks them). Each element is judged with the face sampling of `sketch` (arc samples offset 1/120 of a cell, larger than the strip chord error).
  - A lattice line piece that is partly hidden: each run end must match (|Δ| < 1e-6 in screen units) a crossing of that piece with a visible silhouette line; then the visible part becomes exact keys from `linePieces`. Any unmatched end, or any partly hidden arc eighth or silhouette line, makes `partial` true.
  - A partly hidden seam does not make `partial` true.
  - Cube-only and ramp shapes: output unchanged.
  - `fairShape(s, maxH)`: also every round shows in the front or the back picture (`'v:' + i`, rotated index the same: `rotateShape` keeps round order).

- [ ] **Step 1: Write failing tests** (`tests/core/sketch.test.ts`, `describe('round pieces')`):
  - Lone 1×1 cylinder on the floor: `shape` = 8 eighths of the top ellipse, the 4 front eighths of the bottom ellipse (the ones between the silhouette points on the viewer's side), the 2 silhouette lines; `partial` false.
  - `cylinder on a cube clips back edges at the silhouette`: 1×1 cylinder on a 1×1 stack of height 1, Z 2: each of the 2 back edges of the cube top shows only from its side corner (left or right corner of the top square) to its crossing with the nearer silhouette line, as one key `segKey(corner, crossing)`, where `crossing` is in `silhouetteCrossings` of that silhouette line; the rest of the edge is not in `shape`; `partial` false.
  - A cube left-front of a floor cylinder whose vertical edge cuts the bottom ellipse: `partial` true.
  - `back picture clips exactly`: `shapeEdges(rotateShape(s), { clip: true })` of the stack case gives the same exact crossing keys (mirrored), not 1/120-rounded ones.
  - `fairShape`: a cylinder fully hidden behind a taller column in both pictures → false.
- [ ] **Step 2: Run** `npx vitest run tests/core/sketch.test.ts tests/core/visibility.test.ts --maxWorkers=3` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full suite — PASS (the `sketch-artefacts.json` fixtures unchanged).
- [ ] **Step 5: Commit** `feat: iso picture and fairness with round pieces, exact clipping at silhouettes`.

### Task 6: Curves generator and the recheck script

**Files:**
- Modify: `src/core/generator.ts` (`curveCandidate`)
- Create: `scripts/gen-curves.ts` (worker / merge, as `scripts/gen-slopes.ts`, sizes `''`, `4x4x3`, `4x5x4`)
- Create: `scripts/recheck-slopes.ts` (runs `solveShapes` on the 75 Slopes puzzles with the new `PIECES`, prints ids with count ≠ 1)
- Test: `tests/core/generator.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `curveCandidate(cols, rows, maxH, r: Rng, o: { budget?: number; timeoutMs?: number }): Shape | null` — `stairShape` base, then 1–3 rounds placed where they fit (2×2 cylinders and 2×2 roofs weighted ×3: the owner wants bigger pieces), no ramps; null unless `fairShape`, not `partial`, and `solveShapes(..., {limit: 2})` gives exactly 1 without giving up. `timeoutMs` stops the solver (check the clock in the solver's budget callback or between steps; a timeout is a reject).
  - `gen-curves.ts merge` writes 25 entries per size with set `'curves'` and ids/levels from Global Constraints; it replaces only its own set+level and keeps every other entry byte-identical; `pickVaried` with variety ≥ 3; prefer more round cells, then seed.
- [ ] **Step 1: Write failing test:** `curveCandidate(3, 3, 3, rng(seed))` for the first seed in 1…200 that returns a shape: the shape has rounds, `fairShape` true, `solveShapes(exactViews(...))` count 1. (Search runs in the test; keep it under 20 s.)
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `curveCandidate` and both scripts.
- [ ] **Step 4: Run** the full suite — PASS. Then a 3-minute single-worker sample per size: print seconds per accepted puzzle (estimate per-puzzle wall time for 3 jobs). **If any size is over 60 s per puzzle, or the sample shows low variety (fewer than half of the found shapes pass `pickVaried`), stop and report to the owner before Task 8.**
- [ ] **Step 5: Commit** `feat: Curves candidate generator, gen-curves and Slopes recheck scripts`.

### Task 7: Grid — midpoint dots near the finger, crossing snap points

**Files:**
- Modify: `src/ui/grid/IsoGrid.ts` (`free.half` behaviour, extra points)
- Modify: `src/core/snap.ts` (`snapPoint` takes the shown midpoints instead of all midpoints)
- Modify: `src/ui/screens/draw.ts` (`half: true`)
- Test: `tests/ui/grid.test.ts`, `tests/core/snap.test.ts`

**Interfaces:**
- Consumes: `silhouetteCrossings` (Task 3).
- Produces:
  - `SnapOpts = { half: boolean; near?: UV; extra: Pt[] }`: with `half`, only edge midpoints within `NEAR_DIST = 1` grid step of `near` are candidates.
  - IsoGrid: while a line or arc stroke drags, faint dots (class `near-dot`, radius 0.05, the existing `gSnap` group) show at the edge midpoints within `NEAR_DIST` of the pointer; they vanish on pointer up. Below `MIN_DOT_SCALE` no dots show and `half` snapping is off. `extraPoints()` adds `silhouetteCrossings(d.lines)` (always shown as now for extra points).
  - Draw: `free: { half: true, mids: true }`. Views: `free: { half: <puzzle has rounds> }` (set in Task 8).
- [ ] **Step 1: Write failing tests:**
  - `snapPoint` with `half` and `near` far from a midpoint returns the grid dot, near it returns the midpoint.
  - grid.test: during a simulated drag, `.near-dot` elements exist only near the pointer and none after pointer up; `no hidden snap when zoomed out`: at scale below `MIN_DOT_SCALE` a drag ending on a midpoint snaps to a grid dot.
  - `crossing snap point`: with a drawn silhouette line, a drag ending near its crossing with a grid line stores the exact crossing key.
- [ ] **Step 2: Run** `npx vitest run tests/ui/grid.test.ts tests/core/snap.test.ts --maxWorkers=3` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full suite — PASS.
- [ ] **Step 5: Commit** `feat: midpoint dots near the finger and silhouette crossing snaps`.

### Task 8: Curves in Views screens, sets generated, version 4.6

**Files:**
- Modify: `src/ui/components/viewsPanel.ts` (draw `C…` arc keys as SVG arcs/polylines; fills for rounds; `createViewsPanel(hm, maxH, ramps, curves?)`)
- Modify: `src/ui/screens/viewsPuzzle.ts` (shape with curves uses `shapeEdges`; `free.half` on when the puzzle has rounds; title `S.curvesN`)
- Modify: `src/ui/screens/levels.ts` (Curves 1–3 tiles after Slopes 1–3, `data-set="curves"`, `data-curves`; empty set hidden)
- Modify: `src/ui/strings.ts` (`curvesN: (n) => \`Curves ${n}\``, `curvesSizes: ['3×3–3×4', '4×4×3', '4×5×4']`)
- Modify: `src/ui/router.ts` only if `#/views/<id>` filters by set
- Modify: `public/puzzles.json` (generated), `package.json` (4.6.0), `tests/ui/settings.test.ts` (version)
- Test: `tests/ui/viewsPuzzle.test.ts`, `tests/core/puzzles-file.test.ts`, `tests/ui/home.test.ts` or the levels test file in use

- [ ] **Step 1: Write failing tests:**
  - puzzles-file: each of CV / CV2 / CV3 has 25 entries with rounds, sizes as Global Constraints, `fairShape` true, `solveShapes` count 1 (mark slow like the SL checks), variety ≥ 3; every non-curves entry equals the committed file before this task.
  - viewsPuzzle: a Curves puzzle's views panel has arc elements; a correct drawing (answer keys) checks as solved; the answer overlay draws arc keys.
  - levels: Views list order is L1, L2, Slopes 1–3, Curves 1–3, L3–L6, Endless.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement the UI**, then generate under `systemd-inhibit` with 3 jobs per size: `npx tsx scripts/gen-curves.ts worker [<size>] <i> 3 <count> part-<i>.json` and `merge`. Keep the owner rule (Global Constraints); a size that fails it is left out (its tile stays hidden) and reported. Run `scripts/recheck-slopes.ts` and note the result for the owner (change no Slopes puzzle).
- [ ] **Step 4: Run** the full suite, `npx tsc --noEmit`, `npm run build`, `npm run e2e` — PASS. Try on desktop: open Curves 1 #1, draw the answer, Check → solved; the ⟲ back picture shows.
- [ ] **Step 5: Commit** (data separate from code): `feat: Curves sets in Views (version 4.6)` and `data: Curves 1–3 puzzles`.

### Task 9: Final review, merge, deploy

- [ ] **Step 1:** Final whole-branch review (most capable model) against the spec.
- [ ] **Step 2:** `git merge --ff-only` into `main`, push; wait for the Pages deploy; open the live site and check the version shows 4.6 and Curves 1 #1 opens.
- [ ] **Step 3:** Update the memory file with the live commit, deferred minors, and the Slopes recheck result.
- [ ] **Step 4:** Report to the owner: what works, how to try it on the phone (Views → Curves 1; drag the line tool to see the midpoint dots), the generation time per set, and any dropped size.
