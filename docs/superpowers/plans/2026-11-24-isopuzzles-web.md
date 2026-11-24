# Isocube (Isometric Puzzles) Web v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static website on GitHub Pages, for the owner's personal use, with views puzzles (6 levels, Classic set, endless mode), reverse puzzles, nets puzzles, draw mode, a tolerant drawing checker, accent rewards, light/dark themes, offline use and progress backup.

**Architecture:** Pure TypeScript modules in `src/core/` hold all logic (geometry, edges, views, checkers, generator, nets, drawing editor, snapping, unlocks) and have no DOM access, so Vitest tests them fast. `src/ui/` renders SVG and handles input with no framework. A build-time script makes `public/puzzles.json`; a Web Worker runs the same generator for endless mode. GitHub Actions tests, builds and deploys.

**Tech Stack:** TypeScript (strict), Vite, Vitest, Playwright (smoke test), `idb-keyval` (IndexedDB), `vite-plugin-pwa` (offline), GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-24-isopuzzles-web-design.md`
**Design system:** `docs/design/design-system.md` (mockups F, H, I: https://claude.ai/artifact/NwzCoG2h7VD6DQJT1F5STv)
**Reference implementation:** `reference/index.html` — "port" means: read the matching code there and keep its behaviour.

## Global Constraints

- Static site only; no server, no network calls at runtime (fonts self-hosted).
- Hosted at `https://sanya-rt.github.io/isocube/` from a public repo named `isocube`; Vite `base: '/isocube/'`.
- Main target Firefox for Android on a Pixel 7 (412×915 CSS px); also current desktop Chrome and Firefox.
- English only. App name `Isocube` in one place: `src/ui/strings.ts` (personal use only; rename before any public release).
- `src/core/` never imports from `src/ui/` and never touches `window`/`document`.
- All colours, fonts, sizes and radii come from CSS custom properties in `src/ui/styles/tokens.css`, with values exactly as in `docs/design/design-system.md` (light and dark). No colour literals elsewhere.
- Check marks (`--mark-missing`, `--mark-mistake`) never use the accent.
- Conventions from `reference/index.html`: seen from the front-left, front = lower-right face, side view from the left, views 2×2 (KEY, TOP, SIDE, FRONT as the page orders them), dashed 3-direction grid, guide hexagon, FRONT/SIDE arrows, views with plane lines.
- Views levels: 1 = 3×3 h≤2, 2 = 3×4 h≤3, 3 = 4×4 h≤3, 4 = 4×5 h≤4, 5 = 5×5 h≤4, 6 = 5×6 h≤5; 50 puzzles each.
- Accent unlocks: Yellow 0, Mint 10, Lilac 25, Pink 50, Lime 100, Red 150, Sand 200 solved puzzles; "Unlock all accents" setting unlocks all.
- Save on every change; nothing is lost on reload, tab close or phone sleep.

## Review Focus

1. **Storage unavailable or full** (private window, quota) — the app still runs, shows one warning line, and keeps state in memory. Test in Task 10.
2. **Bad or old backup file on import** — rejected with a message; existing data stays untouched. Test in Task 10.
3. **Endless level 6 cancelled or left mid-generation** — the worker stops; reopening never shows a puzzle for another level. Test in Task 14.
4. **Browser gestures fighting the grid on Firefox Android** — pinch zooms the grid, not the page; pull-to-refresh and scroll never fire during a stroke. Test in Task 12.
5. **Sub-path hosting** — assets, `puzzles.json`, the worker and the service worker all load under `/isocube/`. Test in Task 19.

---

## File Structure

