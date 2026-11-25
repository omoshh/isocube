# Isocube Round 2 Implementation Plan — lives, cross-sections, shadows

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lives, cross-section puzzles and shadow puzzles to the live Isocube site.

**Architecture:** New pure modules in `src/core/` (lives, shadows, solids, sections, section animation) with tests first; new screens in `src/ui/screens/` that reuse the existing grids, checker overlays, top bar and fold-style animation controls.

**Tech Stack:** as in the web plan (TypeScript, Vite, Vitest, Playwright, GitHub Actions).

**Spec:** `docs/superpowers/specs/2026-11-25-isocube-round2-design.md` (on top of `2026-11-24-isopuzzles-web-design.md` and `docs/design/design-system.md`)

**Names:** this plan uses the names from `2026-11-24-isopuzzles-web.md` (`HeightMap`, `computeEdges`, `checkDrawing`, `EdgeSet`, `createIsoGrid`, storage functions, `Backup`, …). Where the built code uses other names, use the built names and keep the behaviour described here. First step of Task 1: read the current `src/core/` and `src/ui/` and note the real names in the task's commit message.

## Global Constraints

- Everything from the web plan's Global Constraints still holds (tokens only, `src/core/` without DOM, base `/isocube/`, English only, save on every change).
- Lives: 3 per puzzle; lost on a failed Check or a wrong pick; 0 → same puzzle restarts; Answer → "revealed", not solved; Settings "Lives" switch, default on; draw mode has no lives.
- Solved ids: sections `X<level>-<seed>`, shadows `S<level>-<puzzle id>`. All count towards accents.
- Backup schema version 2; version 1 files still import.

## Review Focus

1. **Reload to refill lives** — reloading or leaving and reopening a puzzle keeps the lives left and the revealed flag. Test in Task 1.
2. **Old backup after the schema change** — a version 1 backup imports with empty new fields; nothing existing is lost. Test in Task 8.
3. **Degenerate cuts** — collinear points, all points on one face, or a sliver cut are never offered. Test in Task 4.
4. **Look-alike options** — no two options are similar, mirror images included, at all levels. Test in Task 5.
5. **Shadow parts hidden under the shape** — the outline includes them, and the semi-transparent shape keeps the grid under it drawable. Test in Task 3.

---

### Task 1: Lives

**Files:** Create `src/core/lives.ts`; Modify storage (`src/ui/storage.ts`), settings screen, top bar, views/reverse/nets screens; Test `tests/core/lives.test.ts`, `tests/ui/lives.test.ts`

**Interfaces:**
- Produces:
  - `type LivesState = { left: 0|1|2|3; revealed: boolean }`; `const START: LivesState = { left: 3, revealed: false }`
  - `loseLife(s: LivesState): { state: LivesState; restart: boolean }` — at 0 → `restart: true` and `state = START`.
  - `reveal(s: LivesState): LivesState`; `countsAsSolved(s: LivesState, livesOn: boolean): boolean` (= `!livesOn || !s.revealed`).
  - Storage: `loadLives(key): Promise<LivesState>`, `saveLives(key, s)`; key = the puzzle's drawing key. `Settings` gains `lives: boolean` (default `true`).
  - Top bar: 3 marks (`aria-label="Lives: n of 3"`), hidden when lives are off. A restart shows "Out of lives — the puzzle starts again" for 3 s and clears the drawing (one undo step is not kept).

