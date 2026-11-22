# Requirements Document

## Introduction

Policy Replay is a small, browser-only tool that dry-runs a written support policy. It OCRs two scans of the same policy (V1 and V2) with local Tesseract.js, parses simple explicit English if/then routing rules, and replays two pinned cases against each scan. For every route it can show the exact recognized line on the scan. No backend, no model service, no third-party runtime requests. This phase produces the spec only.

## Glossary

- **App**: The single-screen TypeScript + Vite application.
- **Slot**: One of exactly two user-visible scan positions, V1 and V2.
- **Scan**: A PNG or JPEG image loaded into a Slot.
- **Case**: A pinned input: `with-photo` (damaged return with a photo) or `no-photo` (damaged return with no photo).
- **Rule_Line**: One normalized (case and whitespace) OCR line matching the Rule_Pattern.
- **Rule_Pattern**: `/^if a damaged return (includes a photo|has no photo), send it to (?:the )?(.+?)\.?$/i`.
- **Outcome**: Per scan and Case, one of Routed, Omitted or Unreadable.
- **Evidence**: The exact recognized line text and its line and word bounding boxes in original image pixels.
- **Revision**: A per-Slot integer incremented on every scan load.

## Requirements

### Requirement 1: Two slots and built-in scans

**User Story:** As a reviewer, I want V1 and V2 scans ready to compare, so that I can see the policy change at once.

#### Acceptance Criteria

1. THE App SHALL show exactly two Slots, V1 and V2, and no third Slot.
2. WHEN the App starts, THE App SHALL offer a one-click load of a built-in original scan for each Slot from static PNGs in `public/`.
3. THE built-in V1 scan SHALL contain exactly "If a damaged return includes a photo, send it to Quality Inspection."
4. THE built-in V2 scan SHALL contain the V1 sentence and exactly "If a damaged return has no photo, send it to the Receiving Supervisor."
5. WHEN the user chooses a PNG or JPEG file for a Slot, THE App SHALL load it into that Slot and reject other file types with a visible message.
6. THE held-out Returns Desk image and a blank image SHALL exist only under `tests/fixtures` and SHALL enter the App only by replacing a Slot's scan through upload or a test harness.
7. THE held-out image SHALL be rendered independently with a different layout and position, and SHALL contain the with-photo sentence and "If a damaged return has no photo, send it to the Returns Desk."

### Requirement 2: Outcomes come only from the image

**User Story:** As a reviewer, I want every route to come from the scanned text, so that I can trust the result.

#### Acceptance Criteria

1. THE App SHALL run real Tesseract.js OCR on each loaded Scan and derive every Outcome only from the recognized lines.
2. THE App SHALL contain no hardcoded routes, quotes, coordinates or fallback outcomes, and file names SHALL NOT influence Outcomes.
3. WHEN a recognized line, after case and whitespace normalization, matches the Rule_Pattern, THE App SHALL create a Rule_Line for the Case named in capture group 1.
4. THE App SHALL capture the destination from the matching line, trim it, drop a leading "the ", and display it as recognized (for example "Quality Inspection", "Receiving Supervisor", "Returns Desk").
5. THE App SHALL NOT use fuzzy matching, spell correction or any other rescue of near-matching lines.
6. THE App SHALL preserve the exact recognized line text and its bounds as Evidence.

### Requirement 3: Omitted versus unreadable

**User Story:** As a reviewer, I want a missing rule to look different from a failed scan, so that I do not misread either.

#### Acceptance Criteria

1. WHEN OCR succeeds with text but no Rule_Line exists for a Case, THE App SHALL show for that scan and Case "No route: readable policy omits the rule".
2. WHEN OCR fails or the scan is blank or unreadable, THE App SHALL show "Unreadable / OCR failed" for both Cases of that scan.
3. WHEN the V1 scan is processed, THE App SHALL route `with-photo` to Quality Inspection and mark `no-photo` as omitted.
4. WHILE an Outcome is Omitted or Unreadable, THE App SHALL assign no route and SHALL NOT show a Show on scan control for it.

### Requirement 4: Comparison

**User Story:** As a reviewer, I want V1 and V2 side by side per case, so that I can see what changed.

