import type { LocatedMatch, PdfDocument } from './pdfDocument';
import { pageText, toParts, type PageText, type TextItemLike } from './search';

/**
 * Read aloud on the web, with the browser's speech synthesis (`speechSynthesis`).
 *
 * Pages are read in order from a starting page. Each page is split into short
 * pieces (sentences of at most ~220 characters), because some voices stop after
 * about 15 seconds of continuous speech. The word being spoken is reported as a
 * match (same shape as a search match), so the page can highlight it.
 */

/** Whether this browser can speak. */
export const canReadAloud = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

// Chrome loads its voice list lazily: asking once here makes it ready by the first "read aloud".
if (canReadAloud()) window.speechSynthesis.getVoices();

/** Longest piece spoken at once. */
const PIECE = 220;

/** Splits text into pieces that end at a sentence (or a space), with their start offset. */
function pieces(text: string): Array<{ start: number; text: string }> {
  const out: Array<{ start: number; text: string }> = [];
  let start = 0;
  while (start < text.length) {
    const chunk = text.slice(start, start + PIECE);
    out.push({ start, text: chunk.slice(0, cutAt(chunk, start + PIECE >= text.length)) });
    start += out[out.length - 1].text.length;
  }
  return out.filter((piece) => piece.text.trim());
}

/** Where to cut a chunk: the whole last chunk, else after its last sentence, else at its last space. */
function cutAt(chunk: string, last: boolean): number {
  const sentence = Math.max(chunk.lastIndexOf('. '), chunk.lastIndexOf('? '), chunk.lastIndexOf('! '));
  const space = chunk.lastIndexOf(' ');
  const candidates = [last ? chunk.length : -1, sentence > PIECE / 3 ? sentence + 1 : -1, space > 0 ? space : -1, chunk.length];
  return candidates.find((at) => at > 0) ?? chunk.length;
}

/** Words in voice names that mean a natural (neural) voice, best first. */
const NATURAL = [/natural/i, /neural/i, /premium/i, /enhanced/i, /online/i, /google/i, /siri/i];

/** Higher is more natural: neural voices first, then non-local ones (usually better), then the default. */
function voiceRank(voice: SpeechSynthesisVoice): number {
  const hit = NATURAL.findIndex((pattern) => pattern.test(voice.name));
  return (hit === -1 ? 0 : (NATURAL.length - hit) * 10) + (voice.localService ? 0 : 5) + (voice.default ? 1 : 0);
}

/** Voices of `language` (exact tag first, else the same language), most natural first. */
export function languageVoices(language: string | undefined): SpeechSynthesisVoice[] {
  if (!canReadAloud()) return [];
  const lang = (language || navigator.language || 'en').toLowerCase();
  const base = lang.split('-')[0];
  const voices = window.speechSynthesis.getVoices();
  const exact = voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === lang);
  const pool = exact.length ? exact : voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  return [...pool].sort((a, b) => voiceRank(b) - voiceRank(a));
}

/** The chosen voice (by name), else the most natural one for `language`, else `null` (the browser's choice). */
function pickVoice(language: string | undefined, name: string | undefined): SpeechSynthesisVoice | null {
  const chosen = name ? window.speechSynthesis.getVoices().find((v) => v.name === name) : undefined;
  return chosen ?? languageVoices(language)[0] ?? null;
}

/** End of the word that starts at `from` (when the browser does not say its length). */
const wordEnd = (text: string, from: number): number => {
  const next = text.slice(from).search(/\s/);
  return next === -1 ? text.length : from + next;
};

export interface ReadAloudCallbacks {
  /** A new page starts being read (index from `0`). */
  onPage(page: number): void;
  /** The word being spoken, as a match to highlight (with its position, to scroll to it). */
  onWord(word: LocatedMatch): void;
  /** Reading ended (last page read) or was stopped. */
  onEnd(): void;
}

/**
 * Reads `doc` from page `start` (from `0`) to the end. Returns the function that
 * stops it. Only one reading at a time: starting cancels anything being spoken.
 */
export function readAloud(
  doc: PdfDocument,
  start: number,
  language: string | undefined,
  voiceName: string | undefined,
  callbacks: ReadAloudCallbacks,
): () => void {
  const synth = window.speechSynthesis;
  let stopped = false;
  // Safari drops an utterance that nothing references (its `onend` never fires and
  // reading stalls): every utterance stays here until it ends.
  const alive = new Set<SpeechSynthesisUtterance>();
  // `cancel()` right before `speak()` makes Safari ignore the next utterance: only cancel when busy
  if (synth.speaking || synth.pending) synth.cancel();
  // Safari only lets a page speak from a user gesture. This runs inside the tap on
  // "read aloud", so a silent utterance unlocks the voice for the rest of the reading
  // (the real text is only ready after the page's text is read, outside the gesture).
  const unlock = new SpeechSynthesisUtterance(' ');
  unlock.volume = 0;
  synth.resume();
  synth.speak(unlock);

  const speakPiece = (page: number, text: PageText, itemTops: number[], piece: { start: number; text: string }) =>
    new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(piece.text);
      const voice = pickVoice(language, voiceName);
      if (voice) utterance.voice = voice;
      const lang = voice?.lang ?? language;
      if (lang) utterance.lang = lang;
      utterance.onboundary = (event) => {
        if (event.name && event.name !== 'word') return;
        const from = piece.start + event.charIndex;
        const to = event.charLength ? from + event.charLength : wordEnd(text.text, from);
        const parts = toParts(text, from, Math.min(to, text.text.length));
        if (parts.length) callbacks.onWord({ page, parts, top: itemTops[parts[0].item] ?? 0 });
      };
      const done = () => {
        alive.delete(utterance);
        resolve();
      };
      utterance.onend = done;
      utterance.onerror = done;
      alive.add(utterance);
      // Safari can be left "paused" after a previous cancel: resume before speaking
      synth.resume();
      synth.speak(utterance);
    });

  (async () => {
    for (let page = start; page < doc.pageCount && !stopped; page++) {
      const { content, itemTops } = await doc.text(page);
      const text = pageText(content.items as TextItemLike[], true);
      if (!text.text.trim() || stopped) continue;
      callbacks.onPage(page);
      for (const piece of pieces(text.text)) {
        if (stopped) break;
        await speakPiece(page, text, itemTops, piece);
      }
    }
  })()
    .catch(() => undefined)
    .finally(() => !stopped && callbacks.onEnd());

  return () => {
    if (stopped) return;
    stopped = true;
    synth.cancel();
    alive.clear();
    callbacks.onEnd();
  };
}