```
index.html, vite.config.ts, tsconfig.json, package.json, playwright.config.ts
reference/index.html                     (owner, Task 0)
public/puzzles.json                      (generated, committed)
public/fonts/*.woff2, public/licences/OFL.txt
scripts/generate-puzzles.ts
src/core/geometry.ts       lattice points, unit segments, triangles, projection
src/core/shape.ts          HeightMap, visible faces, EdgeSet
src/core/views.ts          orthographic views and their line sets
src/core/checker.ts        drawing checker + view checker
src/core/generator.ts      sampler, solution counter, ordering, seeded RNG
src/core/classic.ts        conversion of the reference page's 49 puzzles
src/core/nets.ts           nets, unfold, fold check, nets puzzle
src/core/fold.ts           fold animation model
src/core/snap.ts           drag and freehand snapping (iso and square)
src/core/drawing.ts        Drawing, DrawingEditor, fill
src/core/unlocks.ts        accent rules, solved count
src/core/backup.ts         backup schema, export/import validation
src/worker/endless.worker.ts
src/ui/storage.ts, ui/router.ts, ui/strings.ts, ui/styles/tokens.css, ui/styles/app.css
src/ui/grid/IsoGrid.ts, ui/grid/SquareGrid.ts, ui/grid/transform.ts, ui/grid/gestures.ts
src/ui/screens/{home,levels,viewsPuzzle,reversePuzzle,nets,draw,settings,accents}.ts
src/ui/components/{topBar,toolBar,viewsPanel,keyPicture}.ts
tests/core/*.test.ts, tests/ui/*.test.ts (jsdom), e2e/smoke.spec.ts
.github/workflows/deploy.yml
```

---

### Task 0: Reference file (owner, not code)

- [ ] The owner downloads the artifact "Isometric Drawing Puzzles" and saves it as `reference/index.html`; commit `chore: add web page reference`. No "port" task starts before this.

---

### Task 1: Project skeleton and geometry

**Files:** Create the Vite + TS + Vitest skeleton (`npm run dev|build|test|gen`), `src/core/geometry.ts`; Test `tests/core/geometry.test.ts`

