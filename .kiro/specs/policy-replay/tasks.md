# Implementation Plan: Policy Replay

## Overview

Four tasks build the app in order: project and assets, OCR with pure policy logic, the one-screen UI, then tests, build and runbook. Language: TypeScript.

## Tasks

- [x] 1. Project setup, sample scans and local OCR assets
  - Create `package.json`, `tsconfig.json` and `vite.config.ts` with the dev and preview servers bound to 127.0.0.1.
  - Install vite, typescript, tesseract.js, @tesseract.js-data/eng, vitest and playwright-core from https://registry.npmjs.org with a lockfile. Download no browser.
  - Write one small local script that renders `public/v1.png`, `public/v2.png`, `tests/fixtures/heldout.png` (different layout and position) and `tests/fixtures/blank.png`.
  - Copy the Tesseract worker, core and English traineddata from node_modules into `public/` for same-origin serving.
  - _Requirements: 1.2, 1.3, 1.4, 1.6, 1.7, 7.2, 9.1, 9.3, 9.4_
  - Verify: `npm install && npx tsc --noEmit`

- [x] 2. Structured OCR, parsing and revision-safe evidence
  - Implement `src/ocr.ts` with one reused worker, local asset paths and flattened lines and words with bounding boxes.
  - Implement pure `src/policy.ts`: `RULE`, `parseLine`, `parsePolicy`, `compare`, `toOverlay`, `acceptResult`, `acceptEvidence`.
  - Write Vitest unit tests for grammar capture, per-case omission, scan-wide unreadable, revision guard, wrong-Revision evidence rejection, bbox mapping and unchanged comparison.
  - Write Vitest real-OCR tests for V1, V2, held-out, held-out swapped into either Slot under a renamed file, blank as unreadable, and the unchanged with-photo case.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 4.2, 5.3, 6.3, 6.4, 7.1, 9.2, 10.1, 10.2_
  - Verify: `npx vitest run`

- [x] 3. One-screen comparison UI
  - Build `index.html`, CSS and `src/main.ts` with slots V1 and V2, one-click built-in loads, file upload with type check, case selection and source view.
  - Show per-slot outcomes, the comparison status, the on-screen disclosure and the omitted or unreadable labels without a route or Show on scan.
  - Add the native Show on scan button, the exact quote and the SVG overlay with a source-pixel viewBox.
  - Clear quote and highlight on any case, view or scan change. Add the per-slot revision guard for late OCR results.
  - Make the layout work at about 375px with legible captions and status.
  - _Requirements: 1.1, 1.2, 1.5, 1.6, 3.4, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 7.3, 7.4, 8.1, 8.2_
  - Verify: `npx tsc --noEmit && npx vite build`

- [x] 4. Tests, build and runbook
  - Add a Chrome smoke script using playwright-core with the installed Chrome channel. It covers keyboard Show on scan and overlay, stale clearing on switch, case and upload, late-OCR ignore, a 375px viewport and zero non-loopback requests.
  - Add npm scripts for test, build and smoke.
  - Run `vitest`, `vite build` and the smoke script. Fix failures.
  - Write `docs/RUNBOOK.md` with the commands and the results actually obtained. Claim nothing that was not run.
  - _Requirements: 6.1, 6.3, 7.3, 8.2, 10.1, 10.2, 10.3, 10.4_
  - Verify: `npx vitest run && npx vite build && npm run smoke`

## Notes

- No task is optional. Do not add property-based tests, fast-check, tsx or extra source modules.
- Each task lists a local verification command.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3"] },
    { "id": 3, "tasks": ["4"] }
  ]
}
```
