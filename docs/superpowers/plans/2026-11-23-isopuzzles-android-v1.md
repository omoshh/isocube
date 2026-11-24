# Isometric Puzzles Android v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A native Android app (Kotlin + Jetpack Compose) with views puzzles, nets puzzles and a free draw mode, a drawing checker, and a one-time Google Play purchase, ready for the Google Play closed test.

**Architecture:** Three Gradle modules. `:core` is pure Kotlin/JVM and holds all geometry, puzzle logic, checker, nets, drawing editor and access rules, so it is fast to unit-test. `:generator` is a JVM command-line tool that uses `:core` to make the views puzzles and writes `puzzles.json` into the app assets. `:app` is the Android app: storage, billing and Compose UI on top of `:core`.

**Tech Stack:** Kotlin, Gradle (Kotlin DSL, version catalog), Jetpack Compose (Material 3), Navigation Compose, kotlinx.serialization, kotlinx.coroutines, Jetpack DataStore, AndroidX AtomicFile, Google Play Billing Library (latest stable), JUnit 5 in `:core`/`:generator`, JUnit 4 + Robolectric + Compose UI test in `:app`.

**Spec:** `docs/superpowers/specs/2026-11-23-isopuzzles-android-v1-design.md` (live copy: https://claude.ai/artifact/UcS8dz4upqxat886ujD4G2)

**Design system:** `docs/design/design-system.md` (mockups: https://claude.ai/artifact/NwzCoG2h7VD6DQJT1F5STv)

**Reference implementation:** `reference/index.html` — the owner's working web page. Where this plan says "port", read the matching code there and keep its behaviour.

## Global Constraints

- Package / applicationId: `com.sanyart.isopuzzles`.
- App name is a placeholder in one place only: `app/src/main/res/values/strings.xml` → `app_name` = `Isometric Puzzles`.
- `compileSdk = 36`, `targetSdk = 36`, `minSdk = 26`.
- Manifest: `android:appCategory="game"`; no `android:screenOrientation` on any activity.
- English only.
- Fully offline: no INTERNET use except by Play Billing; no analytics, no ads, no account, no data collection.
- One in-app product, type INAPP (one-time), product id `full_version`. Never show a hard-coded price.
- Free part: views level 1 → first 15 puzzles; views levels 2–6 → first 3 puzzles each; nets level 1; draw mode with the 3 shading tones. Everything else needs `full_version`.
- Views levels: 1 = 3×3 h≤2, 2 = 3×4 h≤3, 3 = 4×4 h≤3, 4 = 4×5 h≤4, 5 = 5×5 h≤4, 6 = 5×6 h≤5; 50 puzzles each.
- Book conventions from `reference/index.html`: seen from the front-left, front = lower-right face, side view from the left, views in a 2×2 layout, key picture with FRONT and SIDE arrows.
- Nothing the user drew is lost on rotation, theme change, background, or process death.
- Every colour, font, size and radius comes from `docs/design/design-system.md` through one file, `app/…/ui/theme/Tokens.kt`. No colour or size literals in screens.
- Check marks (`markMissing`, `markMistake`) never use the accent colour.

## Review Focus

1. **Process death with a half-done drawing** — Android kills the app in the background; on return the drawing is exactly as it was. Test in Task 11.
2. **Two-finger zoom that starts as a one-finger stroke** — when a second pointer goes down, the stroke in progress is cancelled and no line is added. Test in Task 13.
3. **Tap or scribble instead of a stroke** — a tap, a tiny stroke or a zig-zag adds no line and does not crash. Test in Task 9.
4. **Fill in a region that is not closed** — the paint bucket fills nothing (never the whole grid). Test in Task 10.
5. **Purchase PENDING, refunded, or first start offline** — content unlocks only for a PURCHASED, acknowledged purchase; a purchase that disappears on an online refresh locks content again; offline uses the cached value. Test in Task 12.

---

## File Structure

```
settings.gradle.kts, build.gradle.kts, gradle/libs.versions.toml
reference/index.html                      (owner supplies, see Task 0)
core/src/main/kotlin/com/sanyart/isopuzzles/core/
  geometry/IsoPoint.kt        lattice point, 3D→iso projection
  geometry/UnitSegment.kt     normalized unit segment, Line → unit segments
  geometry/IsoTriangle.kt     unit triangles of the lattice and their edges
  shape/HeightMap.kt          puzzle shape
  shape/VisibleFaces.kt       which face is in front in each triangle
  shape/EdgeSet.kt            shape edges and flat seams
  views/OrthoViews.kt         top / front / side line sets
  checker/DrawingChecker.kt   compare drawing with answer
  access/AccessRules.kt       free / paid rules
  drawing/Drawing.kt          lines + fills, editor with undo/redo
  drawing/StrokeSnapper.kt    drag and freehand → snapped lines
  nets/Polycube.kt, nets/Net.kt, nets/Unfolder.kt, nets/FoldChecker.kt,
  nets/NetsPuzzle.kt, nets/FoldAnimation.kt
  puzzles/PuzzleFile.kt       JSON schema shared by generator and app
generator/src/main/kotlin/com/sanyart/isopuzzles/generator/
  Solver.kt, ShapeSampler.kt, Main.kt
app/src/main/kotlin/com/sanyart/isopuzzles/
  data/PuzzleCatalog.kt, data/DrawingStore.kt, data/ProgressStore.kt, data/SettingsStore.kt
  billing/BillingGateway.kt, billing/PlayBillingGateway.kt, billing/Entitlements.kt
  ui/grid/IsoGridCanvas.kt, ui/grid/GridGestures.kt, ui/grid/GridTransform.kt
  ui/theme/Tokens.kt, ui/theme/Theme.kt, ui/theme/Fonts.kt
  ui/views/…, ui/nets/…, ui/draw/…, ui/home/…, ui/settings/…, ui/purchase/…
  MainActivity.kt, App.kt (navigation)
docs/design/design-system.md (exists), docs/privacy-policy.md, docs/store-listing.md
```

---

### Task 0: Owner prerequisite — reference file (owner, not code)

- [ ] **Step 1:** The owner opens the artifact "Isometric Drawing Puzzles", downloads it, and saves it as `reference/index.html` in the repo.
- [ ] **Step 2:** Commit: `git add reference/index.html && git commit -m "chore: add web page reference"`

No task that says "port" starts before this file exists.

---

### Task 1: Project skeleton and iso geometry

**Files:**
- Create: Gradle files, `core/…/geometry/IsoPoint.kt`, `UnitSegment.kt`, `IsoTriangle.kt`
- Create: minimal `:app` (empty Compose activity showing `app_name`) and empty `:generator` with `main`
- Test: `core/src/test/kotlin/…/geometry/GeometryTest.kt`

**Interfaces:**
- Produces:
  - `data class IsoPoint(val i: Int, val j: Int)` — invariant `(i - j) % 2 == 0`. `companion fun fromLattice(x: Int, y: Int, z: Int): IsoPoint` = `IsoPoint(x - y, x + y - 2 * z)`. Screen position: `sx = i * sqrt(3)/2 * step`, `sy = j * 0.5 * step` (screen y down). So +x runs to the lower right, +y to the lower left, +z up.
  - `enum class IsoDir(val di: Int, val dj: Int) { X(1, 1), Y(-1, 1), Z(0, -2) }`
  - `class UnitSegment private constructor(val a: IsoPoint, val b: IsoPoint)` with `equals/hashCode` on (a, b); `companion fun of(p: IsoPoint, q: IsoPoint): UnitSegment` puts the smaller point (by `i`, then `j`) first and throws `IllegalArgumentException` if `q - p` is not ±one `IsoDir`.
  - `data class Line(val from: IsoPoint, val to: IsoPoint)`; `fun Line.unitSegments(): List<UnitSegment>` (throws if not along one `IsoDir`; empty if `from == to`).
  - `IsoTriangle` — a unit triangle of the lattice (internal representation is free). `fun IsoTriangle.edges(): List<UnitSegment>` (3), `fun UnitSegment.triangles(): Pair<IsoTriangle, IsoTriangle>` (the two triangles that share it), `fun IsoTriangle.neighbours(): List<IsoTriangle>` (3).

- [ ] **Step 1: Write failing tests**

```kotlin
@Test fun projection() { assertEquals(IsoPoint(1, 1), IsoPoint.fromLattice(1, 0, 0))
  assertEquals(IsoPoint(-1, 1), IsoPoint.fromLattice(0, 1, 0)); assertEquals(IsoPoint(0, -2), IsoPoint.fromLattice(0, 0, 1)) }
@Test fun segmentIsUndirected() { val p = IsoPoint(0, 0); val q = IsoPoint(1, 1)
  assertEquals(UnitSegment.of(p, q), UnitSegment.of(q, p)) }
@Test fun segmentRejectsNonUnit() { assertThrows<IllegalArgumentException> { UnitSegment.of(IsoPoint(0, 0), IsoPoint(2, 2)) } }
@Test fun lineSplits() { assertEquals(3, Line(IsoPoint(0, 0), IsoPoint(0, -6)).unitSegments().size) }
@Test fun everySegmentHasTwoTriangles() { val s = UnitSegment.of(IsoPoint(0, 0), IsoPoint(1, 1))
  val (t1, t2) = s.triangles(); assertNotEquals(t1, t2); assertTrue(s in t1.edges() && s in t2.edges()) }
```

- [ ] **Step 2:** Run `./gradlew :core:test` → FAIL (classes missing).
- [ ] **Step 3:** Create the Gradle skeleton and implement the types above.
- [ ] **Step 4:** Run `./gradlew :core:test :app:assembleDebug :generator:run` → tests PASS, APK builds, generator prints a usage line.
- [ ] **Step 5:** Verify the projection against `reference/index.html`: draw `fromLattice` of a single cube in the app's eventual convention and compare with the page's key picture (front = lower-right face = the +x face). If the page is mirrored, change only the sign in `fromLattice` and the `IsoDir` values, and note it in the commit message.
- [ ] **Step 6:** Commit `feat: project skeleton and iso geometry`.

---

### Task 2: Height map, visible faces, shape edges

**Files:** Create `core/…/shape/HeightMap.kt`, `VisibleFaces.kt`, `EdgeSet.kt`; Test `core/…/shape/EdgeSetTest.kt`

**Interfaces:**
- Consumes: Task 1 types.
- Produces:
  - `class HeightMap(val width: Int, val depth: Int, val heights: IntArray)` — `heights[y * width + x]` for cell (x, y); `operator fun get(x: Int, y: Int): Int` (0 outside); `val cubeCount: Int`.
  - `enum class FaceDir { TOP, FRONT, SIDE }` — TOP = +z face, FRONT = +x face (lower right), SIDE = +y face (lower left).
  - `data class Face(val x: Int, val y: Int, val z: Int, val dir: FaceDir)` — face of the unit cube with min corner (x, y, z). `val Face.plane: Pair<FaceDir, Int>` = TOP→z+1, FRONT→x+1, SIDE→y+1.
  - `fun visibleFaces(h: HeightMap): Map<IsoTriangle, Face>` — every face of every cube covers 2 triangles; a triangle keeps the face of the cube with the largest `x + y + z` (closest to the viewer). Faces hidden by a neighbour cube (TOP under a cube, FRONT against cube x+1, SIDE against cube y+1) are skipped.
  - `data class EdgeSet(val shapeEdges: Set<UnitSegment>, val flatSeams: Set<UnitSegment>)`
  - `fun computeEdges(h: HeightMap): EdgeSet`

- [ ] **Step 1: Write failing tests**

```kotlin
@Test fun singleCubeHasNineEdges() { val e = computeEdges(HeightMap(1, 1, intArrayOf(1)))
  assertEquals(9, e.shapeEdges.size); assertTrue(e.flatSeams.isEmpty()) }   // 6 outline + 3 inner
@Test fun twoFlatCubesHaveSeams() { val e = computeEdges(HeightMap(2, 1, intArrayOf(1, 1)))
  assertEquals(2, e.flatSeams.size) }   // seam on the top face and on the side face
@Test fun stepShowsEdge() { val flat = computeEdges(HeightMap(2, 1, intArrayOf(1, 1)))
  val step = computeEdges(HeightMap(2, 1, intArrayOf(2, 1))); assertTrue(step.shapeEdges.size > flat.shapeEdges.size) }
@Test fun seamsAndEdgesAreDisjoint() { /* random 4×4 maps, seed 1: shapeEdges ∩ flatSeams == ∅ */ }
```

- [ ] **Step 2:** Run `./gradlew :core:test --tests '*EdgeSetTest'` → FAIL.
- [ ] **Step 3:** Implement. Classify each unit segment of every triangle in `visibleFaces`:

```text
for each segment s with triangles (t1, t2), faces f1 = map[t1], f2 = map[t2] (null = empty):
  both null              -> nothing
  f1 == f2               -> nothing (diagonal inside one face)
  one null               -> shape edge (outline)
  f1.plane != f2.plane   -> shape edge
  same plane, f1 != f2   -> flat seam
```

- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5:** Commit `feat: visible faces and shape edges`.

---

### Task 3: Orthographic views

**Files:** Create `core/…/views/OrthoViews.kt`; Test `core/…/views/OrthoViewsTest.kt`

**Interfaces:**
- Consumes: `HeightMap`.
- Produces:
  - `data class GridSegment` — unit segment on an integer square grid, undirected (same normalization rule as `UnitSegment`), `companion fun of(x1: Int, y1: Int, x2: Int, y2: Int)`.
  - `data class OrthoView(val cols: Int, val rows: Int, val lines: Set<GridSegment>)`
  - `data class ViewSet(val top: OrthoView, val front: OrthoView, val side: OrthoView)`; `fun views(h: HeightMap): ViewSet`.

Port the view-line rules from `reference/index.html` exactly (which lines the page draws in each view). The uniqueness check in Task 5 compares `ViewSet` equality, so these rules decide which puzzles count as unique.

- [ ] **Step 1: Write failing tests** — `singleCubeViewsAreSquares` (each view = 4 lines); `heightChangeShowsInTop` (`HeightMap(2,1,[2,1])` top view has a line between the two cells; `[1,1]` has not); `viewsMatchReference` (three shapes copied from puzzles stored in `reference/index.html` give the same lines as the page draws).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `views(h)`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: orthographic views`.

---

### Task 4: Drawing checker

**Files:** Create `core/…/checker/DrawingChecker.kt`; Test `core/…/checker/DrawingCheckerTest.kt`

**Interfaces:**
- Consumes: `EdgeSet`, `computeEdges`, `UnitSegment`.
- Produces:
  - `data class CheckResult(val missing: Set<UnitSegment>, val mistakes: Set<UnitSegment>) { val correct get() = missing.isEmpty() && mistakes.isEmpty() }`
  - `fun check(drawn: Set<UnitSegment>, answer: EdgeSet): CheckResult` — `missing = shapeEdges − drawn`; `mistakes = (drawn − shapeEdges) − flatSeams`.
  - The drawing must be placed at the same lattice origin as the answer. The puzzle screen fixes the answer at cube origin (0,0,0) and shows the grid in that frame.

- [ ] **Step 1: Write failing tests** (use a 3×3 map, seed fixed):

```kotlin
@Test fun ownEdgesAreCorrect() { assertTrue(check(edges.shapeEdges, edges).correct) }
@Test fun removedEdgeIsOneMissing() { val r = check(edges.shapeEdges - edges.shapeEdges.first(), edges)
  assertEquals(1, r.missing.size); assertTrue(r.mistakes.isEmpty()) }
@Test fun lineInEmptySpaceIsOneMistake() { val far = UnitSegment.of(IsoPoint(40, 40), IsoPoint(41, 41))
  assertEquals(setOf(far), check(edges.shapeEdges + far, edges).mistakes) }
@Test fun flatSeamsAreNotMistakes() { assertTrue(check(edges.shapeEdges + edges.flatSeams, edges).correct) }
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: drawing checker with tolerant rule`.

---

### Task 5: Puzzle generator and `puzzles.json`

**Files:** Create `core/…/puzzles/PuzzleFile.kt`, `generator/…/Solver.kt`, `ShapeSampler.kt`, `Main.kt`; Output `app/src/main/assets/puzzles.json`; Test `generator/src/test/…/SolverTest.kt`, `PuzzleFileTest.kt`

**Interfaces:**
- Consumes: `HeightMap`, `views`, `ViewSet`, `visibleFaces`.
- Produces:
  - `@Serializable data class PuzzleFile(val version: Int = 1, val puzzles: List<PuzzleEntry>)`; `@Serializable data class PuzzleEntry(val id: String, val level: Int, val width: Int, val depth: Int, val heights: List<Int>)` — id format `L{level}-{nnn}` (e.g. `L3-007`), `nnn` = 1-based order inside the level.
  - `fun countSolutions(v: ViewSet, width: Int, depth: Int, maxH: Int, limit: Int = 2): Int` — backtracking over cells; prune each cell to `0..maxH` and by the front/side view outlines; stop at `limit`.
  - `fun sampleShape(width: Int, depth: Int, maxH: Int, rng: Random): HeightMap` — footprint 4-connected; every row and column has a non-zero cell; `maxH` is reached at least once.
  - CLI: `./gradlew :generator:run --args="--out app/src/main/assets/puzzles.json --per-level 50 --seed 2026"`. Orientation: for A≠B levels, pick `width`/`depth` order per puzzle with the rng.
  - Order inside a level: by hidden cube count (cubes with no face in `visibleFaces`), then `cubeCount`, ascending.

- [ ] **Step 1: Write failing tests** — `singleCubeIsUnique` (`countSolutions(views(1×1 [1]),1,1,1) == 1`); `ambiguityExists` (enumerate all 3×3 maps with h ≤ 2: at least one has `countSolutions == 2`, and every map's own views give `countSolutions ≥ 1`); `samplerRespectsRules` (200 samples per level: connected, no empty row/column, max reached); `assetPuzzlesAreUnique` (reads the committed `puzzles.json`: 50 per level for levels 1–6, every entry `countSolutions == 1`, ids unique, sizes match the level table).
- [ ] **Step 2:** Run `./gradlew :generator:test` → FAIL.
- [ ] **Step 3:** Implement solver, sampler, CLI.
- [ ] **Step 4:** Run the CLI, then `./gradlew :generator:test` → PASS. Note the run time per level in the commit message (level 6 may be slow; that is fine).
- [ ] **Step 5:** Commit `feat: puzzle generator and puzzles.json`.

---

### Task 6: Access rules

**Files:** Create `core/…/access/AccessRules.kt`; Test `AccessRulesTest.kt`

**Interfaces:**
- Produces: `object AccessRules { fun viewsPuzzle(level: Int, indexInLevel: Int, full: Boolean): Boolean; fun netsLevel(level: Int, full: Boolean): Boolean; fun fullPalette(full: Boolean): Boolean; fun accentUnlocked(accent: Accent, solved: Int, full: Boolean): Boolean }` — `indexInLevel` is 0-based. `enum class Accent(val threshold: Int) { YELLOW(0), MINT(10), LILAC(25), PINK(50), LIME(100), RED(150), SAND(200) }` (colours live in the app theme, not in `:core`).

- [ ] **Step 1: Write failing tests**

```kotlin
@Test fun freeViews() { assertTrue(AccessRules.viewsPuzzle(1, 14, false)); assertFalse(AccessRules.viewsPuzzle(1, 15, false))
  assertTrue(AccessRules.viewsPuzzle(4, 2, false)); assertFalse(AccessRules.viewsPuzzle(4, 3, false)) }
@Test fun freeNets() { assertTrue(AccessRules.netsLevel(1, false)); assertFalse(AccessRules.netsLevel(2, false)) }
@Test fun fullUnlocksAll() { assertTrue(AccessRules.viewsPuzzle(6, 49, true)); assertTrue(AccessRules.netsLevel(3, true)); assertTrue(AccessRules.fullPalette(true)) }
@Test fun paletteLocked() { assertFalse(AccessRules.fullPalette(false)) }
@Test fun accents() { assertTrue(AccessRules.accentUnlocked(Accent.YELLOW, 0, false)); assertTrue(AccessRules.accentUnlocked(Accent.MINT, 10, false))
  assertFalse(AccessRules.accentUnlocked(Accent.LILAC, 24, false)); assertTrue(AccessRules.accentUnlocked(Accent.SAND, 0, true)) }
```

- [ ] **Step 2–4:** Run → FAIL, implement, run → PASS.
- [ ] **Step 5:** Commit `feat: free and paid access rules`.

---

### Task 7: Nets — unfold, fold check, puzzle

**Files:** Create `core/…/nets/Polycube.kt`, `Net.kt`, `Unfolder.kt`, `FoldChecker.kt`, `NetsPuzzle.kt`; Test `NetsTest.kt`

**Interfaces:**
- Produces:
  - `data class Cell(val col: Int, val row: Int)`; `data class Net(val squares: Set<Cell>)` — normalized so min col/row = 0.
  - `data class Polycube(val cubes: Set<Triple<Int, Int, Int>>)`; `val Polycube.surfaceFaces: Int`.
  - `fun unfold(shape: Polycube, rng: Random): Net`
  - `fun folds(net: Net, shape: Polycube): Boolean`
  - `data class NetsPuzzle(val level: Int, val shape: Polycube, val options: List<Net>, val correctIndex: Int)`; `fun makeNetsPuzzle(level: Int, rng: Random): NetsPuzzle` — 4 options; each wrong option = the correct net with one square moved, and `folds(wrong, shape) == false`; all 4 options distinct.
  - Port shapes per level, unfolding and fold check from `reference/index.html`.

- [ ] **Step 1: Write failing tests** — `elevenCubeNets` (enumerate the 35 free hexominoes; exactly 11 satisfy `folds(net, unitCube)`); `generatedNetsFold` (450 runs, seeds 0..449, all levels: `folds(puzzle.options[correctIndex], shape)`); `wrongNetsDoNotFold` (same runs: no wrong option folds; options distinct).
- [ ] **Step 2–4:** Run → FAIL, port, run → PASS.
- [ ] **Step 5:** Commit `feat: nets puzzles`.

---

### Task 8: Fold animation model

**Files:** Create `core/…/nets/FoldAnimation.kt`; Test `FoldAnimationTest.kt`

**Interfaces:**
- Consumes: `Net`, `Polycube`, `folds`.
- Produces:
  - `data class SquarePose(val corners: List<Triple<Double, Double, Double>>)` — 4 corners in 3D.
  - `class FoldAnimation(net: Net, shape: Polycube) { fun pose(square: Cell, t: Double): SquarePose; fun finalFace(square: Cell): Pair<Triple<Int, Int, Int>, Triple<Int, Int, Int>> }` (cube position, outward unit normal) with `t` in `0.0..1.0`; at `t = 0` the net lies flat; each square turns about its fold line by an angle in {0°, +90°, −90°} scaled by `t` (port the order and angles from `reference/index.html`).
  - Projection to screen uses `IsoPoint` math (Task 1) with `Double` coordinates.

- [ ] **Step 1: Write failing tests** — `flatAtStart` (all corners have the same z at t=0); `landsOnFaces` (450 runs as in Task 7: at t=1 each square's corners equal the corners of a distinct surface face of the shape, within 1e-6).
- [ ] **Step 2–4:** Run → FAIL, port, run → PASS.
- [ ] **Step 5:** Commit `feat: fold animation model`.

---

### Task 9: Stroke snapping

**Files:** Create `core/…/drawing/StrokeSnapper.kt`; Test `StrokeSnapperTest.kt`, fixtures `core/src/test/resources/strokes/*.json`

**Interfaces:**
- Produces:
  - `data class Vec2(val x: Double, val y: Double)` — in grid units (1.0 = one grid step, same frame as `IsoPoint` screen math with `step = 1`).
  - `fun snapDrag(start: Vec2, end: Vec2): Line?` — start snaps to the nearest lattice point; direction = the nearest of the 6 iso directions; length = rounded to whole steps; `null` if length is 0.
  - `fun snapFreehand(points: List<Vec2>): List<Line>` — simplify the stroke (Ramer–Douglas–Peucker, tolerance 0.35); snap each piece like `snapDrag`; drop pieces shorter than 0.5; join consecutive pieces at shared lattice points. If any kept piece is more than 15° from every iso direction, return an empty list (stroke not readable).

- [ ] **Step 1: Write failing tests** — `dragSnaps` (a slightly crooked drag along +x of length 2.9 → `Line` of 3 steps along `IsoDir.X`); `lShapeGivesTwoLines` (fixture `l_shape.json` → 2 lines meeting at one point); `tapGivesNothing` (single point → empty); `tinyStrokeGivesNothing` (length 0.3 → empty); `zigzagGivesNothing` (fixture `zigzag.json` with 45° pieces → empty); `recordedStrokes` (each fixture file holds `points` and `expected` lines; all match).
- [ ] **Step 2–4:** Run → FAIL, implement, run → PASS.
- [ ] **Step 5:** Commit `feat: drag and freehand snapping`.

---

### Task 10: Drawing model, editor, fill

**Files:** Create `core/…/drawing/Drawing.kt`; Test `DrawingEditorTest.kt`

**Interfaces:**
- Consumes: `UnitSegment`, `Line`, `IsoTriangle`.
- Produces:
  - `@Serializable data class Drawing(val lines: Set<UnitSegment>, val fills: Map<IsoTriangle, Int>)` — `Int` = colour index (0–2 = the 3 shading tones; 3+ = palette). Give `UnitSegment` and `IsoTriangle` serializers.
  - `data class GridBounds(...)`, `fun GridBounds.contains(t: IsoTriangle): Boolean` — the drawable area.
  - `class DrawingEditor(initial: Drawing, bounds: GridBounds) { val drawing: StateFlow<Drawing>; fun addLines(lines: List<Line>); fun erase(segment: UnitSegment); fun fill(start: IsoTriangle, colour: Int); fun clear(); fun undo(); fun redo(); val canUndo: Boolean; val canRedo: Boolean }` — each call is one undo step; a call that changes nothing adds no step.
  - `fill`: flood fill across triangle neighbours, not crossing any segment in `lines`. If the region reaches outside `bounds`, fill nothing.

- [ ] **Step 1: Write failing tests** — `undoRedo` (add, add, undo → 1 line, redo → 2); `fillClosedRhombus` (4 lines around one rhombus, fill inside → 2 triangles filled); `fillOpenRegionDoesNothing` (3 of the 4 lines, fill → `fills` empty, `canUndo` unchanged); `clearIsUndoable`; `serializationRoundTrip` (encode/decode equals).
- [ ] **Step 2–4:** Run → FAIL, implement, run → PASS.
- [ ] **Step 5:** Commit `feat: drawing editor with undo and fill`.

---

### Task 11: App storage

**Files:** Create `app/…/data/PuzzleCatalog.kt`, `DrawingStore.kt`, `ProgressStore.kt`, `SettingsStore.kt`; Test `app/src/test/…/data/StoresTest.kt` (Robolectric)

**Interfaces:**
- Consumes: `PuzzleFile`, `Drawing`.
- Produces:
  - `class PuzzleCatalog(context) { val levels: List<Int>; fun puzzles(level: Int): List<PuzzleEntry>; fun byId(id: String): PuzzleEntry }` — loaded once from `assets/puzzles.json`.
  - `class DrawingStore(dir: File) { suspend fun load(key: String): Drawing?; suspend fun save(key: String, d: Drawing); suspend fun list(prefix: String): List<String>; suspend fun rename(from: String, to: String); suspend fun delete(key: String) }` — one JSON file per key under `files/drawings/`, written with `AtomicFile`. Keys: `views/<puzzleId>`, `draw/<uuid>`. Draw-mode titles live in `ProgressStore`.
  - `class ProgressStore(file: File) { val state: StateFlow<Progress>; suspend fun markSolved(id: String); suspend fun setDrawTitle(key: String, title: String) }` — `@Serializable data class Progress(val solved: Set<String>, val score: Int, val drawTitles: Map<String, String>)`; `markSolved` adds 1 to score only the first time.
  - `class SettingsStore(dataStore) { val darkTheme: Flow<Boolean?> /* null = follow system */; val cachedFullVersion: Flow<Boolean>; val accent: Flow<Accent>; suspend fun setDarkTheme(v: Boolean?); suspend fun setCachedFullVersion(v: Boolean); suspend fun setAccent(a: Accent) }` — default accent `YELLOW`.
  - `Progress` also exposes `val solvedCount: Int` = views puzzles solved + nets right first choices (`markNetsRight()` adds one).
  - Save policy (used by screens): every editor change → save after 300 ms debounce; plus a forced save in `onStop`.

- [ ] **Step 1: Write failing tests** — `catalogHas50PerLevel`; `drawingSurvivesNewStoreInstance` (save, create a new `DrawingStore` on the same dir, load → equal: this is the process-death case); `solvedCountsOnce` (`markSolved` twice → score 1); `renameAndDelete`.
- [ ] **Step 2–4:** Run `./gradlew :app:testDebugUnitTest` → FAIL, implement, → PASS.
- [ ] **Step 5:** Commit `feat: local storage`.

---

### Task 12: Billing and entitlement

**Files:** Create `app/…/billing/BillingGateway.kt`, `PlayBillingGateway.kt`, `Entitlements.kt`; Test `EntitlementsTest.kt` with a fake gateway

**Interfaces:**
- Consumes: `SettingsStore`.
- Produces:
  - `interface BillingGateway { suspend fun queryOwned(): QueryResult; suspend fun productPrice(): String?; suspend fun launchPurchase(activity: Activity); val purchaseUpdates: Flow<List<OwnedPurchase>>; suspend fun acknowledge(token: String) }`; `sealed interface QueryResult { data class Ok(val purchases: List<OwnedPurchase>) : QueryResult; data object Unavailable : QueryResult }`; `data class OwnedPurchase(val productId: String, val state: State, val acknowledged: Boolean, val token: String) { enum class State { PURCHASED, PENDING } }`.
  - `class Entitlements(gateway, settings, scope) { val fullVersion: StateFlow<Boolean>; suspend fun refresh(); suspend fun restore() }` — rules: starts with the cached value; `Ok` → full = any `full_version` with `PURCHASED`; acknowledges any unacknowledged `PURCHASED`; writes the cache; `Unavailable` → keep the cached value; `PENDING` never unlocks.
  - `PlayBillingGateway` — Google Play Billing Library, product `full_version`, type INAPP.

- [ ] **Step 1: Write failing tests** — `pendingDoesNotUnlock`; `purchasedUnlocksAndAcknowledges` (fake records `acknowledge(token)`); `offlineKeepsCache` (cache true + `Unavailable` → true; cache false + `Unavailable` → false); `refundRelocks` (cache true + `Ok(emptyList())` → false); `updatesFlowUnlocks` (a `PURCHASED` item on `purchaseUpdates` → true).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS.
- [ ] **Step 5:** Commit `feat: one-time purchase and entitlement`.

---

### Task 12b: Theme and design tokens

**Files:** Create `app/…/ui/theme/Tokens.kt`, `Theme.kt`, `Fonts.kt`, `app/src/main/res/font/*` (IBM Plex Mono 400/600, Space Grotesk 500), `app/src/main/assets/licences/OFL.txt`; Test `app/src/test/…/ui/theme/ThemeTest.kt`, screenshot tests `app/src/test/…/screenshots/` (Roborazzi)

**Interfaces:**
- Consumes: `Accent`, `SettingsStore.darkTheme`, `SettingsStore.accent`.
- Produces:
  - `data class IsoColors(...)` with every colour token of `docs/design/design-system.md` (light and dark values exactly as listed); `val LocalIsoColors`, `LocalIsoType`, `LocalIsoShapes`.
  - `fun accentColor(a: Accent): Color` (values from the design system) and `fun onAccent(c: Color): Color` = `#16161A` or `#FFFFFF`, whichever has the higher contrast.
  - `@Composable fun IsoTheme(dark: Boolean, accent: Accent, content: @Composable () -> Unit)`.
  - Screenshot test harness: `fun snapshot(name: String, dark: Boolean, content: @Composable () -> Unit)` writing to `app/src/test/screenshots/`. Later UI tasks add one light and one dark snapshot per screen. The owner compares them with the mockups; recorded images become the reference.

- [ ] **Step 1: Write failing tests** — `tokensMatchDesignSystem` (spot-check: light `bg == #F5F2EA`, dark `bg == #121214`, `markMistake` light `#E4572E`); `onAccentContrast` (for every `Accent`, contrast of `onAccent(accentColor(a))` on `accentColor(a)` ≥ 4.5); `marksAreNotAccents` (no accent colour equals `markMissing` or `markMistake`).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS.
- [ ] **Step 5:** Commit `feat: theme and design tokens`.

---

### Task 13: Iso grid canvas and gestures

**Files:** Create `app/…/ui/grid/GridTransform.kt`, `GridGestures.kt`, `IsoGridCanvas.kt`; Test `GridGesturesTest.kt` (Compose UI test, Robolectric)

**Interfaces:**
- Consumes: `DrawingEditor`, `StrokeSnapper`, `Drawing`, `CheckResult`.
- Produces:
  - `data class GridTransform(val stepPx: Float, val offset: Offset)` — `fun toGrid(p: Offset): Vec2`, `fun toScreen(v: Vec2): Offset`; initial `stepPx` = largest value that fits the content bounds in the canvas size.
  - `enum class Tool { LINE, FREEHAND, FILL, ERASE }`
  - `@Composable fun IsoGridCanvas(drawing: Drawing, tool: Tool, colour: Int, penOnly: Boolean, overlay: GridOverlay?, onLines: (List<Line>) -> Unit, onFill: (IsoTriangle) -> Unit, onErase: (UnitSegment) -> Unit, modifier: Modifier)` — `sealed interface GridOverlay { data class Answer(val edges: Set<UnitSegment>); data class Check(val result: CheckResult) }`. Draw as in the design system "Iso grid" section: dashed 3-direction line grid, guide hexagon of the puzzle box, FRONT/SIDE arrows (puzzles only), fills, user lines; Answer overlay = shape edges in `ink` at 55%; Check = missing 3.5 dp dashed `markMissing`, mistakes 4 dp solid `markMistake`. All colours from `LocalIsoColors`.
  - Gestures: one pointer → current tool; two pointers → zoom (0.5×–4×) and pan; when a second pointer goes down during a stroke, cancel the stroke (no `onLines` call). `penOnly = true`: only `PointerType.Stylus` draws; a finger pans with one pointer.
  - Erase: tap → nearest segment within 0.4 step.

- [ ] **Step 1: Write failing tests** — `dragAddsOneLine`; `secondFingerCancelsStroke` (down, move, second pointer down, up → `onLines` never called); `penOnlyIgnoresFinger` (finger drag with `penOnly` → no `onLines`); `pinchChangesScale`.
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS.
- [ ] **Step 5:** Commit `feat: iso grid canvas and gestures`.

---

### Task 14: Views puzzle flow (level list + puzzle screen)

**Files:** Create `app/…/ui/views/LevelListScreen.kt`, `ViewsPuzzleScreen.kt`, `ViewsPuzzleViewModel.kt`, `OrthoViewsPanel.kt`, `KeyPicture.kt`; Test `ViewsPuzzleViewModelTest.kt`, `ViewsPuzzleScreenTest.kt`

**Interfaces:**
- Consumes: `PuzzleCatalog`, `ProgressStore`, `DrawingStore`, `Entitlements`, `AccessRules`, `views`, `computeEdges`, `check`, `IsoGridCanvas`.
- Produces:
  - `class ViewsPuzzleViewModel(puzzleId: String, …) : ViewModel` with `val editor: DrawingEditor`, `val overlay: StateFlow<GridOverlay?>`, `fun check()`, `fun toggleAnswer()`, `fun next(): String?` (next puzzle id or null). `check()` with `correct` calls `markSolved`. Loads the saved drawing on start; saves with the Task 11 policy.
  - Level list: per level "solved / total", locked puzzles show a lock; tapping a locked one navigates to the purchase screen.
  - Layout: `BoxWithConstraints`; height ≥ width → views panel (2×2: top, front, side, key picture) above the grid, with a hide/show toggle; else beside it. Look: mockup F/H and the design system (views with plane lines, top bar, tool bar, action row with ANSWER + CHECK). Add light and dark screenshot snapshots.

- [ ] **Step 1: Write failing tests** — `correctDrawingMarksSolved` (fill editor with the answer's `shapeEdges`, `check()` → overlay `Check` with `correct`, progress contains id); `drawingRestoredAfterRecreate` (`StateRestorationTester` + new ViewModel on same stores → same `Drawing`); `lockedPuzzleOpensPurchase` (free user taps `L1-016` → purchase route); `panelBesideInLandscape` (wide constraints → panel left of grid).
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS.
- [ ] **Step 5:** Commit `feat: views puzzles`.

---

### Task 15: Nets puzzle screen

**Files:** Create `app/…/ui/nets/NetsScreen.kt`, `NetsViewModel.kt`, `FoldView.kt`; Test `NetsViewModelTest.kt`

**Interfaces:**
- Consumes: `makeNetsPuzzle`, `FoldAnimation`, `AccessRules`, `Entitlements`, `ProgressStore`.
- Produces: `class NetsViewModel(level: Int, …) { val puzzle: StateFlow<NetsPuzzle>; val answer: StateFlow<Int?>; val t: StateFlow<Float>; fun choose(i: Int); fun play(); fun scrub(t: Float); fun next() }` — after `choose`, show right/wrong, then the fold of the correct net; `play()` animates t 0→1 over 2.5 s; score +1 on a right first choice. Levels 2–3 locked for free users (route to purchase). Puzzle in progress survives rotation (keep seed in `SavedStateHandle`).

- [ ] **Step 1: Write failing tests** — `rightChoiceScores`; `wrongChoiceShowsCorrect` (answer state holds both indexes); `sameSeedAfterRecreate`; `level2LockedForFree`.
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS.
- [ ] **Step 5:** Commit `feat: nets puzzles screen`.

---

### Task 16: Draw mode, home, settings, purchase screen, theme

**Files:** Create `app/…/ui/draw/DrawListScreen.kt`, `DrawScreen.kt`, `ui/home/HomeScreen.kt`, `ui/settings/SettingsScreen.kt`, `ui/settings/AccentScreen.kt`, `ui/purchase/PurchaseScreen.kt`, `App.kt`; Test `DrawModeTest.kt`, `PurchaseScreenTest.kt`

**Interfaces:**
- Consumes: all stores, `Entitlements`, `IsoGridCanvas`, `AccessRules.fullPalette`.
- Produces:
  - Routes: `home`, `levels`, `views/{id}`, `nets/{level}`, `draw`, `draw/{key}`, `purchase`, `settings`.
  - Draw mode: list (new, open, rename, delete with confirm); drawing screen uses all tools; palette shows tones 0–2 always and tones 3+ only with `fullPalette`, else a lock that opens `purchase`.
  - Purchase screen text: "Unlock all puzzles, all nets levels, every accent colour and the full colour palette. One payment, no subscription." + price from `productPrice()` (hide the button and show "Store not available" if null) + Buy.
  - Settings: theme (System / Light / Dark), Accent (opens the accent screen), "Restore purchase" → `Entitlements.restore()` with a result message, About (version).
  - Accent screen (mockup I): one row per `Accent` with colour, name and state (Selected / Unlocked / "Solve N puzzles"), progress to the next accent, "UNLOCK ALL · FULL VERSION" button for free users. Locked rows cannot be selected. Route `settings/accent`.
  - All screens use `IsoTheme`; add light and dark screenshot snapshots for each screen.

- [ ] **Step 1: Write failing tests** — `newDrawingSavedAndListed`; `paletteLockedForFree`; `lockedAccentNotSelectable`; `accentChangesCheckButton`; `purchaseScreenHidesBuyWithoutPrice`; `restoreShowsMessage`.
- [ ] **Step 2–4:** Run → FAIL, implement, → PASS.
- [ ] **Step 5:** Commit `feat: draw mode, home, settings, purchase`.

---

### Task 17: Release build and store texts

**Files:** Modify `app/build.gradle.kts`, `AndroidManifest.xml`; Create `docs/privacy-policy.md`, `docs/store-listing.md`, `docs/release-checklist.md`

- [ ] **Step 1:** Add a test `manifestRules` (parse merged manifest in a unit test or a Gradle check): `appCategory == game`, no `screenOrientation`, `targetSdk == 36`, permissions only those added by Play Billing. Run → FAIL if any rule is broken.
- [ ] **Step 2:** Set release config: R8 on, signing read from `keystore.properties` (git-ignored; document creation in `release-checklist.md`), `versionCode = 1`, `versionName = "1.0"`, build an `.aab` with `./gradlew :app:bundleRelease`.
- [ ] **Step 3:** Write `privacy-policy.md` (no data collected; purchases handled by Google Play), `store-listing.md` (short + full description that says "Free: 30+ puzzles and nets level 1. One purchase unlocks everything."; placeholder app name), `release-checklist.md` (developer account, merchant account, product `full_version` in Play Console, internal test, closed test with ≥12 testers also added under Settings > License testing, 14 days, production application, Data safety form = no data collected, content rating questionnaire).
- [ ] **Step 4:** Run `./gradlew test :app:bundleRelease` → all tests PASS, `.aab` built.
- [ ] **Step 5:** Commit `chore: release build and store texts`.

---

### Task 18: Owner's phone test (owner, not code)

- [ ] Install the internal-test build. Draw one puzzle on each level 1–6. If level 6 feels too small, remove level 6 from `puzzles.json` (re-run the generator without it) and from `AccessRules` tests.
- [ ] Rotate and send the app to the background with a half-done drawing; return; the drawing is the same.
- [ ] Dark theme: all marks are readable.
- [ ] Compare the screenshot snapshots with mockups F, H and I; list what to change.
