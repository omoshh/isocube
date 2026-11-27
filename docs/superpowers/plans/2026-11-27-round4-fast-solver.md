# Round 4 — fast solver — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A cube-and-ramp solver that gives the true solution count, fast enough to generate the phase 4 levels on the owner's laptop, with a slot where phase 3 plugs in curved pieces.

**Architecture:** New exact view code (`exactViews`) gives the same keys as `shapeViews` without floats: each axis view is built from per-cell cross-sections in whole numbers scaled by 60, and each line piece is judged at the midpoints between its exact critical points. A brute-force counter (test helper) is the ground truth at small sizes. The new solver (`fastSolver.ts`) keeps today's search order and checks, but asks `exactViews`; piece choices per cell come from a `PIECES` list. The old solver and `shapeViews` stay as references until the switch in the last task.

**Tech Stack:** TypeScript, Vitest, tsx scripts.

**Spec:** `docs/superpowers/specs/2026-11-27-round4-fast-solver-design.md`; background `docs/2026-11-27-round4-design.md`.

## Global Constraints

- All new checks are exact: whole numbers (coordinates ×60) or exact fractions; no float decides a line.
- `exactViews` must equal `shapeViews` in every key, including `#p` (partly hidden) marks.
- Ground truth is brute force where it runs (2×2 up to height 3; 2×3 and 3×3 up to height 2). The old solver is a second reference only.
- Generation target: 50 accepted puzzles per phase 4 level (4×4×3, 4×5×4, 5×5×4, 5×6×5; cubes + ramps; stair shapes; ramp length 1–3; about 1–3 pieces at level 3 up to 2–5 at level 6) in under 2 hours wall time with 8 workers on this laptop (Ryzen 5 5600H), counting every candidate tried.
- "Gave up" (step budget hit) never counts as one solution.
- The Slopes set (SL-001…025) changes only if a puzzle there is shown to have two answers; then only that puzzle and only its save data go (tell the owner).
- Long tests run only with `SLOW=1` (`it.runIf(process.env.SLOW)`), not in `npm test`.
- Version 4.4 at the end; merge and push to `main` without a PR; tests first in `src/core`; one commit per task.

## Review Focus

1. Ramps seen edge-on or crossing columns (length 2–3 E/W in the front view, N/S in the side view) make diagonals through non-lattice crossings: `exactViews` must mark `#p` exactly where `shapeViews` does (Task 1 random test, sizes up to 5×6×5 with long ramps forced).
2. Two ramps end to end on one slope share a plane: a seam, not a line, in every view (Task 1 test).
3. A shape whose solution count differs between the old solver and brute force: the plan must surface it, not hide it (Task 2 report).
4. The step budget: a hard candidate must come back "gave up", never "1" (Task 3 test with a tiny budget).
5. Switching the generators must not change any shipped puzzle (Slopes fixture test, Task 5).

---

### Task 1: Exact views

**Files:**
- Create: `src/core/exactViews.ts`
- Test: `tests/core/exactViews.test.ts`

