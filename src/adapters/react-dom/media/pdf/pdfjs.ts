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

/**
 * `pdfjs-dist` is an optional peer dependency (it weighs ~45 MB, so apps without PDFs should not
 * install it). Using `Pdf` without it fails here with the fix, instead of a bundler's "cannot resolve".
 */
const MISSING_PDFJS =
  '[isoform] <Pdf> on the web needs pdf.js. Install it in your app: `yarn add pdfjs-dist` (or `npm i pdfjs-dist`).';

async function load(): Promise<Pdfjs> {
  let pdfjs: Pdfjs;
  try {
    pdfjs = await import('pdfjs-dist');
  } catch (error) {
    throw new Error(MISSING_PDFJS, { cause: error });
  }
  const workerSrc = pdfWorkerSrc();
  if (workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    return pdfjs;
  }
  await loadMainThreadWorker();
  return pdfjs;
}

/** pdf.js, loaded (and its worker set up) the first time it is needed. */
export const loadPdfjs = (): Promise<Pdfjs> =>
  (loading ??= load().catch((error) => {
    loading = null; // a failed load (e.g. not installed yet) must not stick: the next mount retries
    throw error;
  }));
