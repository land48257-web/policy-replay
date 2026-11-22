import { afterAll, describe, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appAsset, recognize, terminate } from '../src/ocr';
import { acceptEvidence, compare, parsePolicy, type Case, type SlotId } from '../src/policy';

afterAll(() => terminate());

const load = async (file: string, slot: SlotId, rev = 1) => {
  const r = await recognize(new Uint8Array(readFileSync(file)));
  return { r, o: parsePolicy(r, slot, rev) };
};
const route = (o: ReturnType<typeof parsePolicy>, c: Case) => {
  const x = o[c];
  return x.kind === 'routed' ? x.route : x.kind;
};

describe('real OCR', () => {
  it('V1: photo routed, no-photo omitted', async () => {
    const { o } = await load('public/v1.png', 'V1');
    expect(route(o, 'with-photo')).toBe('Quality Inspection');
    expect(route(o, 'no-photo')).toBe('omitted');
  });

  it('V2 and V1/V2 comparison', async () => {
    const v1 = (await load('public/v1.png', 'V1')).o;
    const { o: v2 } = await load('public/v2.png', 'V2');
    expect(route(v2, 'with-photo')).toBe('Quality Inspection');
    expect(route(v2, 'no-photo')).toBe('Receiving Supervisor');
    expect(compare(v1['with-photo'], v2['with-photo'])).toBe('unchanged');
    expect(compare(v1['no-photo'], v2['no-photo'])).toBe('changed');
  });

  it('held-out: Returns Desk at a different line position than V2', async () => {
    const { o: v2 } = await load('public/v2.png', 'V2');
    const { o: h } = await load('tests/fixtures/heldout.png', 'V2');
    expect(route(h, 'with-photo')).toBe('Quality Inspection');
    expect(route(h, 'no-photo')).toBe('Returns Desk');
    const a = h['no-photo'];
    const b = v2['no-photo'];
    if (a.kind !== 'routed' || b.kind !== 'routed') throw new Error('expected routed');
    expect(a.evidence.line.y0).not.toBe(b.evidence.line.y0);
  });

  it('follows the image, not the file name or slot', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'policy-replay-'));
    const renamed = join(dir, 'v2.png');
    copyFileSync('tests/fixtures/heldout.png', renamed);
    for (const slot of ['V1', 'V2'] as const) {
      const { o } = await load(renamed, slot);
      expect(route(o, 'no-photo')).toBe('Returns Desk');
    }
    const swappedV1 = (await load('public/v2.png', 'V1')).o;
    const swappedV2 = (await load('public/v1.png', 'V2')).o;
    expect(route(swappedV1, 'no-photo')).toBe('Receiving Supervisor');
    expect(route(swappedV2, 'no-photo')).toBe('omitted');
  });

  it('blank is unreadable for both cases', async () => {
    const { o } = await load('tests/fixtures/blank.png', 'V1');
    expect(route(o, 'with-photo')).toBe('unreadable');
    expect(route(o, 'no-photo')).toBe('unreadable');
  });

  it('evidence quote equals the OCR line, bbox inside image, stale rev rejected', async () => {
    const { r, o } = await load('public/v2.png', 'V2', 1);
    const e = o['no-photo'];
    if (e.kind !== 'routed') throw new Error('expected routed');
    expect(r.lines.map((l) => l.text.trim())).toContain(e.evidence.quote);
    const b = e.evidence.line;
    expect(b.x0).toBeGreaterThanOrEqual(0);
    expect(b.y0).toBeGreaterThanOrEqual(0);
    expect(b.x1).toBeLessThanOrEqual(r.width);
    expect(b.y1).toBeLessThanOrEqual(r.height);
    expect(acceptEvidence(e.evidence, 'V2', 1)).toBe(true);
    expect(acceptEvidence(e.evidence, 'V2', 2)).toBe(false);
  });
});

describe('publication subpath', () => {
  it('keeps all browser assets under the Pages project directory', () => {
    const url = 'https://example.github.io/policy-replay/';
    for (const asset of ['v1.png', 'v2.png', 'tesseract/worker.min.js', 'tesseract/core', 'tesseract/lang']) {
      expect(appAsset(asset, url, './')).toBe(url + asset);
    }
    expect(appAsset('v1.png', 'http://127.0.0.1:5173/', '/')).toBe('http://127.0.0.1:5173/v1.png');
  });
});
