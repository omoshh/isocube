# Round 4 Phase 1b (fill, line dots, cylinder drag) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In Draw and Views, fill stops at every drawn line and arc; drawn lines get midpoint snap dots; dragging a circle's centre makes a cylinder.

**Architecture:** A new core module `areas.ts` finds the face of the drawn segments that holds a point (planar arrangement, face walk). `DrawingEditor` stores such faces as polygons in `Drawing.areas`. `IsoGrid` uses areas only when `free` is set, so Shadows keeps triangle fill. Midpoints and cylinder extrusion are small core helpers used by `IsoGrid`.

**Tech Stack:** TypeScript, Vitest (+ jsdom), Playwright. No new dependencies.

**Spec:** `docs/2026-11-27-round4-phase1b-design.md` (and `docs/2026-11-27-round4-design.md`).

## Global Constraints

- Tests first for `src/core`; one commit per task; no new dependencies.
- Shadows, Reverse, Nets: no change (Shadows keeps triangle fill: it has no `free`).
- Old drawings (triangle `fills`, no `areas`) load, render, fill-over and erase as before.
- Snap points shown = snap points used. Midpoint dots only on drawn lines.
- Backups with or without `areas` import; backup version stays 3.
- Version 4.1 at the end (`package.json`, `package-lock.json` root entries, settings test).
- Merge and push to `main` (no PR) after the final review; push deploys.

## Review Focus

1. A fill inside a ramp face drawn with free lines fills only that face (Task 2 test: triangle-crossing free line splits a rhombus).
2. A fill inside a closed half-ellipse (arc + diameter line) fills the half-ellipse (Task 1 test).
3. A fill in an open area fills nothing and adds no undo step (Task 2 test).
4. Filling the same area twice with another colour recolours it (one area left) (Task 2 test).
5. Cylinder drag tapped without moving acts as a normal arc tap (Task 5 test).

---

### Task 1: `areaAt` — the face that holds a point

**Files:** Create `src/core/areas.ts`; Test `tests/core/areas.test.ts`

**Interfaces — Produces:**
- `type P2 = [number, number]`
- `areaAt(segs: [P2, P2][], q: P2): P2[] | null` — the counter-clockwise boundary of the smallest closed face of the segments that holds `q`; `null` when `q` is in no closed face.
- `polyArea(pts: P2[]): number` (signed, CCW > 0), `inPoly(pts: P2[], q: P2): boolean`.

Algorithm (not determined by the signature):
1. Split every segment at every intersection with another segment (O(n²)); merge vertices by rounding to 1e-6.
2. Undirected edge set between merged vertices; for each vertex, outgoing edges sorted by angle.
3. Cast a ray from `q` in direction (1, 1e-4) (avoids vertices); collect hit edges sorted by distance.
4. For each hit edge in order: orient it so `q` is on its left; walk the face: from half-edge (p→v), the next is the first outgoing edge of `v` clockwise from (v→p) (take (v→p) only at a dead end). Stop when back at the start half-edge (max 4·edges steps).
5. Return the first walked polygon with `polyArea > 0` and `inPoly(q)`; else `null`.

- [ ] **Step 1: Write the failing tests:** unit square → square (area 1); square with a diagonal, `q` below the diagonal → triangle (area 0.5); open "U" → null; square with an inner square island, `q` between them → outer square; `q` inside the island → inner square; half-disc (polyline arc of 12 points + diameter) → area close to π/2 · r² within 2 %.
- [ ] **Step 2: Run** `npx vitest run tests/core/areas.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same — Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): find the closed area around a point (areaAt)`

### Task 2: Area fills in the editor and backups

**Files:** Modify `src/core/drawing.ts`, `src/core/backup.ts`; Tests `tests/core/drawing.test.ts`, `tests/core/backup.test.ts`

**Interfaces — Produces:**
- `type Area = { pts: [number, number][]; c: number }`; `Drawing.areas?: Area[]`; `editor.drawing` always has `areas` (`[]` when none); `clear`/`reset` empty it.
- `fillArea(q: UV, colour: number): void` — segments = lines (`segEnds`→`toUV`) + arc pieces (`arcPolyline` consecutive points); `areaAt`; null → no commit. Points rounded to 4 decimals. Removes areas holding `q` with the same `|polyArea|` (±1e-6) and triangle fills whose centre is inside the new polygon; colour 0 is not used here.
- `unfillArea(q: UV): boolean` — removes the last area holding `q` (one commit) and returns true; false if none.
- `parseBackup` accepts `areas` missing, or an array of `{ pts: number[][] (pairs), c: number }`; else `The drawing "<k>" is invalid.`

