/**
 * Text search over the pages of a PDF, case- and accent-insensitive.
 *
 * Each page's text is the concatenation of its pdf.js text items (the same items,
 * in the same order, that become the spans of the text layer). A match is stored
 * as pieces of those items, so the text layer can turn it into exact rectangles.
 */

/** A text item of a page, as pdf.js gives it (`str` is absent on marked-content markers). */
export interface TextItemLike {
  /** The item's text (`undefined` for marked-content markers, which have no span). */
  str?: string;
  /** Whether a line break follows the item. */
  hasEOL?: boolean;
}

/** A piece of a match that lies inside one text item. */
export interface MatchPart {
  /** Index of the item among the page's items that have text (= index in the text layer's spans). */
  item: number;
  /** First character of the piece inside the item. */
  start: number;
  /** Character after the last one of the piece inside the item. */
  end: number;
}

/** One occurrence of the search on a page. */
export interface PdfMatch {
  /** Page of the match, starting at `0`. */
  page: number;
  /** The item pieces covered by the match (more than one when it spans items or lines). */
  parts: MatchPart[];
}

/** A page's searchable text: the normalized string and where each normalized char came from. */
export interface PageText {
  /** Lowercase, accent-free text of the page. */
  text: string;
  /** For each char of `text`: its item index. */
  items: number[];
  /** For each char of `text`: its offset inside the item. */
  offsets: number[];
}

/** Lowercase, without accents (`"Coração"` → `"coracao"`). One input char may become 0+ chars. */
const fold = (char: string): string => char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Folds the search text the same way as the pages, and collapses its spaces. */
export const foldQuery = (query: string): string => Array.from(query.trim().replace(/\s+/g, ' ')).map(fold).join('');

/** Builds the text of a page from its text items: folded for search, or as is (`raw`) for reading aloud. */
export function pageText(textItems: TextItemLike[], raw = false): PageText {
  const convert = raw ? (char: string) => char : fold;
  const page: PageText = { text: '', items: [], offsets: [] };
  const push = (chars: string, item: number, offset: number) => {
    page.text += chars;
    for (let i = 0; i < chars.length; i++) {
      page.items.push(item);
      page.offsets.push(offset);
    }
  };

  textItems
    .filter((entry) => entry.str !== undefined)
    .forEach((entry, item) => {
      Array.from(entry.str as string).forEach((char, offset) => push(convert(char), item, offset));
      // a line break counts as a space, so "heart\nrate" matches "heart rate"
      if (entry.hasEOL) push(' ', item, (entry.str as string).length);
    });
  return page;
}

/** Turns the range `[from, to)` of a page's text into item pieces. */
export function toParts(page: PageText, from: number, to: number): MatchPart[] {
  const parts: MatchPart[] = [];
  for (let i = from; i < to; i++) {
    const item = page.items[i];
    const offset = page.offsets[i];
    const last = parts[parts.length - 1];
    if (last && last.item === item) last.end = Math.max(last.end, offset + 1);
    else parts.push({ item, start: offset, end: offset + 1 });
  }
  return parts;
}

/** Every occurrence of `query` (already folded) on a page. */
export function findInPage(page: PageText, pageIndex: number, query: string): PdfMatch[] {
  const matches: PdfMatch[] = [];
  if (!query) return matches;
  for (let at = page.text.indexOf(query); at !== -1; at = page.text.indexOf(query, at + query.length)) {
    matches.push({ page: pageIndex, parts: toParts(page, at, at + query.length) });
  }
  return matches;
}