**Interfaces:**
- Produces (same lattice as the reference page):
  - `type Pt = { t: number; m: number }` — screen `u = t·√3/2`, `v = m + t/2` (v up). `proj(x, y, z): Pt` = `{ t: x − y, m: y + z }` (equals the page's `proj`).
  - `const ISO_DIRS: readonly Pt[] = [{t:0,m:1}, {t:1,m:0}, {t:1,m:-1}]` (vertical, up-right, down-right).
  - `type SegKey = string` — `segKey(p: Pt, q: Pt): SegKey` undirected, same format as the page's `edgeKey` (`"t:m|t:m"`, smaller first); throws if `q − p` is not ± one `ISO_DIRS` entry. `segEnds(k: SegKey): [Pt, Pt]`.
  - `type Line = { a: Pt; b: Pt }`; `unitSegments(l: Line): SegKey[]` (empty if not along one direction or zero length).
  - `type TriKey = string` — the page's `triKey(k, a, b)`; `triAt(u: number, v: number): TriKey`, `triEdges(t: TriKey): SegKey[]` (3), `segTriangles(s: SegKey): [TriKey, TriKey]`, `triNeighbours(t: TriKey): TriKey[]`.
  - Square grid for views: `type GPt = { x: number; y: number }`, `gridSegKey(p: GPt, q: GPt): string` (unit, horizontal/vertical, undirected).

- [ ] **Step 1: Failing tests**

```ts
test('proj matches the page', () => { expect(proj(1,0,0)).toEqual({t:1,m:0}); expect(proj(0,1,0)).toEqual({t:-1,m:1}); expect(proj(0,0,1)).toEqual({t:0,m:1}) })
test('segKey is undirected', () => { const p={t:0,m:0}, q={t:1,m:0}; expect(segKey(p,q)).toBe(segKey(q,p)) })
test('segKey rejects non-unit', () => { expect(() => segKey({t:0,m:0},{t:2,m:0})).toThrow() })
test('unitSegments splits', () => { expect(unitSegments({a:{t:0,m:0},b:{t:0,m:3}})).toHaveLength(3) })
test('two triangles per segment', () => { const [a,b] = segTriangles(segKey({t:0,m:0},{t:1,m:0})); expect(a).not.toBe(b)
  expect(triEdges(a)).toContain(segKey({t:0,m:0},{t:1,m:0})); expect(triEdges(b)).toContain(segKey({t:0,m:0},{t:1,m:0})) })
```

- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implement (port `lp`, `triAt`, `triVerts`, `triKey`, `edgeKey`, `unitEdges` from the reference). **Step 4:** `npm test` → PASS; `npm run build` succeeds.
- [ ] **Step 5:** Commit `feat: project skeleton and lattice geometry`.

---

### Task 2: Height map, visible faces, shape edges

**Files:** Create `src/core/shape.ts`; Test `tests/core/shape.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `class HeightMap { constructor(readonly cols: number, readonly rows: number, readonly h: number[]); at(c: number, r: number): number /* 0 outside */; get cubeCount(): number; cubes(): [number, number, number][] }` — cell (c, r) maps to cube column x = c, y = rows − 1 − r, as the page's `renderAnswer` (`plan[r][c]`, rows back → front).
  - `type FaceDir = 'top' | 'front' | 'side'` (top = +z, front = the y-min face, side = the x-min face, as the page's tones 1/2/3).
  - `type Face = { x: number; y: number; z: number; dir: FaceDir }`; `facePlane(f: Face): string` (dir + plane offset).
  - `visibleFaces(h: HeightMap): Map<TriKey, Face>` — each face covers 2 triangles; per triangle keep the face of the cube nearest the viewer (the page's sort key `−x − y + z` is the far-to-near order).
  - `type EdgeSet = { shape: Set<SegKey>; seams: Set<SegKey> }`; `computeEdges(h: HeightMap): EdgeSet`.

- [ ] **Step 1: Failing tests** — `oneCubeHasNineEdges` (`shape.size === 9`, `seams.size === 0`); `twoFlatCubesHaveTwoSeams` (`new HeightMap(2,1,[1,1])` → `seams.size === 2`); `stepAddsEdges` (`[2,1]` has more shape edges than `[1,1]`); `edgesAndSeamsDisjoint` (seeded random 4×4 maps).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; classify every segment of every covered triangle:

```text
(f1, f2) = faces of the segment's two triangles (undefined = empty)
both empty → none | f1 === f2 → none | one empty → shape
facePlane differs → shape | same plane, different face → seam
```

- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat: visible faces and shape edges`.

---

### Task 3: Orthographic views

**Files:** Create `src/core/views.ts`; Test `tests/core/views.test.ts`

**Interfaces:**
- Consumes: `HeightMap`.
- Produces:
  - `type Labels = number[][]` — the page's label grids (`-1` = empty), same orientation as `PUZZLES[i].top/front/side`.
  - `viewLabels(h: HeightMap): { top: Labels; front: Labels; side: Labels }` — derive exactly the page's stored labels from `plan`.
  - `viewLines(L: Labels): Set<string>` — the page's thick-line rule (a line between two cells whose labels differ, including against outside), as `gridSegKey`s.
  - `type ViewSet = { top: Set<string>; front: Set<string>; side: Set<string> }`; `views(h: HeightMap): ViewSet`; `sameViews(a: ViewSet, b: ViewSet): boolean`.

- [ ] **Step 1: Failing tests** — `labelsMatchReference` (for every entry of the page's `PUZZLES` copied into `tests/fixtures/reference-puzzles.json`: `viewLabels(plan)` deep-equals its `top`, `front`, `side`); `oneCubeViewsAreSquares` (each view has 4 lines).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. (If `labelsMatchReference` disagrees on some entries, the page's stored labels win: adjust `viewLabels` until all 49 match.)
- [ ] **Step 5:** Commit `feat: orthographic views`.

---

### Task 4: Checkers

**Files:** Create `src/core/checker.ts`; Test `tests/core/checker.test.ts`

**Interfaces:**
- Consumes: `EdgeSet`, `ViewSet`.
- Produces:
  - `type CheckResult = { missing: Set<SegKey>; mistakes: Set<SegKey>; correct: boolean }`
  - `checkDrawing(drawn: Set<SegKey>, answer: EdgeSet): CheckResult` — missing = shape − drawn; mistakes = (drawn − shape) − seams.
  - `checkViews(drawn: ViewSet, answer: ViewSet): { top: CheckResult; front: CheckResult; side: CheckResult; correct: boolean }` — exact compare per view (no tolerance).
  - Drawing and answer share the lattice frame of `proj` with the cube origin at (0,0,0).

- [ ] **Step 1: Failing tests** — `ownEdgesCorrect`; `removedEdgeIsOneMissing`; `lineInEmptySpaceIsOneMistake` (segment at t=40); `seamsAreNotMistakes` (shape ∪ seams → correct); `viewsExact` (answer views → correct; one extra line in FRONT → `front.mistakes.size === 1`, `correct === false`).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: drawing and view checkers`.

---

### Task 5: Generator, puzzle file, Classic set

**Files:** Create `src/core/generator.ts`, `src/core/classic.ts`, `scripts/generate-puzzles.ts`; Output `public/puzzles.json`; Test `tests/core/generator.test.ts`, `tests/core/puzzles-file.test.ts`

**Interfaces:**
- Consumes: `HeightMap`, `views`, `sameViews`, `visibleFaces`.
- Produces:
  - `type Rng = () => number`; `rng(seed: number): Rng` (mulberry32).
  - `const LEVELS = [{level:1,a:3,b:3,maxH:2},{level:2,a:3,b:4,maxH:3},{level:3,a:4,b:4,maxH:3},{level:4,a:4,b:5,maxH:4},{level:5,a:5,b:5,maxH:4},{level:6,a:5,b:6,maxH:5}] as const`
  - `sampleShape(cols: number, rows: number, maxH: number, r: Rng): HeightMap` — 4-connected footprint, every row and column non-empty, `maxH` reached.
  - `countSolutions(v: ViewSet, cols: number, rows: number, maxH: number, limit = 2): number` — backtracking over cells with pruning from the view outlines; stops at `limit`.
  - `makePuzzle(level: number, seed: number): { seed: number; hm: HeightMap }` — orientation (a×b or b×a) from the rng; retries with the next sub-seed until `countSolutions === 1`. Deterministic for a seed.
  - `difficulty(hm: HeightMap): [number, number]` = [hidden cubes (no face in `visibleFaces`), cube count].
  - `type PuzzleEntry = { id: string; set: 'level' | 'classic'; level: number; cols: number; rows: number; maxH: number; h: number[] }`; `type PuzzleFile = { version: 1; puzzles: PuzzleEntry[] }`. Ids `L{level}-{nnn}` and `C-{nnn}`.
  - `classicPuzzles(ref: unknown[]): PuzzleEntry[]` — converts the page's 49 `PUZZLES` (`plan`, `Z`, `level`, optional `name`), keeping their order.
  - `npm run gen` writes `public/puzzles.json`: 50 per level (seeds from 2026, sorted by `difficulty`) + the Classic set.

- [ ] **Step 1: Failing tests** — `oneCubeUnique`; `ambiguityExists` (all 3×3 maps h ≤ 2: some have `countSolutions === 2`; every map has ≥ 1); `samplerRules` (200 samples per level); `makePuzzleDeterministic` (same seed → same `h`); `fileValid` (reads `public/puzzles.json`: 50 per level 1–6, 49 classic, unique ids, every entry `countSolutions === 1` for its own views, sizes as `LEVELS`).
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implement; run `npm run gen`. **Step 4:** `npm test` → PASS. Note level 6 generation time in the commit message.
- [ ] **Step 5:** Commit `feat: puzzle generator, puzzles.json and Classic set`.

---

### Task 6: Nets

**Files:** Create `src/core/nets.ts`; Test `tests/core/nets.test.ts`

**Interfaces:**
- Produces: `type Cell = { c: number; r: number }`; `type Net = Cell[]` (normalized, min 0); `type Polycube = [number, number, number][]`; `unfold(shape: Polycube, r: Rng): Net`; `folds(net: Net, shape: Polycube): boolean`; `type NetsPuzzle = { level: 1|2|3; shape: Polycube; options: Net[]; correct: number }`; `makeNetsPuzzle(level: 1|2|3, seed: number): NetsPuzzle` — 4 distinct options, wrong = correct with one square moved and `!folds`. Port shapes per level, unfold and fold check from the reference.

- [ ] **Step 1: Failing tests** — `elevenCubeNets` (35 free hexominoes, exactly 11 fold onto one cube); `generatedNetsFold` (seeds 0–449, all levels); `wrongNetsDoNotFold` (same runs; options distinct).
- [ ] **Step 2–4:** Run → FAIL, port, → PASS. **Step 5:** Commit `feat: nets puzzles`.

---

### Task 7: Fold animation model

**Files:** Create `src/core/fold.ts`; Test `tests/core/fold.test.ts`

**Interfaces:**
- Consumes: `Net`, `Polycube`.
- Produces: `class FoldAnimation { constructor(net: Net, shape: Polycube); pose(cell: number, t: number): [number, number, number][] /* 4 corners */; finalFace(cell: number): { cube: [number,number,number]; normal: [number,number,number] } }`, `t ∈ [0,1]`; each square turns about its fold line by 0° or ±90° scaled by `t`; order and angles ported from the reference; the bottom square stays on the table.

- [ ] **Step 1: Failing tests** — `flatAtStart`; `landsOnFaces` (450 runs: at t=1 every square equals a distinct surface face within 1e-6).
- [ ] **Step 2–4:** Run → FAIL, port, → PASS. **Step 5:** Commit `feat: fold animation model`.

---

### Task 8: Snapping

**Files:** Create `src/core/snap.ts`; Test `tests/core/snap.test.ts`, fixtures `tests/fixtures/strokes/*.json`

**Interfaces:**
- Produces (coordinates in grid units, `u`/`v` as in Task 1):
  - `snapDragIso(start: {u:number;v:number}, end: {u:number;v:number}): Line | null` — start to the nearest lattice point; end along the nearest of the 3 directions (both signs), rounded to whole steps (port `snapEnd`); `null` if zero length.
  - `snapFreehandIso(points: {u:number;v:number}[]): Line[]` — Ramer–Douglas–Peucker (tolerance 0.35), snap each piece, drop pieces < 0.5, join at shared points; if any kept piece is > 15° from every direction → `[]`.
  - `snapDragSquare(start: {x:number;y:number}, end: {x:number;y:number}): { a: GPt; b: GPt } | null` — horizontal or vertical only.

- [ ] **Step 1: Failing tests** — `dragSnaps` (crooked drag of length 2.9 along up-right → 3 steps); `lShapeTwoLines` (fixture); `tapNothing`; `tinyNothing` (0.3); `zigzagNothing` (45° pieces → `[]`); `recordedStrokes` (every fixture's `expected`); `squareDrag` (diagonal drag snaps to the longer axis).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: drag and freehand snapping`.

---

### Task 9: Drawing editor

**Files:** Create `src/core/drawing.ts`; Test `tests/core/drawing.test.ts`

**Interfaces:**
- Consumes: `SegKey`, `TriKey`, `Line`, `unitSegments`, `triNeighbours`, `triEdges`.
- Produces:
  - `type Drawing = { lines: SegKey[]; fills: Record<TriKey, number> }` (JSON-safe; colour index 1–3 = tones, 4+ = palette).
  - `type Bounds = { t0: number; t1: number; v0: number; v1: number }` (the page's `bounds`).
  - `class DrawingEditor { constructor(initial: Drawing, bounds: Bounds, onChange: (d: Drawing) => void); addLines(ls: Line[]): void; erase(s: SegKey): void; fill(start: TriKey, colour: number): void; clear(): void; undo(): void; redo(): void; get canUndo(): boolean; get canRedo(): boolean; get drawing(): Drawing }` — one undo step per call; a no-op adds none; `onChange` after every change.
  - `fill`: flood fill across neighbours not crossing a drawn segment; if the region leaves `bounds`, fill nothing.

- [ ] **Step 1: Failing tests** — `undoRedo`; `fillClosedRhombus` (2 triangles); `fillOpenRegionNothing` (no fill, no undo step); `clearUndoable`; `jsonRoundTrip`; `onChangeCalled`.
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: drawing editor`.

---

### Task 10: Unlocks, storage, backup

**Files:** Create `src/core/unlocks.ts`, `src/core/backup.ts`, `src/ui/storage.ts`; Test `tests/core/unlocks.test.ts`, `tests/core/backup.test.ts`, `tests/ui/storage.test.ts` (fake-indexeddb)

**Interfaces:**
- Produces:
  - `type Accent = 'yellow'|'mint'|'lilac'|'pink'|'lime'|'red'|'sand'`; `ACCENTS: { id: Accent; name: string; threshold: number }[]` (0, 10, 25, 50, 100, 150, 200); `accentUnlocked(a: Accent, solved: number, unlockAll: boolean): boolean`; `nextAccent(solved: number): { id: Accent; left: number } | null`.
  - `type Progress = { solved: string[] /* puzzle ids incl. "E{level}-{seed}" and "R-{id}" */; netsRight: number; endlessSeeds: Record<number, number[]> }`; `solvedCount(p: Progress): number` = `solved.length + netsRight`.
  - `type Settings = { theme: 'system'|'light'|'dark'; accent: Accent; unlockAll: boolean }` (defaults `system`, `yellow`, `false`).
  - `type Backup = { app: 'isocube'; version: 1; exportedAt: string; progress: Progress; settings: Settings; drawings: Record<string, Drawing> }`; `parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: string }` — validates every field; unknown `version` → error.
  - `storage.ts`: `loadDrawing(key)`, `saveDrawing(key, d)` (debounced 300 ms + `flush()` on `visibilitychange`→hidden and `pagehide`), `listDrawings(prefix)`, `deleteDrawing(key)`, `loadProgress()`, `saveProgress(p)`, `loadSettings()`, `saveSettings(s)`, `exportBackup(): Promise<string>`, `importBackup(text): Promise<{ ok: boolean; error?: string }>`, `storageAvailable(): Promise<boolean>`. Keys: `views/<id>`, `reverse/<id>`, `draw/<uuid>`, `endless/<level>/<seed>`. If IndexedDB fails, every call falls back to an in-memory map and `storageAvailable()` is `false`.

- [ ] **Step 1: Failing tests** — `accentRules` (mint at 10, not lilac at 24, all with `unlockAll`); `nextAccent`; `backupRoundTrip` (export → import equal); `badBackupRejected` (invalid JSON, wrong `app`, `version: 2`, missing field → `ok:false`, and stored data unchanged); `storageFallback` (IndexedDB throws → save/load still work in memory, `storageAvailable() === false`); `flushOnHide` (dispatch `visibilitychange` hidden → write happens before the debounce).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: unlocks, storage and backup`.