- [ ] **Step 1: Failing tests:** rhombus split by a free line through it: fill on each side gives two different areas (each area 0.5 of the rhombus area); open region → no area, `canUndo` false; second fill of the same face with colour 5 → one area with `c: 5`; triangle fills under a new area are removed; `unfillArea` removes the topmost and undo restores it; old drawing without `areas` → `areas: []`; backup with/without `areas` imports, `areas: [{ pts: 'x', c: 1 }]` fails.
- [ ] **Step 2: Run** `npx vitest run tests/core` — Expected: FAIL on the new tests.
- [ ] **Step 3: Implement.** Fix existing expectations that compare whole drawings (add `areas: []`).
- [ ] **Step 4: Run** `npx vitest run` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): area fills that stop at free lines and arcs`

### Task 3: Draw and export areas; grid uses them

**Files:** Modify `src/ui/grid/IsoGrid.ts`, `src/ui/exportImage.ts`; Tests `tests/ui/grid.test.ts`, `tests/ui/draw.test.ts`

- `render()` draws areas after triangle fills in `g-fills` (same style as triangles, `fillColour(c)`).
- With `free`: fill tool → `editor.fillArea(p, colour)`; eraser tap with no line near → `editor.unfillArea(p) || editor.unfill(triAt(...))`. Without `free`: as now.
- `exportSvg` draws areas as polygons after triangles; their points count for bounds.

- [ ] **Step 1: Failing tests:** grid with `free`: lines of a triangle cut by a free line, fill tap → one `.g-fills polygon`, `editor.drawing.areas` length 1; eraser tap inside → areas empty; Shadows-style grid (no `free`) fill still writes `fills`; `exportSvg` with one area contains its colour polygon.
- [ ] **Step 2–4:** run `npx vitest run tests/ui/grid.test.ts tests/ui/draw.test.ts` FAIL → implement → `npx vitest run` PASS.
- [ ] **Step 5: Commit** `feat(ui): fill stops at free lines and arcs in Draw and Views`

### Task 4: Snap dots in the middle of drawn lines

**Files:** Modify `src/core/snap.ts` (or `geometry.ts`), `src/ui/grid/IsoGrid.ts`; Tests `tests/core/snap.test.ts`, `tests/ui/grid.test.ts`

- `lineMidpoints(lines: SegKey[]): Pt[]` — exact midpoint of each stored piece (halves of `t`, `m`, `rt`, `rm`), unique.
- `IsoGrid` snap `extra` = arc snap points + `lineMidpoints(drawing.lines)`; `drawSnap` shows them while Line or Arc is active (not limited by `MIN_DOT_SCALE`: they are few).

- [ ] **Step 1: Failing tests:** `lineMidpoints(['0:0|0:1', '0:0|1:1'])` → `0:0.5` and `0.5:0.5`; grid: after drawing `0:0→0:1` with `half: false`, a line drag ending near `0:0.5` ends there; `.g-snap circle` count = 1 with Line active.
- [ ] **Step 2–4:** FAIL → implement → `npx vitest run` PASS.
- [ ] **Step 5: Commit** `feat: drawn lines get a snap dot in their middle`

### Task 5: Cylinder drag from a circle's centre

**Files:** Modify `src/core/arcs.ts`, `src/core/drawing.ts`, `src/ui/grid/IsoGrid.ts`, `src/ui/grid/grid.css`; Tests `tests/core/arcs.test.ts`, `tests/core/drawing.test.ts`, `tests/ui/grid.test.ts`

**Interfaces — Produces:**
- `type Circle = { plane: Plane; c: Pt; r: 0.5 | 1 }`; `circlesOf(keys: ArcKey[]): Circle[]` (unique).
- `NORMAL: Record<Plane, Pt>` = z → `{t:0,m:1}`, y → `{t:-1,m:1}`, x → `{t:1,m:0}`.
- `extrude(keys: ArcKey[], circle: Circle, n: number): { arcs: ArcKey[]; lines: Line[] }` — the circle's drawn pieces moved by `n·NORMAL`; side lines from the 2 silhouette eighths (the eighths whose screen offset from the centre is most and least to the side of the normal's screen direction), each only if that eighth point is an end of a drawn piece of the circle.
- `DrawingEditor.add(lines: Line[], arcs: ArcKey[]): void` — one commit (no commit when nothing new).
- IsoGrid (Arc tool): centre dots (`.g-handle circle.centre`) for `circlesOf(drawing.arcs)`. A stroke starting within `HANDLE_DIST` of a centre (and not of the last-arc dot) drags: `n` = finger offset projected on the normal's screen direction, rounded to whole cells; preview the result in `g-prev`; on release with `n ≠ 0` → `editor.add(...)`. Release without moving (< 0.1) → normal arc tap.

- [ ] **Step 1: Failing tests:** top circle r 1 at 0:0, all 8 pieces, `n = 2` → 8 arcs at centre `0:2` and 2 vertical lines at eighths 3 and 7 (`0~-1:0~0.5|0~-1:2~0.5`-style keys via `linePieces`); only pieces 0–3 drawn → side line only at eighth 3? (eighth 3 is an end of piece 2/3: yes; eighth 7 is not: no line); grid: arc tool drag from the centre dot up 2 cells adds 8 pieces + 2 lines in one undo step; tap on the centre without moving starts an arc (first-point marker shows).
- [ ] **Step 2–4:** FAIL → implement → `npx vitest run` PASS.
- [ ] **Step 5: Commit** `feat: drag a circle's centre to make a cylinder`

### Task 6: Version 4.1, checks, review, deploy

- [ ] Version 4.1 (`package.json`, `package-lock.json` lines 3 and 9, `tests/ui/settings.test.ts`).
- [ ] `npm run build && npm run e2e` — Expected: OK.
- [ ] Browser check (Playwright, Pixel 7): ramp shape with free lines → fill each face; half cylinder → fill; drag a centre → cylinder; screenshot.
- [ ] Final whole-branch review; fix Critical/Important with tests; merge `--ff-only` to `main`, push, watch deploy.
- [ ] Report to the owner: what works and how to try it.
