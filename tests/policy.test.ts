import { describe, expect, it } from 'vitest';
import {
  LABELS,
  acceptEvidence,
  acceptResult,
  compare,
  parsePolicy,
  toOverlay,
  type OcrLine,
  type OcrResult,
} from '../src/policy';

const line = (text: string, y = 0): OcrLine => ({
  text: text + '\n',
  bbox: { x0: 10, y0: y, x1: 300, y1: y + 20 },
  words: text.split(' ').map((w, i) => ({ text: w, bbox: { x0: 10 + i * 20, y0: y, x1: 28 + i * 20, y1: y + 20 } })),
});
const res = (...t: string[]): OcrResult => ({ ok: true, width: 400, height: 200, lines: t.map((x, i) => line(x, i * 30)) });
const PHOTO = 'If a damaged return includes a photo, send it to Quality Inspection.';
const NOPHOTO = 'If a damaged return has no photo, send it to the Receiving Supervisor.';

describe('parsePolicy', () => {
  it('captures each route from the line text', () => {
    const o = parsePolicy(res(PHOTO, NOPHOTO), 'V2', 1);
    expect(o['with-photo']).toMatchObject({ kind: 'routed', route: 'Quality Inspection' });
    expect(o['no-photo']).toMatchObject({ kind: 'routed', route: 'Receiving Supervisor' });
    const h = parsePolicy(res('If a  damaged return has no photo, send it to Returns Desk'), 'V1', 1);
    expect(h['no-photo']).toMatchObject({ kind: 'routed', route: 'Returns Desk' });
  });

  it('omits per case', () => {
    const o = parsePolicy(res(PHOTO, 'Other text'), 'V1', 1);
    expect(o['with-photo'].kind).toBe('routed');
    expect(o['no-photo']).toEqual({ kind: 'omitted' });
  });

  it('is unreadable scan-wide when ok is false or lines are empty', () => {
    const bad: OcrResult = { ok: false, width: 1, height: 1, lines: [] };
    for (const r of [bad, { ...bad, ok: true }, res('   ')]) {
      const o = parsePolicy(r, 'V1', 1);
      expect(o['with-photo'].kind).toBe('unreadable');
      expect(o['no-photo'].kind).toBe('unreadable');
    }
    expect(LABELS.omitted).toBe('No route: readable policy omits the rule');
    expect(LABELS.unreadable).toBe('Unreadable / OCR failed');
  });

  it('keeps the exact trimmed line as quote and its boxes as evidence', () => {
    const o = parsePolicy(res(PHOTO), 'V1', 3);
    const o1 = o['with-photo'];
    if (o1.kind !== 'routed') throw new Error('expected routed');
    expect(o1.evidence).toMatchObject({ slot: 'V1', rev: 3, quote: PHOTO, imgW: 400, imgH: 200 });
    expect(o1.evidence.line).toEqual({ x0: 10, y0: 0, x1: 300, y1: 20 });
    expect(o1.evidence.words.length).toBe(PHOTO.split(' ').length);
  });

  it('does no fuzzy fixing', () => {
    const o = parsePolicy(res('If a damaged return has no photo, send it to the Superwvisor.'), 'V1', 1);
    expect(o['no-photo']).toMatchObject({ kind: 'routed', route: 'Superwvisor' });
    const m = parsePolicy(res('If a damaqed return has no photo, send it to the Receiving Supervisor.'), 'V1', 1);
    expect(m['no-photo']).toEqual({ kind: 'omitted' });
  });
});

describe('revision guards', () => {
  it('rejects a late result', () => {
    expect(acceptResult(2, 2)).toBe(true);
    expect(acceptResult(2, 1)).toBe(false);
  });

  it('rejects wrong-revision and wrong-slot evidence', () => {
    const o = parsePolicy(res(PHOTO), 'V1', 1)['with-photo'];
    if (o.kind !== 'routed') throw new Error('expected routed');
    expect(acceptEvidence(o.evidence, 'V1', 1)).toBe(true);
    expect(acceptEvidence(o.evidence, 'V1', 2)).toBe(false);
    expect(acceptEvidence(o.evidence, 'V2', 1)).toBe(false);
  });
});

describe('toOverlay and compare', () => {
  it('maps a box into source-pixel viewBox space', () => {
    expect(toOverlay({ x0: 10, y0: 20, x1: 110, y1: 50 }, 800, 600)).toEqual({
      viewBox: '0 0 800 600',
      x: 10,
      y: 20,
      w: 100,
      h: 30,
    });
  });

  it('compares outcomes', () => {
    const a = parsePolicy(res(PHOTO), 'V1', 1);
    const b = parsePolicy(res(PHOTO, NOPHOTO), 'V2', 1);
    expect(compare(a['with-photo'], b['with-photo'])).toBe('unchanged');
    expect(compare(a['no-photo'], b['no-photo'])).toBe('changed');
    expect(compare(a['no-photo'], { kind: 'omitted' })).toBe('unchanged');
    expect(compare({ kind: 'omitted' }, { kind: 'unreadable' })).toBe('changed');
  });
});