- [ ] **Step 1: Failing tests** — `threeFailsRestart`; `revealNotSolved` (`countsAsSolved(reveal(START), true) === false`, `true` with lives off); `reloadKeepsLives` (save left=1, new screen instance → 1 mark); `livesOffUnlimited` (5 failed Checks, no restart); `wrongNetsPickCostsLife`.
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: lives` (list the real module names found in step 1 of this task).

---

### Task 2: Shadow core

**Files:** Create `src/core/shadows.ts`; Test `tests/core/shadows.test.ts`

**Interfaces:**
- Consumes: `HeightMap`, lattice helpers.
- Produces:
  - `type Light = 'down' | 'front' | 'side' | 'slant'` (levels 1–4 in that order).
  - `shadowCells(h: HeightMap, light: Light): Set<string>` — unit cells on the target plane: `down` → floor cells under any cube; `front` → back-wall cells (x, z) covered by any cube (light moves +y); `side` → side-wall cells (y, z) (light moves +x); `slant` → floor **half-cells** (each unit floor square split by its (1, 1) diagonal into two triangles) covered by the shadows of the cubes, with (x, y, z) → (x + z, y + z, 0). Slanted shadows have diagonal edges; the (1, 1, 0) floor diagonal projects to the vertical lattice direction, so it is still a unit `SegKey`.
  - `shadowOutline(cells: Set<string>, light: Light): Set<SegKey>` — boundary segments between shadow and no-shadow cells, in the iso lattice frame (`proj` of the plane's 3D points).
  - `shadowPlaneBounds(h: HeightMap, light: Light): Bounds` — the drawable area of the floor or wall.

- [ ] **Step 1: Failing tests** — `oneCubeDown` (outline = 4 segments = the cube's bottom square); `oneCubeFront` (4 segments on the back wall); `slantOnGrid` (every outline point of 200 random level 1–4 shapes is an integer lattice point); `slantOneCube` (one unit cube → hexagon (0,0),(1,0),(2,1),(2,2),(1,2),(0,1) on the floor: 6 unit segments, 2 of them diagonal); `hiddenPartIncluded` (shape 2×1 `[2,1]`, `down`: outline covers both cells although one is under the taller cube).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: shadow geometry`.

---

### Task 3: Shadow screen

**Files:** Create `src/ui/screens/shadowPuzzle.ts`; Test `tests/ui/shadow.test.ts`

**Interfaces:**
- Consumes: Task 2, `createIsoGrid` (with `bounds` = `shadowPlaneBounds`), `checkDrawing` with `{ shape: outline, seams: empty }` (exact), lives.
- Produces: route `#/shadows/<level>/<puzzle id>` (puzzles from views levels 1–4); the shape drawn with the answer renderer at 60% opacity above the editable grid; a light arrow + sun icon; drawings `shadow/<level>/<id>`; solved `S<level>-<id>`. Level list "Shadows" with the light named per level.

- [ ] **Step 1: Failing tests** — `exactOutlineSolves`; `extraSegmentIsMistake`; `gridUnderShapeDrawable` (a drag that starts on a point under the shape adds a line); `shapeIsTranslucent` (opacity 0.6 on the shape layer).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: shadow puzzles`.

---

### Task 4: Solids and plane cuts

**Files:** Create `src/core/solids.ts`, `src/core/sections.ts`; Test `tests/core/sections.test.ts`

**Interfaces:**
- Produces:
  - `type V3 = [number, number, number]`; `type Solid = { id: 'cube'|'cuboid'|'triPrism'|'hexPrism'|'sqPyramid'|'tetra'; vertices: V3[]; faces: number[][] /* CCW from outside */; edges: [number, number][] }`; `makeSolid(id): Solid` (cube edge 1; cuboid 2×1×1; prisms height 1, regular base side 1; square pyramid base 1, height 1; regular tetrahedron edge 1).
  - `markedPoints(s: Solid, level: 1|2|3): V3[]` — corners + edge midpoints (level 1), plus edge thirds (levels 2–3).
  - `planeThrough(a: V3, b: V3, c: V3): { n: V3; d: number } | null` — null if collinear.
  - `cut(s: Solid, plane): V3[] | null` — the convex cut polygon (ordered), null if the plane misses, only touches an edge or vertex, or contains a face.
  - `validCut(s, plane, poly): boolean` — not null, points not all on one face, area ≥ 5% of the largest face area.
  - `trueShape(poly: V3[]): [number, number][]` — the polygon in the plane's own 2D coordinates.
  - `similar(p: [number, number][], q: [number, number][]): boolean` — same up to translation, rotation, uniform scale and mirror (compare normalized side-length and angle sequences over all rotations and both directions, tolerance 2%).

- [ ] **Step 1: Failing tests** — `cubeCornerTriangle` (three corners adjacent to one corner → equilateral triangle); `cubeHexagon` (plane through the 6 edge midpoints → regular hexagon, `similar` to a regular hexagon); `faceRejected` (plane of a face → `cut === null`); `collinearRejected`; `sliverRejected` (plane near a corner with area < 5% → `validCut === false`); `similarMirror` (a scalene triangle and its mirror image → `similar === true`); `notSimilar` (square vs 1×2 rectangle → false).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: solids and plane cuts`.

