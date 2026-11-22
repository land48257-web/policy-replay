import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Check a directory-mounted production artifact without browser, accounts, or network dependencies.
const prefix = '/release-check/policy-replay/';
const dir = fileURLToPath(new URL('../dist/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.txt': 'text/plain' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
  const filename = path.resolve(dir, decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html');
  if (!filename.startsWith(dir)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(filename);
    res.writeHead(200, { 'content-type': types[path.extname(filename)] ?? 'application/octet-stream' }).end(body);
  } catch (e) { res.writeHead(e.code === 'ENOENT' ? 404 : 500).end(); }
});
await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
try {
  const base = new URL('http://127.0.0.1:' + server.address().port + prefix);
  const html = await (await fetch(base)).text();
  const entries = [...html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g)].map((m) => m[1]);
  assert.equal(entries.length, 2, 'expected compiled JS and CSS from index.html');
  for (const file of entries) assert.ok(file.startsWith('./'), 'entry must be relative: ' + file);
  const assets = [...entries, 'v1.png', 'v2.png', 'tesseract/worker.min.js', 'tesseract/lang/eng.traineddata.gz',
    'tesseract/core/tesseract-core-lstm.wasm.js', 'tesseract/core/tesseract-core-simd-lstm.wasm.js', 'tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js',
    'tesseract/core/tesseract-core-lstm.wasm', 'tesseract/core/tesseract-core-simd-lstm.wasm', 'tesseract/core/tesseract-core-relaxedsimd-lstm.wasm',
    'tesseract/THIRD_PARTY_NOTICES.md', 'tesseract/licenses/tesseract-tessdata-Apache-2.0.txt'];
  for (const file of assets) {
    const target = new URL(file, base);
    assert.ok(target.pathname.startsWith(prefix), file + ' escaped the site directory');
    const r = await fetch(target);
    assert.equal(r.status, 200, 'could not serve ' + file);
    assert.ok((await r.arrayBuffer()).byteLength > 0, 'empty asset ' + file);
  }
  assert.equal((await fetch(new URL('/tesseract/worker.min.js', base))).status, 404, 'test host must not provide a root-path alias');
  console.log('Nested static hosting passed: ' + assets.length + ' relative app/OCR/notice assets.');
} finally {
  await new Promise((resolve)=>server.close(resolve));
}
