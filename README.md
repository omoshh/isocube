# Isocube

A personal isometric-drawing puzzle app (installable PWA): read three views and draw the cube stack, reverse puzzles, nets, free drawing. Built for my own use.

Site: https://omoshh.github.io/isocube/

## Run

    npm install
    npm run dev

## Test

    npm test          # unit tests (Vitest)
    npm run e2e       # Playwright smoke test; first run: npx playwright install chromium

## Regenerate puzzles

    npm run gen

Then commit `public/puzzles.json`.

## Deploy

Push to `main`; GitHub Actions tests, builds and deploys. First time only: Settings -> Pages -> Source: GitHub Actions.
