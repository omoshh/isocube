# Task 1 report — Slopes size sets

## What changed
- `src/core/solid.ts`: `turnShape` (quarter turn, floor becomes rows×cols, ramp dirs turned) and `mirrorShape` (left/right).
- `src/core/generator.ts`: `slopeCandidate(..., budget?)` passes a solver step budget (gave up = null); `pickVaried(items, shape, n)` keeps shapeDistance ≥ 3 against each picked shape and all 8 turned/mirrored copies (copies with a turned floor only meet shapes of that floor size, so a 5×4 that is a turned 4×5 counts as a copy — a little stricter than the plan).
- `scripts/gen-slopes.ts`: optional size `4x4x3` (SL2, level 2, maxH 3) or `4x5x4` (SL3, level 3, maxH 4, 4×5 or 5×4 at random), budget 2e6 steps. Old call form unchanged. Merge replaces only the target set level and appends; other entries untouched. Worker prints s per found.
- Levels (Views): tiles "Slopes 1/2/3" (3×3–3×4, 4×4×3, 4×5×4) after level 2, empty ones hidden, `data-slopes="N"`. "Last played" = tile holding the last puzzle route; fallback to level number only when the route is not a puzzle (Endless).
- Puzzle title "Slopes N" (level 0 → 1).

## Tests
New: turnShape/mirrorShape, pickVaried on a hand-made list, three tiles/hidden/last highlight, title. Full suite 367 passed, 6 skipped; tsc OK; build OK. `slopeCandidateUnchanged` green.

## Measured (1 worker, short run)
- 4x4x3: 24 found in 50 s, about 2 s per found candidate.
- 4x5x4: 3 found in 55 s, about 18 s per found candidate.

## Concerns
- Variety at 4x4x3 is the bottleneck: of 24 found, only 10 distinct height maps and 8 pass variety (also 8 without the turned copies). Stair shapes saturate at maxH 3 on 4×4. 25 varied may need many hundreds of candidates or may not be reachable; check `merge` output early.
- Home "Continue" label for an SL2 puzzle reads "Views, level 2, puzzle N" (same as Level 2). Not changed.
- Re-merging the old set now moves SL entries to the end of the file (not needed; do not re-run it).