---

### Task 5: Section puzzle generator

**Files:** Create `src/core/sectionPuzzle.ts`; Test `tests/core/sectionPuzzle.test.ts`

**Interfaces:**
- Consumes: Task 4, `rng`.
- Produces: `type SectionPuzzle = { level: 1|2|3; seed: number; solid: Solid; points: [V3, V3, V3]; options: [number, number][][]; correct: number; optionAngles: number[] }`; `makeSectionPuzzle(level: 1|2|3, seed: number): SectionPuzzle` — solids per level as in the spec; picks 3 marked points with a valid cut; picks 3 distractors from other valid cuts of the same solid, pairwise not `similar` and not `similar` to the answer; from level 2, at least one distractor with the same corner count when one exists; options normalized (centred, longest side = 1) and given a random display angle. Deterministic per seed.

- [ ] **Step 1: Failing tests** — `deterministic`; `allValid` (500 seeds per level: the answer cut is `validCut`); `optionsDistinct` (500 seeds per level: no pair of the 4 options is `similar`); `exactlyOneCorrect` (only `options[correct]` is `similar` to `trueShape(cut(points))`); `sameCornerCountLevel2` (in ≥ 80% of 500 level-2 seeds at least one distractor has the answer's corner count).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: cross-section puzzle generator`.

---

### Task 6: Section animation model

**Files:** Create `src/core/sectionAnim.ts`; Test `tests/core/sectionAnim.test.ts`

**Interfaces:**
- Produces: `class SectionAnimation { constructor(p: SectionPuzzle); at(t: number): { planeOffset: number; cutVisible: boolean; cutPoly3d: V3[] } }` with phases: t ∈ [0, 0.4] the plane slides from outside the solid to the cut position; [0.4, 0.6] the cut fills (`cutVisible` true from 0.4); [0.6, 1] the cut polygon turns about its centre until its normal points at the viewer (the projection direction).

- [ ] **Step 1: Failing tests** — `startsOutside` (t=0: plane does not touch the solid); `cutAtMiddle` (t=0.5: `cutPoly3d` equals `cut(...)` within 1e-9); `facesViewerAtEnd` (t=1: polygon normal parallel to the view direction; shape `similar` to `trueShape`).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: cross-section animation model`.

---

### Task 7: Cross-section screen

**Files:** Create `src/ui/screens/sections.ts`, `src/ui/sectionRender.ts`; Test `tests/ui/sections.test.ts`

**Interfaces:**
- Consumes: Tasks 4–6, lives, storage.
- Produces: route `#/sections/<level>` — the solid in iso (hidden edges dashed), the 3 points as dots, question "Which shape is the cut?", 4 options A–D (true shapes, `--tone-1` fill, `--ink` outline), result, then the animation box with ▶ and a slider (same controls as the nets fold); a right first pick → solved `X<level>-<seed>`; a wrong pick costs a life; the current seed survives a reload.

- [ ] **Step 1: Failing tests** — `rightPickSolves`; `wrongPickCostsLife`; `seedSurvivesReload`; `sliderDrivesAnimation` (slider 0.5 → cut visible).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: cross-section puzzles`.

---

### Task 8: Home, settings, backup v2

**Files:** Modify home, settings, `src/core/backup.ts`, `src/core/unlocks.ts`; Test `tests/core/backup.test.ts`, `tests/ui/home.test.ts`

**Interfaces:**
- Produces: home tiles Views, Reverse, Nets, **Sections**, **Shadows**, Draw, Settings; settings "Lives" switch; `Backup.version: 2` with `lives: Record<string, LivesState>` and `sectionSeeds: Record<number, number[]>`; `parseBackup` accepts version 1 (new fields `{}`) and 2; `solvedCount` counts all solved ids (new prefixes included).

- [ ] **Step 1: Failing tests** — `v1BackupImports` (v1 file → ok, old data kept, new fields empty); `v2RoundTrip`; `newSolvedCount` (`X1-5`, `S2-L3-004` each add 1); `homeShowsNewTiles`; `livesSwitchPersists`.
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: round 2 entries, lives setting, backup v2`.

---

### Task 9: Owner's test (owner, not code)

- [ ] On the Pixel 7: one puzzle of each new kind on each level; lives on (lose 3, restart) and off; Answer with lives on does not add to the accent progress; export a backup.