---

### Task 11: Theme and tokens

**Files:** Create `src/ui/styles/tokens.css`, `src/ui/styles/app.css`, `public/fonts/` (IBM Plex Mono 400/600, Space Grotesk 500, woff2), `public/licences/OFL.txt`, `src/ui/theme.ts`; Test `tests/ui/theme.test.ts`

**Interfaces:**
- Produces: CSS custom properties for every token in the design system (`--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--grid-line`, `--guide`, `--tone-1..3`, `--view-cell`, `--mark-missing`, `--mark-mistake`, `--accent`, `--on-accent`, radii, spacing, fonts) under `:root[data-theme="light"]` and `[data-theme="dark"]`; `applyTheme(s: Settings): void` sets `data-theme` (system → `prefers-color-scheme`, live) and `--accent`/`--on-accent`; `onAccent(hex: string): '#16161A' | '#FFFFFF'` by higher contrast.

- [ ] **Step 1: Failing tests** — `tokensMatchDesignSystem` (parse `tokens.css`: light `--bg #F5F2EA`, dark `--bg #121214`, `--mark-mistake` light `#E4572E`); `onAccentContrast` (every accent ≥ 4.5:1); `marksNotAccents`; `systemThemeFollows` (mock `matchMedia` change → `data-theme` changes).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: theme tokens and fonts`.

---

### Task 12: Grid components, zoom and pan

**Files:** Create `src/ui/grid/transform.ts`, `gestures.ts`, `IsoGrid.ts`, `SquareGrid.ts`; Test `tests/ui/grid.test.ts` (jsdom, synthetic pointer events)

**Interfaces:**
- Consumes: Tasks 1, 4, 8, 9, 11.
- Produces:
  - `type View = { scale: number; panU: number; panV: number }`; `fitView(content: Bounds, width: number, height: number): View` (largest step that fits + 1 step margin, min 40 px when possible); zoom range 0.5×–4× of the fit scale; `zoomAt(view, factor, px, py): View`.
  - `type Tool = 'line' | 'freehand' | 'fill' | 'erase'`
  - `createIsoGrid(el: HTMLElement, opts: { bounds: Bounds; guide?: { cols: number; rows: number; maxH: number }; arrows: boolean; editor: DrawingEditor; tool: () => Tool; colour: () => number; penOnly: () => boolean }): { setOverlay(o: { kind: 'answer'; edges: Set<SegKey> } | { kind: 'check'; result: CheckResult } | null): void; fit(): void; zoomBy(f: number): void; destroy(): void }`
  - `createSquareGrid(el, opts: { cols: number; rows: number; lines: Set<string>; onChange(lines: Set<string>): void; penOnly: () => boolean }): { setResult(r: CheckResult | null): void; fit(): void; zoomBy(f: number): void; destroy(): void }` — same zoom, pan and pen-only input as the iso grid.
  - Drawing: SVG; dashed 3-direction grid that extends past the edges; guide hexagon; FRONT/SIDE arrows; fills; lines; overlays styled per the design system.
  - Input: Pointer Events; 1 pointer → tool; 2 pointers → pinch zoom + pan, and a stroke in progress is cancelled; `penOnly` → only `pointerType === 'pen'` draws; wheel → `zoomAt` around the pointer; middle/right drag or Space + drag → pan; erase = nearest segment within 0.4 step. The grid element has `touch-action: none` and `overscroll-behavior: none`; `preventDefault` on handled touch/pointer events.

- [ ] **Step 1: Failing tests** — `dragAddsLine`; `secondPointerCancelsStroke`; `penOnlyIgnoresTouch`; `pinchZooms`; `wheelZoomsAroundPointer` (point under the pointer stays put); `fitRestores`; `gestureStylesSet` (`touch-action: none` and `overscroll-behavior: none` on the grid element); `fitStepAtLeast40` (3×3 guide in 412×500 → step ≥ 40).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: iso and square grids with zoom and pan`.

