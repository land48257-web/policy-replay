// Chrome smoke test: serves ./dist on loopback with Vite preview, drives installed Google Chrome via playwright-core.
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4173;
const BASE = process.env.POLICY_REPLAY_TEST_BASE || '/policy-replay/';
if (!/^\/(?:[a-z0-9-]+\/)*$/i.test(BASE)) throw new Error('Invalid smoke test base path');
const ORIGIN = `http://127.0.0.1:${PORT}${BASE}`;
const OCR_TIMEOUT = 120000;

const SENT_V2 = 'If a damaged return has no photo, send it to the Receiving Supervisor.';
const SENT_HELD = 'If a damaged return has no photo, send it to the Returns Desk.';
const OMIT = 'No route: readable policy omits the rule';
const UNREADABLE = 'Unreadable / OCR failed';

const heldout = readFileSync(path.join(root, 'tests/fixtures/heldout.png'));
const blank = readFileSync(path.join(root, 'tests/fixtures/blank.png'));
const v2png = readFileSync(path.join(root, 'public/v2.png'));
const png = (name, buffer) => ({ name, mimeType: 'image/png', buffer });

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failures += 1;
    console.log(`FAIL ${name}: ${String(e?.message ?? e).split('\n')[0]}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function eq(actual, expected, what) {
  assert(actual === expected, `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const tid = (id) => `[data-testid="${id}"]`;
const text = async (page, id) => ((await page.locator(tid(id)).textContent()) ?? '').trim();
const outcomeText = (page, c, s) => text(page, `status-${c}-${s}`);
const snap = (page) => page.evaluate(() => window.__policyReplay.snapshot());
const hasOutcome = (page, c, s, needle) =>
  page.waitForFunction(
    ([sel, n]) => (document.querySelector(sel)?.textContent ?? '').includes(n),
    [tid(`status-${c}-${s}`), needle],
    { timeout: OCR_TIMEOUT },
  );
const slotStatus = (page, s, word) =>
  page.waitForFunction(
    ([sel, w]) => (document.querySelector(sel)?.textContent ?? '').startsWith(w),
    [tid(`scan-status-${s}`), word],
    { timeout: OCR_TIMEOUT },
  );
const evidenceCount = (page) => page.locator(`${tid('quote')}, ${tid('overlay')}`).count();

async function focusShowByTab(page) {
  await page.focus(tid(`view-${(await snap(page)).view}`));
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'show-on-scan');
    if (hit) return i + 1;
  }
  throw new Error('show-on-scan never received focus via Tab');
}
async function showByKeyboard(page) {
  await focusShowByTab(page);
  await page.keyboard.press('Enter');
  await page.waitForSelector(tid('quote'), { timeout: 5000 });
}
const pick = (page, id) => page.locator(tid(id)).check({ force: true });

async function overlayGeometry(page) {
  return page.evaluate(() => {
    const img = document.getElementById('scan-img').getBoundingClientRect();
    const svg = document.querySelector('[data-testid="overlay"]');
    const r = svg.querySelector('rect.line-box');
    const vb = svg.getAttribute('viewBox').split(' ').map(Number);
    const rr = r.getBoundingClientRect();
    return {
      img: { l: img.left, t: img.top, w: img.width, h: img.height },
      rect: { l: rr.left, t: rr.top, w: rr.width, h: rr.height },
      attrs: ['x', 'y', 'width', 'height'].map((k) => Number(r.getAttribute(k))),
      vbW: vb[2],
      vbH: vb[3],
      natW: document.getElementById('scan-img').naturalWidth,
      natH: document.getElementById('scan-img').naturalHeight,
    };
  });
}

