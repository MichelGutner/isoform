import type { PdfItem, PlaylistHandle, PlaylistProps } from './playlist';

/**
 * Contract of the `Pdf` primitive: the same on every platform.
 *  · Web: Mozilla pdf.js (`pdfjs-dist`), loaded on demand, with the lib's toolbar.
 *  · iOS: Apple PDFKit (`PDFView`) with a UIKit toolbar.
 *  · Android: the system `PdfRenderer` with a Jetpack Compose viewer.
 *
 * Features by platform:
 *
 * | Feature                                  | Web | iOS | Android 15+ / 12+ updated | Older Android |
 * |------------------------------------------|-----|-----|---------------------------|---------------|
 * | Pages, scroll, pinch/double-tap zoom     | ✓   | ✓   | ✓                         | ✓             |
 * | Page counter and "go to page"            | ✓   | ✓   | ✓                         | ✓             |
 * | Thumbnails                               | ✓   | ✓   | ✓                         | ✓             |
 * | Night mode                               | ✓   | ✓   | ✓                         | ✓             |
 * | Fullscreen                               | ✓   | ✓   | ✓                         | ✓             |
 * | Search with highlighted matches          | ✓   | ✓   | ✓                         | –             |
 * | Read aloud (text to speech)              | ✓   | ✓   | ✓                         | –             |
 * | Links (pages and URLs)                   | ✓   | ✓   | ✓                         | –             |
 * | Password-protected files                 | ✓   | ✓   | ✓                         | –             |
 * | Text selection and copy                  | ✓   | ✓   | –                         | –             |
 * | Table of contents (outline)              | ✓   | ✓   | –                         | –             |
 * | Share / download / print                 | ✓   | ✓   | –                         | –             |
 *
 * Read aloud follows the text with a highlight on the web and iOS; on Android it
 * reads and turns the pages.
 *
 * "Android 12+ updated" = Android 12–14 with the SDK extension 13 from Google
 * Play system updates. Older devices get the basic viewer (the search button is hidden).
 */

/** How a page is sized when the document opens (and when zoom is `1`). */
export type PdfFit = 'width' | 'page';

/** How pages follow each other: one under the other (`'vertical'`) or side by side, one per screen (`'horizontal'`). */
export type PdfDirection = 'vertical' | 'horizontal';

/** Document information, sent by `onLoad`. */
export interface PdfLoadInfo {
  /** Number of pages of the document. */
  pageCount: number;
}

/** Current page, sent by `onPageChange`. */
export interface PdfPageInfo {
  /** Page most visible on screen, starting at `1`. */
  page: number;
  /** Number of pages of the document. */
  pageCount: number;
}

/** Search state, sent by `onSearch` after each search and each move between matches. */
export interface PdfSearchInfo {
  /** The text searched for (`''` after `clearSearch`). */
  query: string;
  /** How many matches the document has (`0` when none). */
  total: number;
  /** Which match is selected, starting at `1` (`0` when there are no matches). */
  current: number;
}

/** Imperative control of a `Pdf`, obtained through its `ref`. */
export interface PdfHandle extends PlaylistHandle {
  /** Scrolls to `page` (starting at `1`; clamped to the document). Triggers `onPageChange`. */
  goToPage(page: number): void;
  /**
   * Finds every occurrence of `query` (case- and accent-insensitive), highlights
   * them and scrolls to the first. Triggers `onSearch`. No-op on Android older than 12.
   */
  search(query: string): void;
  /** Selects the next match (wraps to the first). Triggers `onSearch`. */
  searchNext(): void;
  /** Selects the previous match (wraps to the last). Triggers `onSearch`. */
  searchPrevious(): void;
  /** Removes the highlights and the search. Triggers `onSearch` with `query: ''`. */
  clearSearch(): void;
  /** Zooms to `scale`, where `1` is the `fit` size (clamped up to `maxZoom`; the web also allows down to `0.25`). */
  setZoom(scale: number): void;
  /** Shows the viewer over the whole screen (`true`) or back in its place (`false`). Triggers `onFullscreenChange`. */
  setFullscreen(fullscreen: boolean): void;
  /**
   * Reads the document aloud with the system voice, from the page on screen to the end,
   * turning the pages as it goes. Triggers `onReadAloudChange`. No-op on Android older than 12.
   */
  startReadAloud(): void;
  /** Stops reading aloud. Triggers `onReadAloudChange`. */
  stopReadAloud(): void;
}

/** Props of the `Pdf` primitive. */
export interface PdfOwnProps extends PlaylistProps<PdfItem> {
  /** Document URL: `https://…`, `file://…` (native) or a same-origin/CORS-enabled URL (web). Give either `src` or an `items` list. */
  src?: string;
  /** Password of a protected document. Without it, the viewer asks the user (and calls `onPasswordRequired`). */
  password?: string;
  /** Page shown when the document opens, starting at `1`. Default `1`. */
  initialPage?: number;
  /** Shows the toolbar (page counter, thumbnails, search, menu). Default `true`. */
  controls?: boolean;
  /** Starts in night mode (inverted page colors). The user can switch it in the menu. Default `false`. */
  nightMode?: boolean;
  /** Page size at zoom `1`: the full width (`'width'`) or the whole page (`'page'`). Default `'width'`. */
  fit?: PdfFit;
  /** Largest zoom, as a multiple of the `fit` size. Default `5`. */
  maxZoom?: number;
  /**
   * Pages one under the other (`'vertical'`) or side by side, turning like a book
   * (`'horizontal'`; each page fits the screen). The user can switch it in the menu. Default `'vertical'`.
   */
  direction?: PdfDirection;
  /**
   * Language of the read-aloud voice, as a BCP 47 tag (`'pt-BR'`, `'en-US'`…).
   * Default: the device language.
   */
  speechLanguage?: string;
  /**
   * Read-aloud voice, by the platform's own id: the voice `name` on the web
   * (`speechSynthesis.getVoices()`), the `AVSpeechSynthesisVoice.identifier` on iOS
   * and the `Voice.getName()` on Android. Default: the most natural voice installed
   * for the language. The user can also pick one in the viewer's menu ("Voice").
   */
  speechVoice?: string;
  /** Called once the document is open. */
  onLoad?: (info: PdfLoadInfo) => void;
  /** Called when the page most visible on screen changes. */
  onPageChange?: (info: PdfPageInfo) => void;
  /** Called after a search and after each move between matches. */
  onSearch?: (info: PdfSearchInfo) => void;
  /** Called when the document fails to download or open, with a readable message. */
  onError?: (message: string) => void;
  /** Called when the document needs a password (none given, or a wrong one). The viewer shows a password field. */
  onPasswordRequired?: () => void;
  /** Called when the user taps a link to a website, before it opens, with its URL. */
  onLinkPress?: (url: string) => void;
  /** Called with `true` when entering fullscreen and `false` when leaving it. */
  onFullscreenChange?: (fullscreen: boolean) => void;
  /** Called with `true` when reading aloud starts and `false` when it stops or reaches the end. */
  onReadAloudChange?: (reading: boolean) => void;
}
