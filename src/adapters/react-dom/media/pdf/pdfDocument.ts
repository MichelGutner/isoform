/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';
import { foldQuery, findInPage, pageText, type PageText, type PdfMatch, type TextItemLike } from './search';

/**
 * A loaded PDF with per-page caches: the page objects, their text (for search and
 * the text layer) and their links. Everything is fetched lazily, once.
 */

/** Size of a page at scale 1, in CSS pixels (1 PDF point = 1 px). */
export interface PageSize {
  /** Width at scale 1. */
  width: number;
  /** Height at scale 1. */
  height: number;
}

/** A rectangle in percentages of the page, so it follows any zoom without recomputing. */
export interface PageBox {
  /** Distance from the left edge, in % of the page width. */
  left: number;
  /** Distance from the top edge, in % of the page height. */
  top: number;
  /** Width, in % of the page width. */
  width: number;
  /** Height, in % of the page height. */
  height: number;
}

/** A link area of a page. */
export interface PageLink {
  /** Where the link is on the page. */
  box: PageBox;
  /** Website address (external links). */
  url?: string;
  /** Destination page, starting at `0` (internal links). */
  page?: number;
}

/** The text of a page: what pdf.js returns and its searchable version. */
export interface PageTextData {
  /** pdf.js text content, given to the text layer. */
  content: any;
  /** Searchable (folded) text with its mapping back to the items. */
  text: PageText;
  /** Vertical position of each text item, in % of the page height (to scroll to a match). */
  itemTops: number[];
}

/** A search match with the place to scroll to. */
export interface LocatedMatch extends PdfMatch {
  /** Top of the match's first line, in % of the page height. */
  top: number;
}

const percentBox = ([x1, y1, x2, y2]: number[], size: PageSize): PageBox => ({
  left: (Math.min(x1, x2) / size.width) * 100,
  top: (Math.min(y1, y2) / size.height) * 100,
  width: (Math.abs(x2 - x1) / size.width) * 100,
  height: (Math.abs(y2 - y1) / size.height) * 100,
});

/** Top of a text item in % of the page height (its baseline minus its height). */
const itemTop = (item: any, viewport: PageViewport): number => {
  const [, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5] + (item.height || 0));
  return (y / viewport.height) * 100;
};

/** Memoizes an async getter per page index. */
function perPage<T>(load: (index: number) => Promise<T>): (index: number) => Promise<T> {
  const cache = new Map<number, Promise<T>>();
  return (index) => {
    const hit = cache.get(index);
    if (hit) return hit;
    const next = load(index);
    cache.set(index, next);
    return next;
  };
}

export class PdfDocument {
  /** pdf.js page objects, by index (from `0`). */
  readonly page: (index: number) => Promise<PDFPageProxy>;
  /** Text of each page (content for the text layer + searchable text). */
  readonly text: (index: number) => Promise<PageTextData>;
  /** Link areas of each page. */
  readonly links: (index: number) => Promise<PageLink[]>;

  constructor(
    /** The pdf.js document. */
    readonly pdf: PDFDocumentProxy,
    /** Size of every page at scale 1. */
    readonly sizes: PageSize[],
  ) {
    this.page = perPage((index) => pdf.getPage(index + 1));
    this.text = perPage(async (index) => {
      const page = await this.page(index);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      const items = (content.items as TextItemLike[]).filter((item) => item.str !== undefined);
      return { content, text: pageText(content.items as TextItemLike[]), itemTops: items.map((item) => itemTop(item, viewport)) };
    });
    this.links = perPage(async (index) => {
      const page = await this.page(index);
      const viewport = page.getViewport({ scale: 1 });
      const annotations = await page.getAnnotations();
      const links = annotations.filter((a: any) => a.subtype === 'Link' && (a.url || a.dest));
      return Promise.all(
        links.map(async (a: any) => ({
          box: percentBox(viewport.convertToViewportRectangle(a.rect), this.sizes[index]),
          url: a.url || undefined,
          page: a.dest ? (await this.destinationPage(a.dest)) ?? undefined : undefined,
        })),
      );
    });
  }

  /** Opens a document already loaded by pdf.js: reads every page size (cheap, no rendering). */
  static async open(pdf: PDFDocumentProxy): Promise<PdfDocument> {
    const sizes = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, i) => {
        const viewport = (await pdf.getPage(i + 1)).getViewport({ scale: 1 });
        return { width: viewport.width, height: viewport.height };
      }),
    );
    return new PdfDocument(pdf, sizes);
  }

  /** Number of pages. */
  get pageCount(): number {
    return this.sizes.length;
  }

  /** Page index (from `0`) of a link or outline destination, or `null` if it cannot be resolved. */
  async destinationPage(dest: unknown): Promise<number | null> {
    try {
      const explicit = typeof dest === 'string' ? await this.pdf.getDestination(dest) : (dest as any[]);
      const target = explicit?.[0];
      if (target === undefined || target === null) return null;
      return typeof target === 'number' ? target : await this.pdf.getPageIndex(target);
    } catch {
      return null;
    }
  }

  /** Finds `query` in every page, calling `onProgress` with the matches found so far. */
  async search(query: string, onProgress: (matches: LocatedMatch[]) => void, cancelled: () => boolean): Promise<LocatedMatch[]> {
    const folded = foldQuery(query);
    const found: LocatedMatch[] = [];
    for (let index = 0; index < this.pageCount && folded && !cancelled(); index++) {
      const { text, itemTops } = await this.text(index);
      findInPage(text, index, folded).forEach((match) => found.push({ ...match, top: itemTops[match.parts[0].item] ?? 0 }));
      onProgress([...found]);
    }
    return found;
  }
}

/** Outline (table of contents) entry, flattened with its depth. */
export interface OutlineEntry {
  /** Entry title. */
  title: string;
  /** Nesting level, from `0`. */
  depth: number;
  /** Destination page, from `0` (`null` when it points nowhere resolvable). */
  page: number | null;
  /** Website address, for entries that are links. */
  url?: string;
}

/** The document's outline as a flat list (at most 3 levels deep), with destinations resolved. */
export async function readOutline(doc: PdfDocument): Promise<OutlineEntry[]> {
  const tree = (await doc.pdf.getOutline()) ?? [];
  const entries: OutlineEntry[] = [];
  const walk = async (items: any[], depth: number) => {
    for (const item of items) {
      entries.push({ title: item.title, depth, page: item.dest ? await doc.destinationPage(item.dest) : null, url: item.url ?? undefined });
      if (depth < 2 && item.items?.length) await walk(item.items, depth + 1);
    }
  };
  await walk(tree, 0);
  return entries;
}
