import { parentPort, workerData } from 'node:worker_threads';
import { getDocumentProxy } from 'unpdf';

let pdf;
try {
  pdf = await getDocumentProxy(new Uint8Array(workerData.bytes), { isEvalSupported: false, maxImageSize: 1_000_000, disableFontFace: true, useSystemFonts: false });
  if (pdf.numPages > 25) throw new Error('PAGE_LIMIT');
  const pages = [];
  let length = 0;
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const text = content.items.filter(item => typeof item.str === 'string').map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').trim();
    length += text.length;
    if (length > 24000) throw new Error('TEXT_LIMIT');
    pages.push({ number, text });
    page.cleanup();
  }
  if (length < 40) throw new Error('NO_TEXT');
  parentPort.postMessage({ pages });
} catch (error) {
  const code = ['PAGE_LIMIT', 'TEXT_LIMIT', 'NO_TEXT'].includes(error?.message) ? error.message : 'UNREADABLE';
  parentPort.postMessage({ error: code });
} finally {
  await pdf?.loadingTask?.destroy().catch(() => {});
}