#### Acceptance Criteria

1. THE App SHALL show, for each Case, the V1 Outcome, the V2 Outcome and a comparison status computed by comparing those two Outcomes.
2. WHEN V1 and V2 Outcomes for a Case are equal in kind and route, THE App SHALL label the Case "unchanged"; otherwise it SHALL label it "changed".
3. THE App SHALL disclose on screen that it reads simple explicit English if/then routing rules for these cases and that humans can review the source scan.

### Requirement 5: Show on scan evidence

**User Story:** As a reviewer, I want to see the source line behind a route, so that I can verify it.

#### Acceptance Criteria

1. WHILE an Outcome is Routed, THE App SHALL offer a native, keyboard-accessible "Show on scan" button for it.
2. WHEN the button is activated, THE App SHALL display the exact recognized quote and highlight its line on the displayed scan.
3. THE highlight SHALL be an SVG overlay whose viewBox is in original source image pixel coordinates, using line and word bounding boxes from Tesseract.js structured blocks.
4. THE overlay SHALL stay aligned with the scan at any displayed size.

### Requirement 6: Stale state safety

**User Story:** As a reviewer, I want no outdated evidence on screen, so that quotes always match the visible scan.

#### Acceptance Criteria

1. WHEN the Case, the source view (V1 or V2) or a Slot's scan changes, THE App SHALL clear any shown quote and highlight immediately.
2. WHEN a scan is loaded into a Slot, THE App SHALL increment that Slot's Revision.
3. WHEN an OCR result arrives, THE App SHALL apply it only if its Revision equals the Slot's current Revision, and SHALL ignore it otherwise.
4. THE App SHALL reject Evidence whose Revision differs from the Slot's current Revision.

### Requirement 7: OCR and network

**User Story:** As an operator, I want OCR to run fully locally, so that scans never leave the machine.

#### Acceptance Criteria

1. THE App SHALL use one reused Tesseract.js worker that returns structured blocks, lines and words with bounding boxes.
2. THE App SHALL serve the Tesseract.js worker, core and English traineddata locally from installed npm packages.
3. THE App SHALL make zero non-loopback network requests at runtime.
4. THE App SHALL have no backend and SHALL call no model or external inference service.

### Requirement 8: Presentation

**User Story:** As a reviewer, I want a clear single screen, so that I can use it on any device.

#### Acceptance Criteria

1. THE App SHALL present one polished screen with legible scan captions and comparison status.
2. THE layout SHALL remain usable at a viewport width of about 375px without horizontal page scroll.

### Requirement 9: Engineering constraints

**User Story:** As a maintainer, I want a small codebase, so that it is easy to review.

#### Acceptance Criteria

1. THE project SHALL be TypeScript + Vite, with a dev server bound to 127.0.0.1 only.
2. THE source SHALL consist of `src/main.ts` with `index.html` and CSS, a pure `src/policy.ts`, and `src/ocr.ts`, and no other source modules.
3. THE project SHALL use project-local npm packages with a lockfile from https://registry.npmjs.org: vite, typescript, tesseract.js, @tesseract.js-data/eng, vitest and playwright-core.
4. THE project SHALL NOT download a browser binary, install globally, push, deploy or touch other directories.

### Requirement 10: Verification

**User Story:** As a maintainer, I want honest verification, so that I know what was actually checked.

#### Acceptance Criteria

1. THE project SHALL include Vitest unit tests for `src/policy.ts` covering grammar capture, per-case omission, scan-wide unreadable, the revision guard, wrong-Revision Evidence rejection, bounding-box mapping and unchanged comparison.
2. THE project SHALL include Vitest real-OCR Node tests on V1, V2, held-out (different layout and route), held-out swapped into either Slot under a renamed file, blank (Unreadable) and the unchanged with-photo Case.
3. THE project SHALL include a Chrome smoke script using playwright-core with the installed Google Chrome covering keyboard Show on scan with overlay, stale clearing on switch, Case and upload, late-OCR ignore, a 375px viewport and zero non-loopback requests.
4. THE project SHALL record commands and actual results in `docs/RUNBOOK.md` and SHALL NOT claim any check that was not run.