---

### Task 13: Views puzzles (levels, Classic, puzzle screen)

**Files:** Create `src/ui/router.ts`, `src/ui/screens/levels.ts`, `src/ui/screens/viewsPuzzle.ts`, `src/ui/components/{topBar,toolBar,viewsPanel,keyPicture}.ts`; Test `tests/ui/viewsPuzzle.test.ts`

**Interfaces:**
- Consumes: `PuzzleFile`, `views`, `computeEdges`, `checkDrawing`, `createIsoGrid`, storage.
- Produces:
  - Hash routes: `#/`, `#/levels/views`, `#/views/<id>`, `#/endless/<level>/<seed>`, `#/levels/reverse`, `#/reverse/<id>`, `#/nets/<level>`, `#/draw`, `#/draw/<key>`, `#/settings`, `#/settings/accent`. `navigate(route: string): void`.
  - Level list: levels 1–6 and Classic with "solved / total"; an "Endless" button per level.
  - Puzzle screen (mockups F/H): top bar ("LEVEL n", "PUZZLE nn / 50 · a×b"), views panel (port `viewSVG`, `keySVG`), hideable; grid; counts line + tone swatches; tool bar; ANSWER + CHECK; NEXT after correct; zoom in / zoom out / FIT buttons over the grid. Each puzzle's `View` is kept in `sessionStorage` for the session; FIT resets it. CHECK → overlay `check`, correct → mark solved. Layout: height ≥ width → panel above, else beside.

