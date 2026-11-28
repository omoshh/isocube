# Round 4 phase 3a — cylinders and half-cylinders (design, 2026-11-28)

Parent design: `docs/2026-11-27-round4-design.md` (catalog, rules, anti-goals; its two amendments apply).
Lines marked **(builder's call)** were not decided by the owner; he may change them when he reads this.

## Intent

The owner wants harder, more varied Views puzzles, and he likes how a round shape looks different from each side.
Phase 3 brings curved pieces. The owner split it on 2026-11-28:

- **3a (this design):** vertical cylinders and roof B (half-cylinder), the Curves sets, midpoint snapping.
- **3b (later, own design):** C (curved ramp), D (rounded corner), roof A (wall + half-round).

## Goals

1. The shape model, the 3 views, the 3D (iso) picture, the fairness rule, the solver, the checker, the answer
   overlay and the back picture know 4 new pieces (all 1 cube high, on a flat area, nothing on top, as in the parent):
   - **Cylinder 1×1:** the circle inscribed in one cell (radius ½), vertical axis.
   - **Cylinder 2×2:** the circle inscribed in a 2×2 square (radius 1), vertical axis.
   - **Roof B 2×1 and 2×2:** half-cylinder of radius 1, axis on the base, 2 cells wide, 1 or 2 cells long; axis along X or Y.
2. Views gets **Curves** sets of 25 ready-made puzzles each (cubes + curved pieces, no ramps, at least one curved piece).
3. Midpoint snapping comes back in a clear form (owner's pick, 2026-11-28): while you drag the line or arc tool,
   faint edge-midpoint dots show **only near the finger**, and the drag snaps to them. Otherwise the grid stays clean.
4. Version **4.6**.

## Non-goals

- Pieces C, D and roof A (phase 3b).
- Endless with curves (amendment 2026-11-28: Endless is cube-only).
- Ramps and curves in one puzzle (that is phase 4, the mixed sets).
- Changes to Reverse, Nets, Shadows, the Slopes sets or the cube levels.
- No save migration: nothing is deleted, the backup version stays 3.

## Anti-goals

- A Curves puzzle with two solutions, or with a piece that shows in neither the front nor the back picture.
- The checker marks a correct drawing wrong because of rounding. The answer is exact keys (line keys and `ArcKey`s).
- A puzzle whose answer has a line or arc that ends at a point the tools cannot reach.
- Snap points that do not match what the grid shows (owner feedback on phase 1: "new grid is very confusing").
- Existing saves change in any way.

## Constraints

- `CLAUDE.md`: tests first for `src/core`, one commit per task, report as "what works and how to try it".
- Pixel 7 / Firefox Android is the main device. No new dependencies.
- Generation runs on the owner's laptop: at most **3 jobs** (4 jobs reached 99 °C), `systemd-inhibit`,
  tests with `--maxWorkers=3`, watch temperatures. Use a per-candidate wall-clock timeout (a step budget does not cap time).
- **Owner rule:** if a set takes more than **1 minute per puzzle**, or its puzzles look too similar, stop and tell
  the owner before shipping that size.
- Merge and push to `main` without a PR (owner's way of working).

## Approaches considered

1. **Exact views + sampled iso picture (picked; the owner agreed).** In the top, front and side views a curved piece
   is a circle or half circle only when seen along its axis; from the other sides it is a rectangle on grid lines.
   The solver works out these views millions of times, so they stay exact and fast in `exactViews` (circles added).
   The iso picture is worked out once per puzzle, so it uses the general sketch with each curved face cut into thin
   strips that share one plane key (no lines between strips); the visible result maps back to exact arc and line keys.
2. Sampling everywhere (the general sketch for the views too). Rejected: about 15× slower in the slopes tests;
   generation would pass 1 minute per puzzle.
3. Exact math for the iso picture too. Rejected: a line crosses an ellipse at points with no exact form in the
   current key format.

## The parts of the how already decided

### Shape and puzzle file
- `Shape` gets a list of placed curved pieces beside `ramps` (builder picks names; for example `curves`).
- Puzzle file entries get an optional array for them, like `ramps`; entries without it load as now.
- Ids: `CV-NNN`, `CV2-NNN`, `CV3-NNN` **(builder's call, as SL / SL2 / SL3)**; new set name (for example `curves`).

### Views (top, front, side)
- A cylinder: a circle from the top, a rectangle from the front and the side.
- Roof B: a half circle seen along its axis, a rectangle from the other two views.
- Every visible edge shows (parent rule). The crest of the half-cylinder and the side of a cylinder have no edge in
  the views except the outline. Circles are stored as eighth pieces like the drawing's `ArcKey`s, in view coordinates.
- A line or circle piece that shows only in part makes the view `partial` (the puzzle is rejected, as now).

### Iso picture
- Silhouette lines of a cylinder and of roof B start at the widest points of their ellipses (eighth points),
  so the player can draw them with the cylinder drag or the line tool.
- **Lines hidden in part behind a silhouette line (owner's pick, 2026-11-28, option 2 of 3).** A round piece on a
  stack or beside cubes hides part of the lines behind it. Such a line's visible part ends where it meets a silhouette
  line of the round piece (a vertical line for a cylinder, an X or Y line for roof B). That end point is exact in the
  current point format (`Pt` with √2 parts): a lattice-direction line crossing a lattice-direction line through an
  eighth point. So:
  - the answer keeps the visible part as exact keys, ending at that crossing;
  - the crossing of a drawn line with a drawn silhouette line becomes a snap point (Draw and Views grid), shown and
    snapped like the other extra points;
  - the back picture clips the same way.
- Still rejected (`partial`): a line or arc that ends anywhere else, for example a cube edge that cuts the round
  bottom of a cylinder (not an eighth point), or a partly hidden arc.
- Partly hidden **seams** (joins on one plane, which are optional) do not reject a puzzle **(builder's call: they need
  not be drawn, so their ends do not matter)**.
- Rejected alternatives: keep the strict rule (round pieces only alone on the floor; sets may not fill); let the player
  draw the full line (breaks "hidden lines count as extra").
- The answer overlay and the ⟲ back picture draw arcs.

### Fairness and solver
- Fairness: every curved piece and every needed cube shows in the front or the back picture (as ramps now).
- The solver (`fastSolver.ts`) tries the new pieces on each cell through `PIECES` / `starts`.
- Ground truth: a brute-force check at a small size, as done for ramps.
- **One solution is checked against every piece that exists at generation time:** cubes, ramps and the 3a pieces,
  although Curves sets contain no ramps **(builder's call: the parent says "cubes and catalog pieces")**.
- Once the 3a pieces exist, a script rechecks the 75 Slopes puzzles against them and reports any with a second
  answer; none is changed without the owner **(builder's call)**. The same recheck for 3b pieces belongs to the 3b design.

### Checker
- The drawing must contain every answer line and arc piece; extra lines and arcs are mistakes; hidden ones count as
  extra; joins on one plane stay optional (parent rules). Each arc eighth counts as one mistake (known phase 1 minor).

### Snapping (Draw and Views grid)
- Edge midpoints become snap points again, but their dots show faintly only within a short distance of the finger while
  it drags (line tool and arc tool). The drag snaps only to a dot that shows at that moment.
- In Views: only in puzzles that have a curved piece; cube and slope puzzles keep no midpoints, because there a
  midpoint is always a mistake **(builder's call)**. Draw mode: always on with the line and arc tools.
- The distance **(builder's call)**: about 1 cell; tune on the phone.

### Sets and levels screen
- **(builder's call, as the Slopes sizes):** Curves 1 = 3×3–3×4, height up to 3; Curves 2 = 4×4×3; Curves 3 = 4×5×4
  (4×5 or 5×4). 25 puzzles each, variety at least 3 cells between any two (as Slopes).
- Prefer puzzles with more and bigger curved pieces when picking the 25 **(builder's call)**.
- Levels list: L1, L2, Slopes 1–3, **Curves 1–3**, L3–L6, Endless. An empty set stays hidden (as Slopes).
- A size that fails the owner rule is left out and reported, not shipped.

## Left to the builder

- Data shapes, key formats for view circles, file and function names.
- How finely the iso picture cuts curved faces, and how the visible strips map back to eighth keys.
- Whether the Curves generator is a new script or a size option of `scripts/gen-slopes.ts`.
- How many pieces per puzzle, per size.
- Order of tasks, as long as each task ends with passing tests and the phase merges only when it works end to end.
