# Round 4 — slopes and curves (design, 2026-11-27)

Decisions made with the owner in chat on 2026-11-27. Lines marked **(builder's call)** were not decided by the owner;
they are proposals and the owner may change them when he reads this.

## Intent

The owner wants harder and more varied puzzles. At the end of Views level 1 the puzzles differed by only 1–3 cubes.
He likes how a round shape looks different from different sides, and he wants slanted shapes too.
Round 4 adds **slopes** and **curves** to the shapes, to the **Views** mode (read 3 views, draw the stack)
and to **Draw** mode. Other modes do not change in this round.

The owner has extra usage for a short time and wants as much of this built as possible. So the work goes in phases;
each phase ends with a working, deployed site.

## Goals

1. Draw mode and the Views drawing grid get two new tools: **free lines** (any grid point to any grid point) and an **arc tool**.
2. The shape model gets **pieces**: slopes and curved solids on top of cube stacks.
3. Views gets new sets: **Slopes** (25), **Curves** (25), and new **levels 3–6** with cubes, slopes and curves (50 each).
4. **Endless** (Views) gets a size picker and switches for slopes and curves.

## Non-goals

- No changes to Reverse, Nets or Shadows. Reverse keeps its cube-only levels 1–6.
- No free-form (unsnapped) curves.
- No pieces that stand on other pieces (nothing is placed on top of a slope or a curve).
- No spheres or cones.

## Anti-goals (a failure even if it works)

- A puzzle with more than one solution, or with an important part hidden in both the front and the back picture.
- The checker marks a correct drawing wrong (or a wrong one correct) because of rounding. All checks stay exact.
- Endless freezes the phone. Generation runs in the web worker and has a time limit.
- The existing save is corrupted, or loses data other than the deleted puzzles' data.
- A phase is left half-done on `main`. Each phase is merged only when it works end to end.

## Constraints

- Rules in `CLAUDE.md`: web version only, tests first for `src/core`, one commit per task, report to the owner as
  "what works and how to try it" (he does not read code).
- Main test device: Pixel 7, Firefox for Android. Also desktop Chrome and Firefox.
- No new dependencies.
- Size: `puzzles.json` is 67 KB for 600 puzzles; it may grow to about 150 KB. No other limit matters (GitHub Pages: 1 GB).
- Existing rules stay: outline and creases required, joins between faces on one plane optional, hidden edges count
  as extra; the fairness rule (front or back picture) from round 3; lives; W×D×H labels.

## Approaches considered

1. **Phases: tools, then slopes, then curves (picked).** Each phase is complete alone. If usage ends after the slopes
   phase, the owner has slopes everywhere in Views and Draw.
2. A separate "Solids" family of modes beside the current ones. Safe, but slopes and curves never reach the main
   levels. Rejected: the owner wants the main path to use them once they appear.
3. Everything at once (new model, all modes, ellipse checker). Rejected: highest risk of a half-done site when usage ends.

Piece size: one-cell-only pieces were offered (simplest model). The owner wants bigger pieces; the catalog below
has pieces up to 3 cells long or 2×2.

Curve drawing: a "cylinder stamp" tool was considered. The owner prefers to draw curves himself: tap 2 points,
then drag a dot to bend the curve. Picked, with snapping (below).

## Pieces (the catalog)

Every piece is **1 cube high**, stands on a **flat area** (all cells under it have the same stack height, 0 or more),
and nothing stands on it. Cells under a piece are part of that piece only.

| Piece | Footprint | Directions |
|---|---|---|
| Ramp | 1×1, 1×2, 1×3 (length along X or Y) | rises toward N, E, S or W, along its length |
| Vertical cylinder | 1×1 or 2×2 | — |
| Roof A: wall + half-round | 1×1 or 1×2 (1 wide) | axis along X or Y |
| Roof B: half-cylinder | 2×1 or 2×2 (2 wide) | axis along X or Y |
| C: curved ramp | 1×1 | the round side faces N, E, S or W |
| D: rounded corner | 1×1 | the round side faces NE, SE, SW or NW |

Shapes (all 1 cube high; the owner saw isometric drawings of A–D on 2026-11-27 and picked all four):
- A ramp of length L rises 1 cube over L cells. Its slanted edges go from grid point to grid point.
- A 1×1 cylinder is the circle inscribed in one cell; a 2×2 cylinder is the circle inscribed in a 2×2 square.
- **A:** a box ½ high, 1 wide, with a half-cylinder of radius ½ on top (axis at height ½). The wall and the curve
  join smoothly: **no line** between them.
- **B:** a half-cylinder of radius 1, axis on the base, 2 wide.
- **C:** a quarter-cylinder of radius 1 with a **horizontal** axis along the top edge of its back side: a curved ramp.
- **D:** a quarter-cylinder of radius 1 with a **vertical** axis at one corner: round when seen from the top.

Priority if usage gets short: drop A first (it needs the extra "smooth join" rule).

## Draw tools (Draw mode and the Views grid)

**Free lines.** Drag from a grid point to any other grid point; the line snaps to both points. This replaces the
one-cell diagonals of round 3 (old drawings with diagonals must still load and erase). The eraser removes a free line
like any line.

**Arc tool.**
1. Tap 2 points. An arc appears between them, in the most likely plane (top, left or right face plane).
2. A dot sits in the middle of the arc. Drag it to bend the arc to the other side or into another plane.
3. The dot snaps to **valid isometric arcs only**: a part of the ellipse that a circle of radius ½ or 1 (in cells)
   makes in one of the 3 face planes. No free shapes.

**Eighth points.** Every circle has 8 special points, one each 45°. They include the points where the circle touches
its square and the widest points of its isometric ellipse (in all 3 planes, by the symmetry of the isometric view).
An arc always starts and ends on eighth points, so it is a run of whole eighths. Arcs are stored as exact keys
(plane, centre, radius, first and last eighth), like line keys.

**Snap points.** Grid dots, plus edge midpoints (needed for radius ½), plus the eighth points of every drawn arc
(so the user can draw the side line of a cylinder or a roof from its widest point). Extra snap points show only while
the line or arc tool is active **(builder's call)**.

**Ends between snap points.** The generator rejects any puzzle in which a visible line or arc would end at a point that
is not a grid dot, an edge midpoint or an eighth point (for example, a line partly hidden behind a cylinder). So every
answer can be drawn with the tools **(builder's call, from the review)**.

**Saves.** Saved drawings and backups store free lines and arcs; the backup version goes up to 4 (round 3 already
uses 3), and old backups still import. Importing a backup below version 4 deletes the old Views 3–6 data, the same
way `version < 3` deletes the round 2 data now (`src/ui/storage.ts`).

## Views pictures and the checker

- The 3 orthographic views show pieces exactly: a ramp is a triangle or a rectangle, a cylinder is a circle from the
  top and a rectangle from the front and side, a roof is a half circle from its end.
- Views show every visible edge, as in technical drawing: also edges with no change of depth, for example where a ramp
  starts on a flat top at the same height **(builder's call, from the review: more puzzles get one solution)**.
  Cube-only puzzles keep their current views.
- Smooth joins get no line, in the views and in the drawing: the wall and curve of roof A, and the curve of C or D
  where it meets a flat face at a tangent.
- Checker in Views: the drawing must contain every outline line, crease and arc of the answer; the vertical side lines
  of cylinders and roofs count as outline. Joins between faces on one plane stay optional. Extra lines or arcs are
  mistakes. Hidden lines and hidden arcs count as extra.
- The answer overlay and the ⟲ back picture draw pieces too.

## Puzzles

**Fairness (round 3 rule, extended).** Every piece, and every cube that a view needs, shows a face in the front or the
back picture. **One solution:** no other shape made from cubes and catalog pieces has the same 3 views.

**Variety (builder's call, from the level 1 feedback).** In one set, two puzzles must differ by at least a few cells
(height or piece). The builder picks the number per size so that the set can still be filled.

**Sets in Views** (list order):

```
1  3×3×2   2  3×4×3                 cubes only, as now (not changed)
Slopes     25 puzzles, 3×3 and 3×4, height up to 3, ramps only
Curves     25 puzzles, 3×3 and 3×4, height up to 3, curves only
3  4×4×3   4  4×5×4   5  5×5×4   6  5×6×5    50 each, cubes + ramps + curves
Endless
```

- Slopes and Curves rows show their size range, e.g. "3×3–3×4" **(builder's call)**.
- Levels 3–6: the number of pieces grows with the level **(builder's call, roughly 1–3 at level 3 up to 2–5 at level 6)**.
- The old cube-only Views puzzles of levels 3–6 leave `puzzles.json`.
- **Save file (owner's requirement):** the update must not corrupt the existing save. It removes only the data of
  the deleted puzzles (their solved ids, drawings and lives). All other data stays exactly as it is: Views levels 1–2,
  Reverse, Nets, Shadows, Endless, Draw drawings, settings. This also holds when an old backup is imported later.
  A test loads a copy of a real round 3 save, runs the update, and checks that only the deleted puzzles' data is gone.
- New ids must not collide with old ones **(builder's call: e.g. `SL-NNN`, `CV-NNN`, `M3-NNN` … `M6-NNN`)**.

All levels stay open, as now.

## Endless (Views)

- Size picker: width 2–6, depth 2–6, height 1–6. With curves on, the maximum is 5×5×5.
- Switches: slopes on/off, curves on/off. Both off gives cube-only puzzles (this replaces the old cube-only levels 3–6).
- Generation runs in the worker. If no puzzle is found in about 10 seconds **(builder's call)**, show a short message
  and offer a smaller size.
- Endless saves its own settings.

## Phases (each one merged and deployed alone)

1. **Tools:** free lines and the arc tool in Draw mode (and in the Views grid). Draw mode works with them; nothing else
   changes yet.
2. **Slopes:** ramps in the shape model, views, solver, fairness rule, checker, answer overlay; the Slopes set;
   endless slopes switch and size picker.
3. **Curves:** cylinders, roofs, quarter-rounds in the same parts; the Curves set; endless curves switch.
4. **New levels 3–6:** generate the mixed sets, remove the old cube-only Views 3–6 and only their save data.

If usage ends early, the order means the finished phases still work.

## Left to the builder

- The shape model's form (for example: height map plus a list of placed pieces).
- The solver's method (pre-made sets are generated once offline with `scripts/generate-puzzles.ts`, so they can be slow;
  Endless must be fast enough on a Pixel 7).
- How the arc tool picks "the most likely plane" and how the drag dot moves between valid arcs.
- Exact key formats for free lines and arcs.
- Fill (paint bucket) behaviour with arcs and free lines (round 3 already skips diagonals).

## Amendment 2026-11-28 (owner)

Phase 4 changes. The old cube-only Views levels 3–6 **stay**, with all their save data. The Views levels screen becomes:

```
Level 1   3×3×2   cubes only (unchanged)
Level 2   3×4×3   cubes only (unchanged)
Slopes    25 puzzles
Curves    25 puzzles
Level 3   4×4×3   ① cubes: the old 50 puzzles, unchanged   ② mixed: 25 new puzzles (cubes + slopes + curves)
Level 4   4×5×4   ① cubes   ② mixed (25)
Level 5   5×5×4   ① cubes   ② mixed (25)
Level 6   5×6×5   ① cubes   ② mixed (25)
Endless
```

No puzzle and no save data is removed, so the save-file rule about deleted puzzles no longer applies to phase 4. Mixed sets get new ids
(builder's call: `M3-NNN` … `M6-NNN`).

## Amendment 2026-11-28 (owner, after trying v4.4)

Endless with slopes repeated the same few shapes (3×3×2 slopes: 11 different shapes in 30 seeds). Owner decisions:

- **Endless is cube-only**, any size 2–6. Sizes that (almost) never find a puzzle with one answer are blocked in the picker;
  slow sizes show the expected time. Estimates come from a PC timing table × 3 for a phone (assumption).
- **Slopes are ready-made only**, three sizes of 25 each: Slopes 1 (3×3–3×4, the old set), Slopes 2 (4×4×3), Slopes 3 (4×5×4).
  A size whose generation takes more than a minute per puzzle is dropped for now.
- **Curves** (phase 3) follow the same model: ready-made sets in several sizes, no Endless.
- **Mixed** stays ready-made only (phase 4, levels 3–5; level 6 later). No mixed Endless.

Levels list (Views): L1, L2, Slopes 1–3, Curves…, L3–L6, Endless. Version 4.5.