- [ ] **Step 1: Failing tests** — `correctDrawingSolves` (editor gets `shape` edges → CHECK → correct, id in progress); `drawingRestoredAfterReload` (new screen instance with same storage → same drawing); `panelBesideWhenWide`; `classicListed` (49 entries).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: views puzzles`.

---

### Task 14: Endless mode

**Files:** Create `src/worker/endless.worker.ts`, `src/ui/endless.ts`; Test `tests/ui/endless.test.ts` (worker mocked by a direct call adapter)

**Interfaces:**
- Consumes: `makePuzzle`, storage `endlessSeeds`.
- Produces: `class EndlessQueue { constructor(level: number, makeWorker: () => Worker); next(): Promise<{ seed: number; hm: HeightMap }>; cancel(): void; dispose(): void }` — keeps 2 ready; each request carries `level` and a request id; results for another level or a cancelled id are dropped; `cancel()` terminates the worker and starts a fresh one. Endless puzzles open at `#/endless/<level>/<seed>` and are solved as `E<level>-<seed>`. "Generating…" with Cancel while waiting.

- [ ] **Step 1: Failing tests** — `keepsTwoReady`; `cancelStopsWorker`; `noCrossLevelResult` (level 6 request cancelled, level 2 queue opened → only level 2 puzzles returned); `seedReopens` (same seed → same puzzle).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: endless mode`.

---

### Task 15: Reverse puzzles

**Files:** Create `src/ui/screens/reversePuzzle.ts`; Test `tests/ui/reverse.test.ts`

**Interfaces:**
- Consumes: `PuzzleEntry`, `views`, `checkViews`, `createSquareGrid`, answer rendering from Task 13 (shaded iso drawing + key picture).
- Produces: screen at `#/reverse/<id>` (ids from level sets, Classic, and `endless`): the shaded shape on top, three square grids (TOP, FRONT, SIDE) sized to the base and height, CHECK marks per view, solved as `R-<id>`; drawn lines saved as `reverse/<id>`.

