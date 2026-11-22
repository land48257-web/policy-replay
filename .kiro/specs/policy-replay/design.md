# Design Document

## Overview

Policy Replay is a small TypeScript + Vite single-page app. Two Slots (V1, V2) each hold a scan. A single reused Tesseract.js worker OCRs the scan into structured lines and words. A pure module parses lines with one regex, derives per-case outcomes and evidence, and guards against stale results. The UI compares outcomes and highlights the evidence line through an SVG overlay.

Decisions:

- Three source modules only: `src/main.ts` (UI), `src/policy.ts` (pure), `src/ocr.ts` (adapter). Vanilla TS, no framework.
- All routes come from OCR text. Nothing is hardcoded and file names are never read for logic.
- Staleness is handled by one integer Revision per Slot and by clearing evidence on every selection change.
- Pseudocode below is TypeScript.

## Architecture

```
index.html + src/main.ts ──► src/ocr.ts ──► tesseract.js (one worker, local assets)
          │                        │
          └──────► src/policy.ts ◄─┘   (pure: parse, outcome, evidence, revision, bbox)
public/: v1.png, v2.png, tesseract worker/core/eng.traineddata (copied from node_modules)
tests/fixtures/: heldout.png, blank.png
```

- Vite dev and preview servers bind to `127.0.0.1`.
- Tesseract is configured with `workerPath`, `corePath` and `langPath` pointing at same-origin files under `public/`, and `gzip: false` when the traineddata is stored uncompressed.
- A small local script generates `public/v1.png`, `public/v2.png`, `tests/fixtures/heldout.png` and `blank.png` once. The held-out file uses a different layout, font size and position, and a different render path from V1/V2.

## Components and Interfaces

### src/ocr.ts

```ts
export type OcrLine = { text: string; bbox: Box; words: { text: string; bbox: Box }[] };
export type OcrResult = { ok: boolean; width: number; height: number; lines: OcrLine[] };
export function recognize(image: Blob | Uint8Array | string): Promise<OcrResult>;
```

- Lazily creates one worker and reuses it. Requests run through the worker's own queue.
- Flattens `data.blocks → paragraphs → lines → words` into `OcrLine[]`. Bounds are in original image pixels.
- Any exception, empty text or no lines gives `ok: false`. The adapter never invents text.

### src/policy.ts (pure)

```ts
export type Case = 'with-photo' | 'no-photo';
export type Box = { x0: number; y0: number; x1: number; y1: number };
export type Evidence = { rev: number; slot: SlotId; quote: string; line: Box; words: Box[]; imgW: number; imgH: number };
export type Outcome =
  | { kind: 'routed'; route: string; evidence: Evidence }
  | { kind: 'omitted' }      // "No route: readable policy omits the rule"
  | { kind: 'unreadable' };  // "Unreadable / OCR failed"

export const RULE = /^if a damaged return (includes a photo|has no photo), send it to (?:the )?(.+?)\.?$/i;
export function normalize(s: string): string;                 // trim, collapse whitespace
export function parseLine(line: OcrLine): { case: Case; route: string } | null;
export function parsePolicy(r: OcrResult, slot: SlotId, rev: number): Record<Case, Outcome>;
export function compare(a: Outcome, b: Outcome): 'unchanged' | 'changed';
export function toOverlay(box: Box, imgW: number, imgH: number): { viewBox: string; x: number; y: number; w: number; h: number };
export function acceptResult(current: number, resultRev: number): boolean;
export function acceptEvidence(e: Evidence, slot: SlotId, current: number): boolean;
```

Behavior:

- `parseLine` normalizes case and whitespace, applies `RULE`, maps group 1 to a Case, and returns group 2 as the route (trimmed, leading "the " already dropped by the regex). The quote is the original OCR line text. No fuzzy rescue.
- `parsePolicy`: when `ok` is false, or there are no lines, both Cases are `unreadable`. Otherwise each Case is `routed` from the first matching line, or `omitted`.
- `compare`: `unchanged` when kinds are equal and, for routed, routes are equal; otherwise `changed`. Computed from V1 and V2 outcomes only.
- `toOverlay`: viewBox is `0 0 imgW imgH`, and the box stays in source pixels, so the SVG scales with the displayed image through `preserveAspectRatio`.
- `acceptResult` returns `resultRev === current`. `acceptEvidence` also checks the slot and rev.

### src/main.ts

State (single object): `slots: { V1, V2 }` each `{ rev, outcomes?, image url, size, status }`, plus `view: 'V1' | 'V2'`, `case`, `shown?: Evidence`.

- `loadScan(slot, blob)`: increments `rev`, clears `outcomes` and `shown`, stores the image, runs `recognize`, then applies `parsePolicy` only if `acceptResult(slot.rev, myRev)`.
- Changing case, view or scan sets `shown = undefined`.
- `Show on scan` is a native `<button>` rendered only for routed outcomes. It sets `shown` after `acceptEvidence`. The quote and an overlay `<svg viewBox="0 0 W H">` are drawn over the displayed image. The overlay holds one rectangle for the line and thin rectangles for words.
- Disclosure text states that the app reads simple explicit English if/then routing rules for these cases and that humans can review the source.
- Test hook: file inputs accept uploads, so a harness can replace either slot's scan, including the held-out image.

## Data Models

- `Box`, `OcrLine`, `OcrResult`, `Evidence`, `Outcome` as above.
- Revision: a number per Slot, incremented on each load, held in app state only.

## Error Handling

- Unsupported file type: visible message, current scan and revision unchanged.
- OCR exception or blank image: `unreadable` for both cases of that scan.
- Late result from a replaced scan: dropped by the revision check, with no UI change.
- A missing local asset appears as OCR failure (`unreadable`), never as a network fallback.

## Testing Strategy

- Vitest unit tests (`src/policy.ts`): grammar capture of each route, per-case omission, scan-wide unreadable, revision guard, wrong-Revision evidence rejection, bbox mapping, unchanged comparison.
- Vitest real-OCR tests (Node, same local Tesseract assets): V1, V2, held-out (different layout and Returns Desk route), held-out swapped into either Slot under a renamed file, blank gives unreadable, the with-photo case unchanged.
- Chrome smoke script (`playwright-core`, `executablePath` of the installed Google Chrome): keyboard Show on scan and overlay, stale clearing on view/case/upload, late-OCR ignore, 375px viewport, zero non-loopback requests.
- Results are recorded in `docs/RUNBOOK.md` exactly as run. No property-based testing is used.
