# Policy Replay runbook

Browser-only tool that OCRs two policy scans (V1, V2) with local Tesseract.js and replays two pinned cases (damaged return with a photo, damaged return without a photo) against each. There is no backend or external OCR service. Scan contents never leave the browser. The static build can be served from a directory such as a GitHub Pages project path.

## Prerequisites

- Node v26.10.0 and npm 11.19.1 (the versions present when this was verified).
- An already-installed Google Chrome (originally verified with version 157.0.8103.79). The smoke and fixture scripts use Chrome through playwright-core; set CHROME_PATH to the installed executable only if auto-detection fails. No browser is downloaded.
- npm dependencies come from https://registry.npmjs.org and are pinned by `package-lock.json`: vite, typescript, tesseract.js, @tesseract.js-data/eng, vitest, playwright-core. `npm install` runs `prepare:ocr`, which copies the Tesseract worker, core and English data into `public/tesseract/`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies and copy the local OCR assets |
| `npm run render:scans` | Re-render `public/v1.png`, `public/v2.png`, `tests/fixtures/heldout.png`, `tests/fixtures/blank.png` |
| `npm run ocr:check` | Run OCR over the scans from Node and print the lines |
| `npm test` | Vitest: policy unit tests and real-OCR tests |
| `npm run build` | Vite production build (does not type-check) into `dist/` |
| `npm run dev` | Dev server at http://127.0.0.1:5173 |
| `npm run smoke` | Chrome smoke test against `dist/` served on http://127.0.0.1:4173/policy-replay/ (run `npm run build` first). Writes `test-results/wide.png` and `test-results/narrow.png` |

## Grammar disclosure

The app reads only simple, explicit English routing rules, one per OCR line, of the form
`If a damaged return includes a photo|has no photo, send it to [the] <destination>.`
(case and whitespace are normalized). Anything else gives no route. There is no fuzzy matching or spell correction. The source scan is always shown so a person can review it.

## Known limits

- Only the two pinned cases and this one sentence shape are understood. Rules split across lines, conditions in other wording, or misrecognized words yield "No route" for that case.
- OCR quality depends on the image. A misread rule is not rescued; a blank or unreadable image shows "Unreadable / OCR failed" for both cases.
- The first rule line found per case wins.
- The first OCR in a page load is slower because the worker and WASM core load once.
- PNG and JPEG only. Smoke coverage is Chrome only, at 1280x900 and 375x812.
- `window.__policyReplay.snapshot()` is a read-only hook used by the smoke test.

## What the fixtures prove

- `tests/fixtures/heldout.png` is rendered with a different layout and position, with the destination "Returns Desk". Loading it under a misleading file name (`v2.png`) into either slot yields Returns Desk. Routes come from the pixels, not from file names, slots or built-in text.
- `tests/fixtures/blank.png` has no text and yields Unreadable for both cases, with no Show on scan control.
- Neither fixture is served by the app; they enter only through upload or tests.

## Original prototype verification record

Date: 2026-11-21. Machine: macOS, Node v26.10.0, npm 11.19.1, Chrome 157.0.8103.79.

| Command | Result |
| --- | --- |
| `npm test` | exit 0; 2 test files passed, 15 tests passed |
| `npm run build` | exit 0; 29 modules transformed; `dist/index.html`, one CSS, one JS (26.64 kB) |
| `npm run smoke` | exit 0; `SMOKE OK` |

Smoke output (all lines from the run):

```
PASS a. built-in examples: outcomes and comparison
PASS b. keyboard Show on scan: exact quote and aligned overlay
PASS c. stale clearing on view, case and upload
PASS d. held-out under a misleading name, swapped into V2 then V1
PASS e. late OCR result is ignored
PASS f. unsupported file shows error and keeps scan state
PASS g. 375px viewport: no horizontal scroll, status visible
  (23 requests, all http://127.0.0.1:4173/ / data: / blob:)
PASS h. zero non-loopback requests
PASS i. no uncaught page errors
SMOKE OK
```

Not run in this verification: `npm install` (dependencies were already installed), `npm run render:scans`, `npm run ocr:check`, `npm run dev`, and the standalone `tsc --noEmit` (`vite build` does not type-check). Built-in Kiro Correctness was not run. No other browsers or devices were tested.
