// Renders the policy scans with a local Chrome canvas (no network).
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const PHOTO = 'If a damaged return includes a photo, send it to Quality Inspection.';
const V2_CLAUSE = 'If a damaged return has no photo, send it to the Receiving Supervisor.';
const HELD_CLAUSE = 'If a damaged return has no photo, send it to the Returns Desk.';

// Layout specs: { width, height, margin, font (family), size, items: [{ text, y, size? }] }
function sharedLayout(version, clauses) {
  const width = 1700;
  const margin = 80;
  const size = 40;
  const items = [
    { text: 'Returns Handling Policy', y: 100, size: 52 },
    { text: `Revision ${version}`, y: 180 },
    { text: 'General notes for the returns team.', y: 270 },
    { text: 'Keep all records for audit purposes.', y: 340 },
  ];
  clauses.forEach((text, i) => items.push({ text, y: 450 + i * 90 }));
  items.push({ text: 'End of document.', y: 450 + clauses.length * 90 + 90 });
  return { width, height: 800, margin, family: 'Arial', size, items };
}

// Independently written layout for the held-out page.
function heldoutLayout() {
  const width = 1900;
  const margin = 110;
  const height = 1000;
  return {
    width,
    height,
    margin,
    family: 'Georgia',
    size: 42,
    items: [
      { text: HELD_CLAUSE, y: 260 },
      { text: 'Warehouse Returns Memo', y: 560, size: 54 },
      { text: 'Issued by the operations office.', y: 650 },
      { text: PHOTO, y: 800 },
      { text: 'Please file a copy with your supervisor.', y: 900 },
    ],
  };
}

const v1 = sharedLayout('1', [PHOTO]);
const v2 = sharedLayout('2', [PHOTO, V2_CLAUSE]);
const heldout = heldoutLayout();
const blank = { width: 1700, height: 800, margin: 80, family: 'Arial', size: 40, items: [] };

const jobs = [
  ['public/v1.png', v1],
  ['public/v2.png', v2],
  ['tests/fixtures/heldout.png', heldout],
  ['tests/fixtures/blank.png', blank],
];

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.setContent('<html><body><canvas id="c"></canvas></body></html>');
  for (const [path, spec] of jobs) {
    const dataUrl = await page.evaluate((s) => {
      const c = document.getElementById('c');
      c.width = s.width;
      c.height = s.height;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, s.width, s.height);
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'alphabetic';
      for (const it of s.items) {
        ctx.font = `${it.size ?? s.size}px ${s.family}`;
        const w = ctx.measureText(it.text).width;
        if (w > s.width - 2 * s.margin) {
          throw new Error(`Line too wide (${Math.round(w)}px): ${it.text}`);
        }
        ctx.fillText(it.text, s.margin, it.y);
      }
      return c.toDataURL('image/png');
    }, spec);
    writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('wrote', path);
  }
} finally {
  await browser.close();
}