**Interfaces:**
- Consumes: `Shape`, `Ramp`, `rampCells`, `baseZ`, `slopePlane` (`solid.ts`); `viewKey` (`shapeViews.ts`); `ViewSet` (`views.ts`).
- Produces:
  - `exactViews(s: Shape, Z: number): ViewSet & { partial: boolean }` — the same keys as `shapeViews(s, Z)`.
  - `exactView(s: Shape, Z: number, v: 'top' | 'front' | 'side'): { keys: Set<string>; covered: Map<string, boolean> }` — one view, with `covered` as `viewSketch` gives it (the solver's per-strip check needs it).
  - `PIECES: PieceType[]` in a new `src/core/pieces.ts`. The fields of `PieceType` are **the builder's call**; it must let a piece type give (a) the cells it covers and its base, (b) its 3D faces (for `shapeFaces`), (c) its cross-section in each axis view with the plane key of the face seen at each depth. `cube` and `ramp` are the two entries; `exactView` reads sections only through `PIECES`.

**Algorithm (the part the tests do not fix):** in an axis view, every visible point belongs to the first cell, in depth order, whose cross-section contains it; within that cell the piece type names the face plane. All edges have slopes 0, ∞, ±1, ±½, ±⅓ and end on lattice points, so their crossings have denominators dividing 60. For each lattice piece (`viewKey`), collect the exact crossing parameters along it with every other projected edge, and judge the piece at the midpoint of each sub-interval, on both sides (offset by one unit of the ×60·k grid, k large enough to stay inside the neighbouring face): line where the nearest planes differ or one side is empty; seam where both sides share a plane; `#p` when the sub-intervals disagree. `covered` = both sides non-empty at every sub-interval.

- [ ] **Step 1: Failing tests** in `tests/core/exactViews.test.ts`:
  - `equalsShapeViewsSmall`: every valid cube-and-ramp shape on 2×2 with heights 0–2 (enumerate as the existing brute-force test does): `exactViews(s, 2)` keys equal `shapeViews(s, 2)` keys in all 3 views, and `partial` matches.
  - `equalsShapeViewsRandom`: 2,000 random valid shapes (seeded `rng`, sizes 2×2…5×6, heights to 5, 0–5 ramps with lengths 1–3 weighted to 2–3) equal `shapeViews`; with `SLOW=1`, 20,000.
  - `coveredEqualsSketch`: on the same 2,000, `exactView(s, Z, v).covered` equals `viewSketch(s, Z, v).covered` for front and side.
  - `seamOnOneSlope`: two E ramps of length 1 end to end on one base (`slopePlane` keys equal): no line between them in any view.
  - `faster`: on 200 random 4×4×3 shapes, `exactViews` total time is at most 1/20 of `shapeViews` (print both).
- [ ] **Step 2:** `npx vitest run tests/core/exactViews.test.ts` — FAIL (module missing).
- [ ] **Step 3:** Implement `pieces.ts` and `exactViews.ts`. `shapeFaces` (`solid.ts`) may be refactored to read faces from `PIECES`; its output must not change (existing tests).
- [ ] **Step 4:** `npx vitest run tests/core` — PASS; then `SLOW=1 npx vitest run tests/core/exactViews.test.ts` — PASS.
- [ ] **Step 5:** Commit `feat(core): exact views for cubes and ramps, piece types`

### Task 2: Brute-force ground truth, and the old solver checked against it

**Files:**
- Create: `tests/helpers/bruteForce.ts`
- Test: `tests/core/bruteForce.test.ts`

**Interfaces:**
- Consumes: `exactViews`, `validShape`.
- Produces: `allShapes(cols: number, rows: number, maxH: number): Shape[]` (every valid shape: heights 0..maxH, any non-overlapping ramps of length 1–3 fitting `validShape`), and `viewClasses(cols, rows, maxH): Map<string, Shape[]>` keyed by the 3 views' sorted keys (skip shapes with `partial`).

- [ ] **Step 1: Tests:**
  - `allShapesSmall`: `allShapes(1, 1, 1)` has exactly the 1×1 shapes (heights 0, 1; ramps E/W/N/S on height 0) — count them by hand in the test.
  - `oldSolverAgreesSmall` (`SLOW=1`): for every view class of 2×2 (heights 0–3), 2×3 (0–2) and 3×3 (0–2), `countShapeSolutions(views, …, limit 3)` equals `min(class size, 3)`. On a mismatch the test prints the shape and both counts (do not stop at the first).
- [ ] **Step 2:** Run both; the first FAILS (module missing).
- [ ] **Step 3:** Implement the helper. 3×3 at height 2 must finish in a few minutes (use `exactViews`; if it does not, stop at 2×3 and say so in the ledger).
- [ ] **Step 4:** `SLOW=1 npx vitest run tests/core/bruteForce.test.ts`. **If the old solver disagrees anywhere:** keep the failing cases as a fixture (`tests/fixtures/solver-mismatch.json`), mark the test `it.fails` with a comment, write the finding in the ledger, and re-check every Slopes puzzle with brute force where its size allows and with Task 3's solver otherwise (Task 3, step 5).
- [ ] **Step 5:** Commit `test: brute-force ground truth for cube-and-ramp views`

### Task 3: Fast solver

**Files:**
- Create: `src/core/fastSolver.ts`
- Test: `tests/core/fastSolver.test.ts`

**Interfaces:**
- Consumes: `exactView`, `PIECES`, the brute-force helper (tests).
- Produces: `solveShapes(v: ViewSet, cols: number, rows: number, maxH: number, o?: { limit?: number; budget?: number; onSolution?: (s: Shape) => void }): { count: number; gaveUp: boolean }`. Same search as `countShapeSolutions` (column by column, front row first; top checked per cell; per-cell strip checks; column check; full check at a leaf), with every view check done by `exactView`, and the piece choices at a cell from `PIECES`. `budget` = maximum search steps; when hit, return `{ count, gaveUp: true }` at once. Targets with a `#p` key throw, as today.

- [ ] **Step 1: Tests:**
  - `matchesBruteForce`: every view class of 2×2 (heights 0–2): `solveShapes(…, { limit: 3 }).count === min(class size, 3)`; with `SLOW=1` also 2×3 and 3×3 at height 2.
  - `keepsOldCases`: the cases of `tests/core/rampSolver.test.ts` (lone ramp 1; hidden low centre 10 with limit 20; ramp twin 2; partly hidden target throws; the three review cases 1).
  - `solutionsAreReal`: for 50 random fair 3×3 candidates, every shape passed to `onSolution` has `shapeViews` equal to the target.
  - `budgetGivesUp`: a 3×4 target with `budget: 10` returns `gaveUp: true` and never `{ count: 1, gaveUp: false }`.
  - `matchesOldSolver` (`SLOW=1`): all 25 Slopes puzzles and 300 random fair 3×3/3×4 candidates: same count as `countShapeSolutions` (limit 2). If Task 2 found the old solver wrong, the brute-force answer wins where it exists, and mismatches the old solver explains by that finding are listed, not failed.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run tests/core` and `SLOW=1 npx vitest run tests/core/fastSolver.test.ts` — PASS.
- [ ] **Step 5 (only if Task 2 found the old solver wrong):** count every Slopes puzzle with `solveShapes` (limit 2); list any with 2 answers in the ledger. Task 5 replaces them.
- [ ] **Step 6:** Commit `feat(core): fast cube-and-ramp solver with a step budget`

### Task 4: Measure at phase 4 sizes, decide on the column-first method

**Files:**
- Create: `scripts/time-solver.ts` (kept: phase 4 reuses it)
- Modify: `docs/superpowers/specs/2026-11-27-round4-fast-solver-design.md` (add a "Measured" section)

**Interfaces:**
- Consumes: `slopeCandidate`-style candidates (`stairShape` + ramps), `fairShape`, `exactViews`, `solveShapes`.
- Produces: `npx tsx scripts/time-solver.ts <cols> <rows> <maxH> <minPieces> <maxPieces> <seconds>` prints: candidates tried, fair, unique, gave up, median and 95th-percentile solve time, and the projected hours for 50 accepted puzzles on 8 workers.

- [ ] **Step 1:** Write the script (a measuring tool, no test; it imports only tested code).
- [ ] **Step 2:** Run it 10 minutes per level size: `4 4 3 1 3`, `4 5 4 2 4`, `5 5 4 2 4`, `5 6 5 2 5`, budget off. Put the table in the design doc.
- [ ] **Step 3: Decide.** All four projections ≤ 2 hours → done, no column-first method. Any over → write the finding and stop for a new plan (column-first is its own plan; do not start it here). Then rerun with a budget equal to the 99th-percentile steps to see whether dropping the slowest candidates alone brings it under 2 hours; note it.
- [ ] **Step 4:** Commit `docs: fast solver measured at phase 4 sizes`

### Task 5: Switch the generators, Endless limits, version 4.4, deploy

**Files:**
- Modify: `src/core/generator.ts` (`slopeCandidate` uses `solveShapes`; `fairShape` unchanged), `src/core/generator.ts` constants `SLOPES_MAX`/`SLOPES_H` and their tests (`tests/core/generator.test.ts`, `tests/ui/home.test.ts`, `tests/ui/endless.test.ts` where they name sizes), `package.json`, `package-lock.json` lines 3 and 9, `tests/ui/settings.test.ts` (version)

- [ ] **Step 1:** `slopeCandidateUnchanged` (fixture) and `makeEndlessSlopes` still pass after the switch — run them first against the switched code; they are the regression gate.
- [ ] **Step 1b (only if Task 3 step 5 listed Slopes puzzles with 2 answers):** replace each listed puzzle, keeping its id, with an unused one-answer candidate of the same size from `scripts/gen-slopes.ts worker` output (variety rule ≥ 3 cells against the other 24); remove only that id's save data (solved id, drawing `views/<id>`, lives) through the existing purge path, with a test that other ids' data stays. Tell the owner which numbers changed.
- [ ] **Step 2:** Re-time Endless slopes sizes as in phase 2b (seeds 1–5, median and max, 8 in parallel): width and depth 2–4, height 2–3. Raise `SLOPES_MAX`/`SLOPES_H` only where the median is ≤ 3 s; if height 3 passes at some sizes but not others, keep the one-rule form (largest width/depth for which height 3 passes) **(builder's call)**. Update the clamp tests to the new limits first, watch them fail, then change the constants.
- [ ] **Step 3:** Version 4.4. `npx vitest run`, `npm run build`, `npm run e2e` — all PASS.
- [ ] **Step 4:** Browser check (Pixel 7 size): Endless with Slopes at the new largest size opens in under 3 s; the answer shows. Screenshot.
- [ ] **Step 5:** Final review; Critical/Important fixed with tests; merge `--ff-only`, push, watch the deploy; update memory; report to the owner: what is faster, the new Endless limit, the measured phase 4 hours, anything Task 2 found about the old solver.
- [ ] **Step 6:** Commit per change (`feat: generators use the fast solver; Endless slopes limit …`, `chore: version 4.4`).