const requests = [];
const pageErrors = [];
let server;
let browser;
try {
  assert(existsSync(path.join(root, 'dist/index.html')), 'dist/ missing: run npm run build first');
  server = await preview({ root, base: BASE, preview: { host: '127.0.0.1', port: PORT, strictPort: true, open: false } });
  browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }), headless: true });
  mkdirSync(path.join(root, 'test-results'), { recursive: true });

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  context.on('request', (r) => requests.push(r.url()));
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto(ORIGIN);

  await check('a. built-in examples: outcomes and comparison', async () => {
    await page.click(tid('load-examples'));
    await slotStatus(page, 'V1', 'Ready');
    await slotStatus(page, 'V2', 'Ready');
    assert((await outcomeText(page, 'with-photo', 'V1')).endsWith('Quality Inspection'), 'V1 with-photo');
    eq((await outcomeText(page, 'no-photo', 'V1')).endsWith(OMIT), true, 'V1 no-photo omitted');
    assert((await outcomeText(page, 'with-photo', 'V2')).endsWith('Quality Inspection'), 'V2 with-photo');
    assert((await outcomeText(page, 'no-photo', 'V2')).endsWith('Receiving Supervisor'), 'V2 no-photo');
    eq(await text(page, 'compare-with-photo'), 'Comparison: unchanged', 'compare with-photo');
    eq(await text(page, 'compare-no-photo'), 'Comparison: changed', 'compare no-photo');
  });

  await check('b. keyboard Show on scan: exact quote and aligned overlay', async () => {
    await pick(page, 'view-V2');
    await pick(page, 'case-no-photo');
    await showByKeyboard(page);
    eq(await text(page, 'quote'), SENT_V2, 'quote');
    assert(await page.locator(tid('overlay')).isVisible(), 'overlay visible');
    await page.waitForFunction(() => document.getElementById('scan-img').complete);
    const g = await overlayGeometry(page);
    eq(g.vbW, g.natW, 'viewBox width = natural width');
    eq(g.vbH, g.natH, 'viewBox height = natural height');
    const [x, y, w, h] = g.attrs;
    const exp = {
      l: g.img.l + (x / g.vbW) * g.img.w,
      t: g.img.t + (y / g.vbH) * g.img.h,
      w: (w / g.vbW) * g.img.w,
      h: (h / g.vbH) * g.img.h,
    };
    const tol = 4;
    for (const k of ['l', 't', 'w', 'h']) {
      assert(Math.abs(g.rect[k] - exp[k]) <= tol, `overlay ${k} ${g.rect[k]} vs expected ${exp[k]}`);
    }
    assert(g.rect.w > 20 && g.rect.h > 5, 'overlay has real size');
    assert(g.rect.l >= g.img.l - tol && g.rect.l + g.rect.w <= g.img.l + g.img.w + tol, 'overlay inside image horizontally');
    assert(g.rect.t >= g.img.t - tol && g.rect.t + g.rect.h <= g.img.t + g.img.h + tol, 'overlay inside image vertically');
    await page.screenshot({ path: path.join(root, 'test-results/wide.png'), fullPage: true });
  });

  await check('c. stale clearing on view, case and upload', async () => {
    assert((await evidenceCount(page)) > 0, 'evidence precondition');
    await pick(page, 'view-V1');
    eq(await evidenceCount(page), 0, 'evidence after view switch');
    await pick(page, 'view-V2');
    await showByKeyboard(page);
    await pick(page, 'case-with-photo');
    eq(await evidenceCount(page), 0, 'evidence after case change');
    await pick(page, 'case-no-photo');
    await showByKeyboard(page);
    await page.setInputFiles(tid('file-V2'), png('again.png', v2png));
    eq(await evidenceCount(page), 0, 'evidence right after upload');
    eq((await snap(page)).shown, null, 'snapshot.shown after upload');
    await slotStatus(page, 'V2', 'Ready');
    await hasOutcome(page, 'no-photo', 'V2', 'Receiving Supervisor');
  });

  await check('d. held-out under a misleading name, swapped into V2 then V1', async () => {
    await page.setInputFiles(tid('file-V2'), png('v2.png', heldout));
    await hasOutcome(page, 'no-photo', 'V2', 'Returns Desk');
    assert((await outcomeText(page, 'with-photo', 'V2')).endsWith('Quality Inspection'), 'V2 with-photo');
    await pick(page, 'view-V2');
    await pick(page, 'case-no-photo');
    await showByKeyboard(page);
    eq(await text(page, 'quote'), SENT_HELD, 'held-out quote');
    await page.setInputFiles(tid('file-V1'), png('v2.png', heldout));
    await hasOutcome(page, 'no-photo', 'V1', 'Returns Desk');
    assert((await outcomeText(page, 'with-photo', 'V1')).endsWith('Quality Inspection'), 'V1 with-photo');
    eq(await text(page, 'compare-with-photo'), 'Comparison: unchanged', 'compare with-photo');
  });

  await check('e. late OCR result is ignored', async () => {
    const before = (await snap(page)).slots.V1.rev;
    await page.setInputFiles(tid('file-V1'), png('late.png', heldout));
    await page.setInputFiles(tid('file-V1'), png('blank.png', blank));
    await hasOutcome(page, 'with-photo', 'V1', UNREADABLE);
    await hasOutcome(page, 'no-photo', 'V1', UNREADABLE);
    const recheck = async () => {
      for (const c of ['with-photo', 'no-photo']) {
        const t = await outcomeText(page, c, 'V1');
        assert(t.endsWith(UNREADABLE) && !t.includes('Returns Desk'), `V1 ${c}: ${t}`);
      }
      const s = await snap(page);
      eq(s.slots.V1.status, 'unreadable', 'V1 status');
      eq(s.slots.V1.rev, before + 2, 'V1 revision');
    };
    await recheck();
    await page.waitForTimeout(8000);
    await recheck();
    await pick(page, 'view-V1');
    for (const c of ['case-with-photo', 'case-no-photo']) {
      await pick(page, c);
      assert(await page.locator(tid('show-on-scan')).isHidden(), `no show-on-scan (${c})`);
    }
    assert((await text(page, 'compare-no-photo')).includes('not comparable'), 'compare not comparable');
  });

  await check('f. unsupported file shows error and keeps scan state', async () => {
    const before = await snap(page);
    const textBefore = await outcomeText(page, 'no-photo', 'V1');
    await page.setInputFiles(tid('file-V1'), { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    const msg = await text(page, 'message');
    assert(/only PNG or JPEG/.test(msg), `message: ${msg}`);
    const after = await snap(page);
    eq(after.slots.V1.rev, before.slots.V1.rev, 'V1 rev unchanged');
    eq(after.slots.V1.status, before.slots.V1.status, 'V1 status unchanged');
    eq(await outcomeText(page, 'no-photo', 'V1'), textBefore, 'V1 outcome unchanged');
  });

  await check('g. 375px viewport: no horizontal scroll, status visible', async () => {
    const narrow = await context.newPage();
    narrow.on('pageerror', (e) => pageErrors.push(String(e)));
    await narrow.setViewportSize({ width: 375, height: 812 });
    await narrow.goto(ORIGIN);
    await narrow.click(tid('load-examples'));
    await slotStatus(narrow, 'V1', 'Ready');
    await slotStatus(narrow, 'V2', 'Ready');
    await pick(narrow, 'view-V2');
    await pick(narrow, 'case-no-photo');
    await showByKeyboard(narrow);
    const m = await narrow.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      bw: document.body.scrollWidth,
    }));
    assert(m.sw <= m.cw && m.bw <= m.cw, `horizontal overflow: ${JSON.stringify(m)}`);
    for (const id of ['status-no-photo-V1', 'status-no-photo-V2', 'compare-no-photo', 'compare-with-photo', 'scan-status-V1']) {
      const loc = narrow.locator(tid(id));
      assert(await loc.isVisible(), `${id} visible`);
      const b = await loc.boundingBox();
      assert(b && b.x >= -1 && b.x + b.width <= 376, `${id} inside viewport: ${JSON.stringify(b)}`);
    }
    await narrow.screenshot({ path: path.join(root, 'test-results/narrow.png'), fullPage: true });
    await narrow.close();
  });

  await check('h. zero non-loopback requests', async () => {
    assert(requests.length > 0, 'no requests recorded');
    const bad = requests.filter((u) => !(u.startsWith(ORIGIN) || u.startsWith('data:') || u.startsWith('blob:')));
    assert(bad.length === 0, `non-loopback requests: ${bad.slice(0, 5).join(', ')}`);
    console.log(`  (${requests.length} requests, all ${ORIGIN} / data: / blob:)`);
  });

  await check('i. no uncaught page errors', async () => {
    assert(pageErrors.length === 0, pageErrors.join(' | '));
  });
} catch (e) {
  failures += 1;
  console.log(`FAIL setup: ${String(e?.stack ?? e)}`);
} finally {
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
}

console.log(failures === 0 ? 'SMOKE OK' : `SMOKE FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
