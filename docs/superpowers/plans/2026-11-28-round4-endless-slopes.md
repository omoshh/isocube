# Round 4 — Endless cubes only, Slopes sizes, Endless time warning (v4.5)

Owner feedback 2026-11-28 (v4.4): Endless with slopes "basically generates the same two figures again" (measured: 3x3x2s gives 11 different shapes in 30 seeds, one shape 7 times; cubes give 29-30 of 30). Owner decisions:
- Endless is cube-only, any size 2-6. Slopes and curves get only ready-made levels in several sizes. Mixed is ready-made only (phase 4, unchanged).
- Slopes sizes: current 3×3–3×4 set + 4×4×3 + 4×5×4, 25 puzzles each ("good enough").
- Endless sizes that never find a puzzle are blocked; slow sizes show a warning such as "Finding a puzzle with one answer takes about X".

Heat rules (all tasks): vitest only with `--maxWorkers=3`, one test process at a time; long runs ≤ 4 jobs under `systemd-inhibit`; watch CPU temperature (`sensors`), pause at ≥ 99 °C for 1 min or ≥ 95 °C for 5 min. Brute force / old solver are ground truth; do not change shipped puzzles (all 625 entries in public/puzzles.json stay byte-identical except new entries appended).

## Task 1 — Slopes size sets (generator + UI)
- `scripts/gen-slopes.ts`: add a size argument so a worker can make 4×4×3 and 4×5×4 candidates (`slopeCandidate(cols, rows, maxH, r)`; for 4×5 pick 4×5 or 5×4 at random like `makeSlopeCandidate` does). Keep the existing 3×3/3×4 mode and its seeds unchanged. Use `solveShapes` with a step budget in these big sizes so one candidate cannot run for minutes (gave-up = reject). `merge` gets the target set: ids `SL2-NNN` (level 2, 4×4×3) and `SL3-NNN` (level 3, 4×5×4), set `slopes`; existing `SL-NNN` (level 0) stay byte-identical. Variety: `shapeDistance ≥ 3` against every picked puzzle AND against its turned/mirrored copies (all 8 for square floors; for 4×5 only the ones that keep the floor size), so no puzzle is a turned copy of another.
- Levels screen (Views): three Slopes tiles right after level 2, named "Slopes 1/2/3" with sizes `3×3–3×4`, `4×4×3`, `4×5×4`; a tile is hidden when its set is empty. The "last played" highlight matches the tile that holds the last puzzle id (route), not only the level number, so set+level pairs do not collide (also needed for phase 4 mixed sets).
- viewsPuzzle title for slopes: "Slopes N" by set level (0 → 1). Next goes to the next puzzle of the same set and level (already so).
- Tests first: generator merge picks no turned copies (unit test on a small hand-made list), levels screen shows the three tiles only when present, last-played highlight on the right tile, title. Fixture `slopeCandidateUnchanged` must stay green.
- Generation itself is run by the controller (not the implementer): 4 jobs, both sizes, then merge.

## Task 2 — Endless cubes only
- Remove slopes from Endless: `EndlessSpec` has no `slopes`; `parseSpec` accepts only `^[2-6]x[2-6]x[1-6]$` (an old `…s` route shows "Puzzle not found"); `clampSpec`, picker (no Slopes switch), router, `sizeSub`, worker, `makeEndless` lose the slopes branch; delete `SLOPES_MAX/SLOPES_H/SLOPES_AREA/slopesSideMax`. `loadEndlessSpec`: a saved spec with slopes true becomes the same cube size (clamped).
- Keep `slopeCandidate` (used by gen-slopes). Delete only what is now unused.
- Tests updated first (picker, parseSpec, router, storage).

## Task 3 — Endless time estimate, block and warning
- `scripts/time-endless.ts`: for every cube size cols 2-6 × rows 2-6 × maxH 1-6, time `makeEndless` on seeds 1..N (N = 7) on the PC with a per-seed wall limit of 30 s (run each size in a child process or worker so a stuck seed can be killed); record median and how many seeds hit the limit. 4 jobs at once. Output a table into `src/core/endlessTimes.ts`: `ENDLESS_MEDIAN_MS[key]` (PC median; 'never' when ≥ half the seeds hit the limit).
- Phone estimate = PC median × 3 (stated assumption, one constant).
- Picker: under the steppers, when the phone estimate ≥ 5 s, show "Finding a puzzle with one answer takes about <X>" (X rounded: "10 s", "1 min"); when the estimate is over `GIVE_UP_MS` or 'never', Start is disabled and the text says the size almost never has a puzzle with one answer, choose a smaller size. Text has `aria-live="polite"`.
- Router: a blocked spec route still loads (old links) but the 60 s give-up stays as the safety net.
- Tests first: the estimate formatter, the picker block/warn states with a fake table.

## Task 4 — Version 4.5, docs
- `package.json` version 4.5.0; design doc amendment in `docs/2026-11-27-round4-design.md` (Endless cube-only; Slopes sizes; curves ready-made only).
