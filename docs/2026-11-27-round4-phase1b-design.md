# Round 4 phase 1b — fill, line dots, cylinder drag (design, 2026-11-27)

Owner feedback on phase 1 (2026-11-27), approved in chat the same day. Lines marked **(builder's call)** were not
decided by the owner.

## Intent

Phase 1 tools must be usable for slopes and curves in Draw: fill must work with them, circles must start on lines
the owner already drew, and a cylinder must not need two circles drawn by hand.

## Decisions

1. **Version:** About shows 4.0 since `a3e5d6e`; after this phase, 4.1.
2. **Line feel:** no change (owner: "line feel is ok").
3. **Grid look:** no change. Fix A (`8179f5a`) removed the midpoint dots; Draw and Views grids are pixel-identical to
   the pre-round-4 build. Snap points must always match what the grid shows.
4. **Fill:** the paint bucket fills exactly the closed area around the tap, bounded by every drawn line and arc.
   Not closed: nothing is filled (as now). Draw and Views. Old triangle fills stay, render and erase as before.
5. **Dots on drawn lines:** while Line or Arc is active, the middle of every drawn line piece is a snap point and
   shows a dot. Only drawn lines get them **(builder's call; the owner did not object)**.
6. **Cylinder drag:** while Arc is active, a dot shows at the centre of every drawn circle (mid-cell for radius ½).
   Dragging from it moves a copy of that circle's drawn arcs straight out of the circle's plane, whole cells at a time.
   On release the copy and the 2 side lines (at the ellipse's widest points, where drawn) are added in one undo step.
   A centre dot that is tapped without moving is a normal arc tap.

## Approaches for fill (owner left the how to the builder)

- **Exact areas (picked):** find the face of all drawn lines and arc pieces (arcs as their 6-step polylines) that
  holds the tap; save it as a polygon in screen units. Clean at any zoom and in the SVG export.
  Known limit: an island inside the area is coloured too; a later fill of the island draws on top
  **(builder's call, shortcut)**.
- Pixel flood fill: blurry at zoom, SVG export would hold a bitmap. Rejected.
- Finer triangles: curves still leak. Rejected.

## Fill rules (builder's call)

- A new fill removes earlier areas that are the same face (same tap face: equal area within 1e-6 and holding the
  tap point) and old triangle fills whose centre lies in the new polygon, so recolouring works.
- Eraser tap with no line near: removes the last-drawn area holding the point; else the old triangle unfill.
- Areas are stored in `Drawing.areas` as `{ pts: [u, v][], c }` with 4 decimals. Backups with or without `areas`
  import (backup version stays 3).

## Non-goals

- No holes in filled areas. No change to the checker (fills are never checked). No change to Shadows.
