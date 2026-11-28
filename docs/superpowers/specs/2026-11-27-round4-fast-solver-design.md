# Round 4 — fast solver (design, 2026-11-27)

Decided with the owner in chat on 2026-11-27. Lines marked **(builder's call)** are proposals the owner did not decide.

## Intent

Round 4 wants harder Views puzzles with slopes and curves. Each puzzle must have exactly one answer, and the solver that
checks this (`countShapeSolutions`, `src/core/rampSolver.ts`) is too slow above 3×3. The owner's plan (2026-11-27):

- Do not chase Endless on the phone. Make **ready puzzles on the PC** instead; Endless stays as it is (cubes up to 6,
  slopes up to 3×3×2).
- Slopes and curves must both be able to appear in the new levels 3–6. So the order is: **this step** (fast solver,
  built so new piece types plug in) → **phase 3** (curves, in the same solver) → **phase 4** (levels 3–6 made once,
  with cubes, slopes and curves). Levels 3–6 are made only once, so the owner's progress on them is not reset twice.

## What was measured (2026-11-27, PC)

- One solver run: 3×3 0.4–2 s, 3×4 0.9–25 s; a 4×4 run did not finish.
- 3×3/3×4: 6,000–70,000 search steps per run; about 1 step in 5 passes the cheap top-view check, and each step that
  goes on to the per-cell check costs about 250 µs, nearly all in the general hidden-line sketch (`sketch.ts`, float
  sampling, point-in-polygon).
- So both matter: the cost per step (big gain available) and the number of steps (grows fast with size).

## Goals

1. A solver that gives **the same count** as today's solver on every shape (cubes and ramps), and is fast enough to
   make the phase 4 sets on the PC: 50 puzzles per level at 4×4×3, 4×5×4, 5×5×4 and 5×6×5, cubes + ramps, each
   level in **under 2 hours with 8 workers** **(builder's call)**.
2. **Piece types plug in:** a cube stack and a ramp are two piece types; phase 3 adds cylinders, roofs and
   quarter-rounds without changing the search.
3. Side gain, not a goal: raise the Endless Slopes limit to the largest size whose median generation stays at or under
   3 s on the PC (the phase 2b rule). If height 3 passes, Endless gets it back.

## Non-goals

- No change to what a puzzle is, to the views, the checker, the iso picture, or the fairness rule.
- No new puzzle sets in this step (the Slopes set stays; levels 3–6 come in phase 4).
- No native code or WebAssembly: measured gain 2–3× at best, while the method gives far more.
- No curves yet; only the slot for them.

## Anti-goals (a failure even if it works)

- The new solver finds a different count than the old one on any shape: a puzzle could ship with two answers.
- The new view lines differ from `shapeViews` in any key, including the `#p` (partly hidden) marks.
- Floating-point rounding decides a line. All new checks stay exact (whole numbers or exact fractions).

## Approaches

- **A. Exact view lines, same search (chosen first).** Replace the general sketch inside the solver with exact
  whole-number code that lists the front, side and top view lines of cubes and ramps (straight lines at a few fixed
  slopes), and update them cell by cell instead of drawing the whole part again. Same search order and checks as today,
  so the risk is low and the old solver is a direct reference. Expected: much cheaper steps; the step count stays.
- **B. Column first (only if A misses the 2-hour target).** For each column, list every content (heights and ramps)
  that matches that column's slab of the front view; then join columns, checking the top and side views. Far fewer steps
  at large sizes, more new code and more risk (ramps that cross columns).
- **C. Native code / WebAssembly (rejected).** 2–3× at most; each extra cell multiplies the work, so it moves the
  limit by about one cell.
- **D. A general constraint solver library (rejected).** A new dependency, and the views are line sets with hidden-line
  rules, which are hard to state exactly for such a library.

The owner handed the how to the builder; A then (if needed) B is the builder's pick.

## The parts decided

- **Reference stays.** Today's `countShapeSolutions` and `shapeViews` stay in the code as the reference. The new solver
  replaces them in the generators only after the checks below pass.
- **Checks before the switch (builder's call on counts):**
  1. New view lines equal `shapeViews` (all 3 views, all keys) on every cube-and-ramp shape up to 2×2×2 (all of them),
     and on at least 20,000 random valid shapes up to 5×6×5.
  2. New solver count equals the old count (limit 2) on the existing brute-force 2×2 test, on every Slopes puzzle,
     and on at least 300 random fair candidates at 3×3 and 3×4 (a slow test, run on demand, not in `npm test`).
  3. Every solution the new solver reports really has the target views (checked with `shapeViews`).
- **Ground truth is brute force (builder's call).** Where brute force can run (every cube-and-ramp shape at 2×2 up
  to height 3, 2×3 and 3×3 up to height 2), its count is the truth; the old solver is a second reference, not the
  truth (its own history shows it once missed solutions). On any mismatch, brute force decides which solver is wrong,
  and that one is fixed before the switch. If the old solver turns out wrong, every Slopes puzzle (SL-001…025) is
  re-checked with the new solver and brute force where possible; a puzzle with two answers is replaced, and only its
  save data is removed (tell the owner).
- **Piece type slot (builder's call on the exact shape):** a piece type says which cells it covers and on what base,
  its faces for the general sketch (the iso picture and the reference), and its exact view keys in each view. Keys are strings, so phase 3 can add arc keys (a cylinder is a circle from
  above, a quarter-round an arc from the side; phase 1 already has exact arc keys with √2 parts). Cubes and ramps are
  the first two. The search asks the piece types for the choices at a cell.
- **Measure, then decide B (builder's call on the details).** After A, time the solver at each phase 4 size on
  candidates shaped like phase 4's: stair shapes as in the Slopes set, ramps of length 1–3, about 1–3 pieces at level 3
  up to 2–5 at level 6 (round 4 design). The 2-hour budget is the wall time for one level's 50 accepted puzzles on 8
  workers, counting every candidate tried, including the ones rejected as unfair or with two answers. If a level would
  take longer, build B, with the same checks.
- **Time limit per run (builder's call).** For generation only, a solver run may stop after a step budget and report
  "gave up". "Gave up" never counts as one answer; that candidate is dropped.
- **Endless.** After the switch, re-run the phase 2b timing table; raise `SLOPES_MAX`/`SLOPES_H` only where the median
  is ≤ 3 s. Bump the version on deploy (owner's rule).

## Left to the builder

- The data layout for exact view lines and how they update cell by cell.
- How partly hidden lines (`#p`) are found exactly (fair targets never have them, but the solver must still reject
  shapes that make them).
- Whether the fairness check (`fairShape`) also gets the exact code (it is cheap today; only if it shows up in timing).

## Measured at phase 4 sizes (2026-11-28, Ryzen 5 5600H laptop)

`npx tsx scripts/time-solver.ts <cols> <rows> <maxH> <minPieces> <maxPieces> <seconds> [budget]`. All 4 sizes ran **at the
same time (4 jobs running)**, one process each, nothing else running, so each time is a bit slower than a lone run.
Owner decision: 25 puzzles per level (the 50 column is for reference).
Projection: hours for N = (wall seconds ÷ accepted) × N ÷ 8 ÷ 3600; accepted = fair, not partial, solveShapes count 1,
not gave up. Wall includes the last solve, which can run past the 10 minutes. Samples are tiny (1 accepted) outside 4×4×3.

**No budget, 10 minutes asked:**

| size | pieces | wall s | tried | fair | unique (accepted) | gave up | median solve | p95 solve | h for 25 | h for 50 |
|---|---|---|---|---|---|---|---|---|---|---|
| 4×4×3 | 1–3 | 600 | 752 | 199 | 127 | 0 | 0.19 s | 11.5 s | 0.00 | 0.01 |
| 4×5×4 | 2–4 | 647 | 92 | 6 | 1 | 0 | 130 s | 172 s | 0.56 | 1.12 |
| 5×5×4 | 2–4 | 1032 | 34 | 2 | 1 | 0 | 1029 s | 1029 s | 0.90 | 1.79 |
| 5×6×5 | 2–5 | not finished | | | 0 | | > 39 min in one solve | | > 2.0 | > 4.0 |

5×6×5: after 39 minutes a single solve was still running (killed), so 0 accepted; the lower bound (39 min × 25 ÷ 8 ÷ 3600)
is already over 2 hours. Longest single solve at 4×4×3: 256 s.

**Budget rerun (2 000 000 steps, 5 minutes asked, 4 jobs in parallel):**

| size | wall s | tried | fair | accepted | gave up | median | p95 | h for 25 | h for 50 |
|---|---|---|---|---|---|---|---|---|---|
| 4×4×3 | 309 | 614 | 179 | 127 | 0 | 0.20 s | 7.7 s | 0.00 | 0.00 |
| 4×5×4 | 548 | 70 | 3 | 1 | 2 | 261 s | 273 s | 0.48 | 0.95 |
| 5×5×4 | 469 | 30 | 4 | 1 | 1 | 66 s | 355 s | 0.41 | 0.81 |
| 5×6×5 | 622 | 43 | 1 | 0 | 1 | 621 s | 621 s | > 0.54 | > 1.08 |

**Finding.** The fast solver is far inside the limit at 4×4×3 only. At 4×5×4 and 5×5×4 the numbers rest on one accepted
puzzle each and on a handful of slow solves (minutes each; most fair candidates cost minutes), so they are only
rough. 5×6×5 is over 2 hours without a budget (one solve alone ran more than 39 minutes). The 2 000 000-step budget does
not bound time: a step is expensive on the big shapes, and one gave-up solve still took 621 s. Per the ruling,
column-first (approach B) is **not started here**; it needs its own plan. The budget would have to be much smaller
(and then measured again), but fair candidates are also rare at the big sizes (1 in 43 to 1 in 15 tried), so the
slow solves, not the budget, are the problem.
