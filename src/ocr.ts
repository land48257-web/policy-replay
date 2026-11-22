import { createWorker, type Worker } from 'tesseract.js';
import type { OcrLine, OcrResult } from './policy';

export function appAsset(path: string, documentURL = document.baseURI, base = import.meta.env.BASE_URL): string {
  return new URL(path, new URL(base, documentURL)).href;
}

const failed: OcrResult = { ok: false, width: 0, height: 0, lines: [] };
let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    const isNode = typeof window === 'undefined';
    workerPromise = (
      isNode
        ? createWorker('eng', 1, { langPath: 'public/tesseract/lang', cacheMethod: 'none' })
        : createWorker('eng', 1, {
            workerPath: appAsset('tesseract/worker.min.js'),
            corePath: appAsset('tesseract/core'),
            langPath: appAsset('tesseract/lang'),
            workerBlobURL: false,
            cacheMethod: 'none',
          })
    ).catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

async function imageSize(image: Blob | Uint8Array): Promise<{ width: number; height: number }> {
  if (image instanceof Uint8Array) {
    // PNG IHDR: width and height are big-endian uint32 at bytes 16 and 20.
    const v = new DataView(image.buffer, image.byteOffset, image.byteLength);
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }
  const bmp = await createImageBitmap(image);
  const size = { width: bmp.width, height: bmp.height };
  bmp.close();
  return size;
}

export async function recognize(image: Blob | Uint8Array): Promise<OcrResult> {
  try {
    const { width, height } = await imageSize(image);
    const worker = await getWorker();
    const { data } = await worker.recognize(image, {}, { blocks: true });
    const lines: OcrLine[] = (data.blocks ?? []).flatMap((b) =>
      b.paragraphs.flatMap((p) =>
        p.lines.map((l) => ({
          text: l.text,
          bbox: { ...l.bbox },
          words: l.words.map((w) => ({ text: w.text, bbox: { ...w.bbox } })),
        })),
      ),
    );
    const hasText = lines.some((l) => l.text.trim() !== '');
    return hasText ? { ok: true, width, height, lines } : { ok: false, width, height, lines: [] };
  } catch {
    return failed;
  }
}

export async function terminate(): Promise<void> {
  const p = workerPromise;
  workerPromise = null;
  if (p) await (await p).terminate();
}
