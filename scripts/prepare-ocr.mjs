// Copies the Tesseract.js worker, core and English traineddata from node_modules
// into public/tesseract/ so OCR assets are served same-origin.
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';

const out = 'public/tesseract';
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/core`, { recursive: true });
mkdirSync(`${out}/lang`, { recursive: true });

cpSync('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`);

const coreDir = 'node_modules/tesseract.js-core';
for (const f of readdirSync(coreDir)) {
  if (/^tesseract-core.*\.(js|wasm)$/.test(f)) cpSync(`${coreDir}/${f}`, `${out}/core/${f}`);
}

cpSync(
  'node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz',
  `${out}/lang/eng.traineddata.gz`,
);
cpSync('licenses', `${out}/licenses`, { recursive: true });
cpSync('THIRD_PARTY_NOTICES.md', `${out}/THIRD_PARTY_NOTICES.md`);
cpSync('LICENSE', `${out}/LICENSE`);
console.log('OCR assets and notices copied to', out);