- [ ] **Step 1: Failing tests** — `exactViewsSolve`; `extraLineFails` (per-view mistake count); `restoredAfterReload`.
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: reverse puzzles`.

---

### Task 16: Nets screen

**Files:** Create `src/ui/screens/nets.ts`; Test `tests/ui/nets.test.ts`

**Interfaces:**
- Consumes: `makeNetsPuzzle`, `FoldAnimation`, storage.
- Produces: screen `#/nets/<level>` (port layout: shape, 4 options labelled A–D, result message, fold box with ▶ Fold and slider, hint text), restyled with tokens; a right first choice adds 1 to `netsRight`; the current seed survives a reload.

- [ ] **Step 1: Failing tests** — `rightFirstChoiceCounts`; `wrongShowsCorrect`; `seedSurvivesReload`; `sliderSetsPose` (slider 0.5 → poses at t=0.5).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: nets screen`.

---

### Task 17: Draw mode and export

**Files:** Create `src/ui/screens/draw.ts`, `src/ui/exportImage.ts`; Test `tests/ui/draw.test.ts`

**Interfaces:**
- Produces: list (new, open, rename, delete with confirm) and drawing screen (all tools, 3 tones + palette of 12 colours, no lock); `exportSvg(d: Drawing, view: View): string` (standalone SVG with token colours inlined), `exportPng(svg: string, scale: 2): Promise<Blob>`; download via a temporary `<a download>`.

- [ ] **Step 1: Failing tests** — `newDrawingListed`; `renameDelete`; `svgContainsLines` (exported SVG has one `<line>` per segment); `svgStandalone` (no `var(` in the output).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: draw mode and image export`.

---

### Task 18: Home, settings, accents, offline

**Files:** Create `src/ui/screens/{home,settings,accents}.ts`, PWA config in `vite.config.ts` (`vite-plugin-pwa`, `registerType: 'autoUpdate'`, precache app shell, `puzzles.json`, fonts), `public/icons/*`, `public/manifest.webmanifest` via the plugin; Test `tests/ui/settings.test.ts`

**Interfaces:**
- Consumes: storage, `ACCENTS`, `accentUnlocked`, `nextAccent`, `applyTheme`.
- Produces: home (Views, Reverse, Nets, Draw, Settings); settings (theme System/Light/Dark, Accent → `#/settings/accent`, "Unlock all accents" switch, Export progress → file `isocube-backup-YYYY-MM-DD.json`, Import progress → file picker + result message, storage warning line if `storageAvailable()` is false, About with version); accent screen per mockup I (locked rows not selectable, progress to the next accent).

- [ ] **Step 1: Failing tests** — `lockedAccentNotSelectable`; `unlockAllUnlocks`; `accentChangesCheckColour` (`--accent` updates); `importBadFileShowsError`; `storageWarningShown`.
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS. **Step 5:** Commit `feat: home, settings, accents and offline`.

---

### Task 19: CI, smoke test and deploy

**Files:** Create `.github/workflows/deploy.yml`, `playwright.config.ts`, `e2e/smoke.spec.ts`, `README.md`

- [ ] **Step 1: Write `e2e/smoke.spec.ts`** (Pixel 7 device profile, runs against `vite preview` with `base: '/isocube/'`): open `/isocube/#/views/L1-001`, drag one line on the grid, reload, the line is still there; `/isocube/puzzles.json` returns 200; the service worker registers with scope `/isocube/`; offline (context `setOffline(true)`) reload still shows the home screen.
- [ ] **Step 2:** Run `npx playwright test` → FAIL before config, then configure → PASS.
- [ ] **Step 3: Workflow** on push to `main`: `npm ci` → `npm test` → `npm run build` → Playwright smoke → upload `dist` → `actions/deploy-pages`. Any failure stops the deploy. `README.md`: how to run, test, regenerate puzzles, and enable Pages (Settings → Pages → Source: GitHub Actions).
- [ ] **Step 4:** Push; the workflow is green; the site opens at `https://sanya-rt.github.io/isocube/`.
- [ ] **Step 5:** Commit `ci: test, build and deploy to GitHub Pages`.

---

### Task 20: Owner's test (owner, not code)

- [ ] On the Pixel 7 (Firefox): draw one puzzle on each level 1–6; endless on level 6 (time to first puzzle); one reverse puzzle; nets with the fold; draw mode export; add to home screen, airplane mode, open again.
- [ ] Dark mode; compare with mockups F, H, I; list what to change.
- [ ] Export a backup and keep the file.
