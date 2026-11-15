import { pdfWorkerSrc } from '../../../../config';

/**
 * Loads Mozilla pdf.js (`pdfjs-dist`) once, on demand.
 *
 * Worker: with `modules.pdf.workerSrc` the documents are parsed in a background
 * thread (the app serves the worker file). Without it, the worker code is imported
 * as a normal module and pdf.js runs it on the main thread ("fake worker"): no
 * bundler setup, at the cost of some jank on very large files.
 */
export type Pdfjs = typeof import('pdfjs-dist');

let loading: Promise<Pdfjs> | null = null;

/** The worker module registers itself in `globalThis.pdfjsWorker`, which pdf.js uses when there is no worker URL. */
const loadMainThreadWorker = () => import('pdfjs-dist/build/pdf.worker.min.mjs');

async function load(): Promise<Pdfjs> {
  const pdfjs = await import('pdfjs-dist');
  const workerSrc = pdfWorkerSrc();
  if (workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    return pdfjs;
  }
  await loadMainThreadWorker();
  return pdfjs;
}

/** pdf.js, loaded (and its worker set up) the first time it is needed. */
export const loadPdfjs = (): Promise<Pdfjs> => (loading ??= load());
