// Check: OCR each rendered scan with the local language data (Node default worker/core).
import { createWorker } from 'tesseract.js';
const w = await createWorker('eng', 1, {
  langPath: 'public/tesseract/lang',
  cacheMethod: 'none',
});
for (const f of ['public/v1.png', 'public/v2.png', 'tests/fixtures/heldout.png', 'tests/fixtures/blank.png']) {
  const { data } = await w.recognize(f, {}, { blocks: true });
  const lines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
  console.log(f, JSON.stringify(lines.map((l) => l.text.trim())));
}
await w.terminate();
