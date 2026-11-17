import { sheet } from '../css/sheet';

/**
 * CSS of the web `BottomSheet`, inserted once (it also shows up in SSR).
 * The look defaults sit in `:where(...)` (zero specificity), so the component's
 * own style (`backgroundColor`, `borderRadius`, padding…) always wins.
 *
 * The visible height is the `--h` variable (px): the panel is translated down by
 * `100% - --h`, so dragging only touches `transform` (no layout per frame).
 */
const EASE = 'cubic-bezier(.32,.72,0,1)';

const RULES = [
  `.os{position:fixed;inset:auto 0 0 0;margin:0 auto;width:100%;max-width:min(640px,100%);max-height:calc(100dvh - 48px);padding:0;border:0;box-sizing:border-box;overflow:hidden;z-index:1000;transform:translateY(calc(100% - var(--h,0) * 1px));transition:transform 320ms ${EASE};touch-action:none;overscroll-behavior:contain;outline:none;will-change:transform}`,
  '.os[open]{display:flex;flex-direction:column}',
  '.os.os-dragging{transition:none;user-select:none;-webkit-user-select:none}',
  ':where(.os){background-color:#fff;color:#1c1c1e;border-radius:16px 16px 0 0;box-shadow:0 -8px 32px rgba(0,0,0,.12);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
  '@media (prefers-color-scheme:dark){:where(.os){background-color:#1c1c1e;color:#fff}}',
  // the keyboard (visualViewport) lifts it
  '.os{bottom:var(--kb,0px)}',
  // backdrop: fades with the sheet
  `.os::backdrop{background-color:rgba(0,0,0,0);transition:background-color 320ms ${EASE}}`,
  '.os.os-shown::backdrop{background-color:rgba(0,0,0,.32)}',
  // the handle, and a taller invisible area around it to grab
  '.os-grab{flex-shrink:0;display:flex;justify-content:center;padding:8px 0 4px;cursor:grab}',
  // neutral gray: readable on light and dark surfaces, whatever color the text has
  '.os-grab::before{content:"";width:36px;height:5px;border-radius:3px;background-color:rgba(128,128,128,.45)}',
  '.os.os-dragging .os-grab{cursor:grabbing}',
  '.os-body{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;box-sizing:border-box}',
  // content that fits: the whole sheet drags; scrolling content: drag from the handle (touch)
  '.os-body.os-scrolls{touch-action:pan-y}',
  '@media (prefers-reduced-motion:reduce){.os,.os::backdrop{transition:none}}',
];

/** Inserts the sheet CSS (once, however many sheets there are). */
export function ensureSheetStyles(): void {
  RULES.forEach((rule, i) => sheet.rule(`bottom-sheet:${i}`, rule));
}
