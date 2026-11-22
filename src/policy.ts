// Pure policy logic: no DOM, network or OCR imports.
export type Box = { x0: number; y0: number; x1: number; y1: number };
export type OcrWord = { text: string; bbox: Box };
export type OcrLine = { text: string; bbox: Box; words: OcrWord[] };
export type OcrResult = { ok: boolean; width: number; height: number; lines: OcrLine[] };
export type SlotId = 'V1' | 'V2';
export type Case = 'with-photo' | 'no-photo';
export type Evidence = {
  slot: SlotId;
  rev: number;
  quote: string;
  line: Box;
  words: Box[];
  imgW: number;
  imgH: number;
};
export type Outcome =
  | { kind: 'routed'; route: string; evidence: Evidence }
  | { kind: 'omitted' }
  | { kind: 'unreadable' };

export const RULE = /^if a damaged return (includes a photo|has no photo), send it to (?:the )?(.+?)\.?$/i;

export const LABELS = {
  omitted: 'No route: readable policy omits the rule',
  unreadable: 'Unreadable / OCR failed',
} as const;

export const CASES: Case[] = ['with-photo', 'no-photo'];

export function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function parseLine(line: OcrLine): { case: Case; route: string } | null {
  const m = RULE.exec(normalize(line.text));
  if (!m) return null;
  const route = m[2].trim();
  if (!route) return null;
  return { case: m[1].toLowerCase() === 'includes a photo' ? 'with-photo' : 'no-photo', route };
}

export function parsePolicy(r: OcrResult, slot: SlotId, rev: number): Record<Case, Outcome> {
  const lines = r.lines.filter((l) => normalize(l.text) !== '');
  if (!r.ok || lines.length === 0) {
    return { 'with-photo': { kind: 'unreadable' }, 'no-photo': { kind: 'unreadable' } };
  }
  const out: Record<Case, Outcome> = { 'with-photo': { kind: 'omitted' }, 'no-photo': { kind: 'omitted' } };
  for (const line of lines) {
    const p = parseLine(line);
    if (!p || out[p.case].kind === 'routed') continue;
    out[p.case] = {
      kind: 'routed',
      route: p.route,
      evidence: {
        slot,
        rev,
        quote: line.text.trim(),
        line: line.bbox,
        words: line.words.map((w) => w.bbox),
        imgW: r.width,
        imgH: r.height,
      },
    };
  }
  return out;
}

export function compare(a: Outcome, b: Outcome): 'unchanged' | 'changed' {
  if (a.kind !== b.kind) return 'changed';
  if (a.kind === 'routed' && b.kind === 'routed') return a.route === b.route ? 'unchanged' : 'changed';
  return 'unchanged';
}

export function toOverlay(box: Box, imgW: number, imgH: number) {
  return { viewBox: `0 0 ${imgW} ${imgH}`, x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0 };
}

export function acceptResult(current: number, resultRev: number): boolean {
  return resultRev === current;
}

export function acceptEvidence(e: Evidence, slot: SlotId, current: number): boolean {
  return e.slot === slot && e.rev === current;
}
