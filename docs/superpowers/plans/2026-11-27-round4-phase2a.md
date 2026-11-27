# Round 4 Phase 2a (Slopes set) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Views gets a **Slopes** set of 25 fair, one-solution puzzles (3×3 and 3×4, height up to 3) with ramps, drawn and checked like the cube puzzles.

**Architecture:** A shape is a height map plus ramps. Shapes with ramps are drawn by a general hidden-line "sketch": every face is a 3D polygon; each edge piece (split at lattice points) is classified by the nearest face just left and just right of it, at several points along it. The same sketch makes the iso answer (front and back), the 3 views, and the fairness data. Cube-only shapes keep the current code (`computeEdges`, `views`, `countSolutions`). A new solver counts cube-and-ramp shapes with the same views (column by column; top view checked per cell, front view per finished column, side view on covered parts). Phase 2b (Endless size picker and slopes switch) is a separate plan.

**Tech Stack:** TypeScript, Vitest, tsx script. No new dependencies.

**Spec:** `docs/2026-11-27-round4-design.md` (Pieces: Ramp; Views pictures and the checker; Puzzles; Sets; Phases item 2).

## Global Constraints

- Ramp: 1 cube high, length 1–3 cells along X or Y, rises toward N, E, S or W along its length; stands on a flat area (all cells under it the same stack height, 0 or more); nothing on it; stack height + 1 ≤ maxH.
- Cube-only puzzles, their views, answers and saves do not change (`puzzles.json` entries other than the new set stay byte-identical).
- Checks are exact: keys are lattice keys (`linePieces`), never float.
- Fairness: every ramp, and every cube `neededCubes` lists, shows a face in the front or the back picture. One solution among all cube-and-ramp shapes in the same size. A visible line of the front picture or of a view must not end between lattice points (generator rejects).
- Variety (builder's call): two Slopes puzzles differ in at least 3 cells (height or ramp part).
- Ids `SL-001` … `SL-025`, set `'slopes'`, level 0. Row text "Slopes", size "3×3–3×4" (builder's call). No Endless button on the Slopes row (phase 2b).
- Version 4.2 at the end. Merge and push to `main` after the final review.

## Review Focus

1. Every existing cube puzzle: the sketch gives the same answer lines and seams as `computeEdges` (Task 2 test over `puzzles.json`).
2. A ramp seen edge-on (length 1 rising W or S, 45°) must not leave holes or crash the sketch (Task 2 test).
3. Two ramps side by side with the same slope are one plane: seam, not outline, in the iso picture; no line in the top view (Task 2/3 tests).
4. The solver finds a second solution when one exists (a ramp that a flat cube column can imitate in all 3 views) (Task 4 test).
5. Saved progress: new ids never collide with old ones; old drawings and lives stay (Task 5 test: old ids unchanged).

---

### Task 1: Shape model with ramps

**Files:** Create `src/core/solid.ts`; Test `tests/core/solid.test.ts`

**Interfaces — Produces:**
- `type Dir = 'N' | 'E' | 'S' | 'W'` (E = +x, N = +y = toward the back; y = rows − 1 − r as in `HeightMap.cubes`).
- `type Ramp = { x: number; y: number; len: 1 | 2 | 3; dir: Dir }` — (x, y) is the low-end cell; the ramp covers `len` cells from there in `dir`.
- `type Shape = { hm: HeightMap; ramps: Ramp[] }`; `rampCells(r): [number, number][]`; `baseZ(shape, r): number` (stack height under it).
- `validShape(s: Shape, maxH: number): boolean` — cells inside, flat base, no overlap, base + 1 ≤ maxH.
- `type Face3 = { pts: [number, number, number][]; plane: string; owner: string }` — owner `c:x,y,z` for cubes, `r:i` for ramps; plane keys: cube faces as `facePlane`; ramp side triangles share the cube plane keys (`front<y>`, `side<x>`, …); slanted face `s:<dir>:<len>:<low edge coordinate>:<base>`.
- `shapeFaces(s: Shape, view: [number, number, number]): Face3[]` — faces whose outward normal has a positive dot product with `view` (iso: (−1, −1, 1); front view: (0, −1, 0); side: (−1, 0, 0); top: (0, 0, 1)), cube faces only where not covered by a neighbour cube or ramp.
- `rotateShape(s: Shape): Shape` — 180° about the vertical axis (cells as `rotate180`, ramp low end and dir mirrored).
- `toEntryRamps(rs: Ramp[]): [number, number, number, Dir][]` and `fromEntryRamps(...)` for `puzzles.json`.

- [ ] **Step 1: Failing tests:** E ramp len 2 on a 3×1 flat row of height 1 → `validShape` true; on uneven base → false; base + 1 > maxH → false; overlap → false. `shapeFaces` for one cube with an E ramp len 1 on top (iso view): cube top face is covered (absent), slanted face present with 4 points, front triangle with plane `front0`, high wall (+x) absent. `rotateShape` twice gives the same shape; rotated E ramp becomes W with mirrored low end.
- [ ] **Step 2:** `npx vitest run tests/core/solid.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Same → PASS.
- [ ] **Step 5:** Commit `feat(core): shapes with ramps (model and faces)`

### Task 2: The sketch (general hidden lines) and iso edges

**Files:** Create `src/core/sketch.ts`; Test `tests/core/sketch.test.ts`

**Interfaces — Produces:**
- `sketch(faces: Face3[], to2: (p: P3) => [number, number], depth: (p: P3) => number, key: (a: [number, number], b: [number, number]) => string[]): { lines: Set<string>; seams: Set<string>; partial: boolean; owners: Set<string>; covered: Map<string, boolean> }`
  - candidate pieces: every projected face edge, split by `key` (lattice pieces);
  - for each piece, at fractions 0.1, 0.3, 0.5, 0.7, 0.9, the nearest face (smallest depth; depth by the face plane along the view ray; containment in the projected polygon) at the point moved ±1e-4 perpendicular. Different faces with different planes, or a face on one side only → line; same plane → seam; same face/none → nothing. Classes differ along the piece → `partial = true` (piece counted as line if any sample says line);
  - `covered.get(piece)` = both sides had a face at every sample (used by the solver);
  - `owners`: owners of nearest faces at the centre of every unit grid triangle of the picture area (fairness).
- `shapeEdges(s: Shape): EdgeSet & { partial: boolean; owners: Set<string> }` — iso picture with `proj`, depth x + y − z, keys `linePieces`.

- [ ] **Step 1: Failing tests:** for every level puzzle in `public/puzzles.json` (set `level`), `shapeEdges({ hm, ramps: [] })` shape and seams equal `computeEdges(hm)`; an E ramp len 2 on the floor: the slanted edge key `linePieces` of (0,0,0)→(2,0,1) is a line; two E ramps side by side (same x, y and y+1): the edge between their slanted faces is a seam; a W ramp len 1 (edge-on) does not crash and `partial` is false; a ramp behind a taller column that hides part of a slanted edge → `partial` true.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(core): general hidden-line sketch for shapes with ramps`

### Task 3: Views of shapes with ramps

**Files:** Modify `src/core/views.ts` (or create `src/core/shapeViews.ts`); Test `tests/core/shapeViews.test.ts`

**Interfaces — Produces:**
- `viewKey(a: GPt, b: GPt): string[]` — pieces split at integer points, key format of `gridSegKey` (`x:y|x:y`, sorted), any direction.
- `shapeViews(s: Shape, Z: number): ViewSet & { partial: boolean; covered: {top,front,side maps} }` — the 3 views with the screen coordinates `viewLines` uses (top: (x, rows − y); front: (x, Z − z); side: (rows − y, Z − z)). Keys of a piece seen only in part get `#p`.
- `viewFills(s: Shape, Z): { top: P2[][]; front: P2[][]; side: P2[][] }` — projected visible faces (for the panel's grey fill).

- [ ] **Step 1: Failing tests:** cube-only: for every level puzzle, `shapeViews` equals `views(hm)` (with `Z = maxH`); E ramp len 2 at height 1: front view has the slanted pieces `0:2|2:1`-style keys (Z = 2) and no line where the triangle meets the cube front of the same plane; top view of two side-by-side same-slope ramps has no line between them.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(core): views of shapes with ramps`

### Task 4: Fairness and the solver

**Files:** Modify `src/core/visibility.ts`, create `src/core/rampSolver.ts`; Tests `tests/core/visibility.test.ts`, `tests/core/rampSolver.test.ts`

**Interfaces — Produces:**
- `fairShape(s: Shape): boolean` — every ramp owner and every `neededCubes(s.hm)` cube is in `owners` of the front or the back (`rotateShape`, owners mapped back) picture; front picture and views not `partial`.
- `countShapeSolutions(v: ViewSet, cols: number, rows: number, maxH: number, limit = 2): number` — search cells column by column (x outer, y inner); a cell state is a stack height and optionally one ramp part (dir, len, index); ramp parts force the states of the following cells; checks: top view per cell against its left and front neighbours and the border (line iff the two top planes differ); after each column, the front view of the partial shape on every piece that only columns ≤ x decide (max x ≤ x + 1, not the vertical at x + 1); after each column, the side view on every piece `covered` on both sides; at a leaf, all 3 views equal.

- [ ] **Step 1: Failing tests:** on 10 level-1 and 5 level-2 puzzles, `countShapeSolutions(views(hm), …)` ≥ `countSolutions(…)` and equals 1 only if no ramp shape copies the views (record counts; at least these must not be 0); a known ambiguous case (a single E ramp len 1 on the floor in a 1×1… use 2×1 and check against a hand-made twin shape) counts 2; a lone ramp shape counts ≥ 1; time for one 3×4×3 count under 2 s (log it).
- [ ] **Step 2–4:** FAIL → implement → PASS. If the time is over 10 s, record a ruling and narrow the cell states (e.g. ramps only on cells the top view marks as one region of the ramp's footprint).
- [ ] **Step 5:** Commit `feat(core): fair shapes with ramps and a cube-and-ramp solver`

### Task 5: The Slopes set

**Files:** Modify `src/core/generator.ts` (types, `makeSlopePuzzle`), `scripts/generate-puzzles.ts` (writes only the slopes set into the existing file), `public/puzzles.json`; Test `tests/core/puzzles-file.test.ts`

**Interfaces — Produces:**
- `PuzzleEntry.set: 'level' | 'reverse' | 'slopes'`; `PuzzleEntry.ramps?: [x, y, len, dir][]`; `entryShape(e: PuzzleEntry): Shape`.
- `makeSlopePuzzle(seed: number): { seed; shape } | null` — 3×3 or 3×4 (either way), maxH 3, `sampleShape`, then 1–3 ramps on flat runs; accept when `validShape`, `fairShape`, `countShapeSolutions === 1`.
- Script: `npm run gen -- slopes` keeps every other entry as it is and replaces the `slopes` entries; 25 puzzles, variety ≥ 3 cells, sorted by number of ramps then hidden cubes.

- [ ] **Step 1: Failing test** (`puzzles-file.test.ts`): 25 `slopes` entries `SL-001`…`SL-025`, sizes 3×3/3×4, maxH 3, each `validShape`, `fairShape`, has ≥ 1 ramp, `countShapeSolutions === 1` (slow test is fine), pairwise ≥ 3 cells apart; all `level` and `reverse` entries equal the committed file before this task (compare to a copy saved in `tests/fixtures/puzzles-r3.json` — commit that fixture first).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement and run the script; log time.
- [ ] **Step 4:** PASS. `puzzles.json` size under 150 KB.
- [ ] **Step 5:** Commit `feat: the Slopes set (25 puzzles)`

### Task 6: Slopes in the Views screens

**Files:** Modify `src/ui/screens/levels.ts`, `src/ui/screens/viewsPuzzle.ts`, `src/ui/components/viewsPanel.ts`, `src/ui/strings.ts`; Tests `tests/ui/viewsPuzzle.test.ts`, `tests/ui/levels` (existing tests file for levels, or `viewsPuzzle.test.ts`)

- Levels (views mode): a "Slopes" row after level 2: size "3×3–3×4", "n of 25", bar, numbers open `#/views/SL-…`; no Endless button.
- `mountViewsPuzzle`: title "Slopes" for set `slopes`; `Puzzle` gets `ramps`; answer and back picture from `shapeEdges` when there are ramps (else as now); next puzzle within the set.
- Views panel: for shapes with ramps, grey fills from `viewFills`, lines from `shapeViews` (cube-only panels unchanged).

- [ ] **Step 1: Failing tests:** the levels screen shows a Slopes row with 25 numbers; `SL-001` mounts with title "Slopes"; drawing exactly `shapeEdges(...).shape` and Check → solved; Answer shows that many lines; a Slopes view panel has a slanted line in the front or side view.
- [ ] **Step 2–4:** FAIL → implement → `npx vitest run` PASS.
- [ ] **Step 5:** Commit `feat(ui): Slopes set in Views`

### Task 7: Version 4.2, checks, review, deploy

- [ ] Version 4.2 (`package.json`, `package-lock.json` lines 3 and 9, settings test).
- [ ] `npm run build && npm run e2e` OK.
- [ ] Browser check (Pixel 7): open Slopes 1, the views and the turned answer look right; draw the answer with the line tool; Check says Solved. Screenshot.
- [ ] Final review; Critical/Important fixed with tests; merge `--ff-only`, push, watch deploy; report to the owner.
