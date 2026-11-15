import { sheet } from '../../css/sheet';
import { ensureControlStyles } from '../shared/controlStyles';

/**
 * CSS of the web `Pdf` viewer. Fixed rules, inserted once into the same `<style>`
 * as the atomic classes (so they also show up in SSR).
 *
 * Look: colorless, like the media players: a toolbar, a gray reading area with
 * white pages, and a thumbnails panel. It follows the light/dark scheme
 * (`color-scheme` or the OS setting). Colors are CSS variables a parent can
 * override: `--op-bar`, `--op-fg`, `--op-muted`, `--op-border`, `--op-canvas`,
 * `--op-field`, `--op-match`, `--op-match-current`.
 */
const FONT = 'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

const LIGHT =
  '--op-bar:#fff;--op-fg:#1c1c1e;--op-muted:#6e6e73;--op-border:rgba(0,0,0,.1);--op-canvas:#ececf0;--op-field:rgba(120,120,128,.12);' +
  '--ov-fg:#1c1c1e;--ov-rail:rgba(60,60,67,.18);--ov-buffer:rgba(60,60,67,.18);--ov-hover:rgba(60,60,67,.1);' +
  '--ov-menu-bg:rgba(255,255,255,.94);--ov-menu-fg:#1c1c1e;--ov-menu-hover:rgba(60,60,67,.08)';
const DARK =
  '--op-bar:#1c1c1e;--op-fg:#fff;--op-muted:#98989f;--op-border:rgba(255,255,255,.12);--op-canvas:#0f0f10;--op-field:rgba(118,118,128,.24);' +
  '--ov-fg:#fff;--ov-rail:rgba(235,235,245,.2);--ov-buffer:rgba(235,235,245,.2);--ov-hover:rgba(255,255,255,.12);' +
  '--ov-menu-bg:rgba(44,44,46,.94);--ov-menu-fg:#fff;--ov-menu-hover:rgba(255,255,255,.1)';

/** pdf.js text layer (from `pdfjs-dist/web/pdf_viewer.css`): invisible, selectable text over the canvas. */
const TEXT_LAYER = [
  '.op .textLayer{position:absolute;text-align:initial;inset:0;overflow:clip;opacity:1;line-height:1;-webkit-text-size-adjust:none;text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0;caret-color:CanvasText;z-index:0;--min-font-size:1;--text-scale-factor:calc(var(--total-scale-factor) * var(--min-font-size));--min-font-size-inv:calc(1 / var(--min-font-size))}',
  '.op .textLayer :is(span,br){color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0% 0%}',
  '.op .textLayer > :not(.markedContent),.op .textLayer .markedContent span:not(.markedContent){z-index:1;--font-height:0;font-size:calc(var(--text-scale-factor) * var(--font-height));--scale-x:1;--rotate:0deg;transform:rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv))}',
  '.op .textLayer .markedContent{display:contents}',
  '.op .textLayer span[role="img"]{user-select:none;cursor:default}',
  '.op .textLayer ::selection{background:rgba(0,122,255,.3)}',
  '.op .textLayer br::selection{background:transparent}',
  '.op .textLayer .endOfContent{display:block;position:absolute;inset:100% 0 0;z-index:0;cursor:default;user-select:none}',
  '.op .textLayer.selecting .endOfContent{top:0}',
];

const RULES = [
  `.op{${LIGHT};position:relative;box-sizing:border-box;display:flex;flex-direction:column;min-height:0;overflow:hidden;border-radius:16px;border:1px solid var(--op-border);background-color:var(--op-canvas);color:var(--op-fg);${FONT};outline:none;-webkit-tap-highlight-color:transparent}`,
  `@media (prefers-color-scheme:dark){.op{${DARK}}}`,
  `.op[data-scheme=dark]{${DARK}}`,
  `.op[data-scheme=light]{${LIGHT}}`,
  '.op:focus-visible{box-shadow:0 0 0 3px rgba(10,132,255,.55)}',

  // toolbar
  '.op-bar{position:relative;z-index:3;flex:0 0 auto;display:flex;align-items:center;gap:2px;height:48px;padding:0 8px;box-sizing:border-box;background-color:var(--op-bar);border-bottom:1px solid var(--op-border);user-select:none;-webkit-user-select:none}',
  '.op-bar .ov-btn{width:38px;height:38px}',
  '.op-bar .ov-btn[aria-pressed=true]{background-color:var(--ov-hover)}',
  '.op-bar .ov-btn:disabled{opacity:.35;cursor:default}',
  '.op-spacer{flex:1 1 auto;min-width:4px}',
  '.op-page-label{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}',
  '.op-page-input{width:3.2em;height:30px;box-sizing:border-box;border:0;border-radius:8px;padding:0 6px;text-align:center;font:inherit;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;color:inherit;background-color:var(--op-field);outline:none}',
  '.op-page-input:focus-visible{box-shadow:0 0 0 2px rgba(10,132,255,.55)}',
  '.op-total{font-size:13px;color:var(--op-muted);font-variant-numeric:tabular-nums;white-space:nowrap;margin-right:4px}',
  '.op-zoom{font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;min-width:3.4em;text-align:center;color:var(--op-muted)}',

  // search bar (replaces the toolbar while open)
  '.op-field{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:6px;height:34px;padding:0 10px;border-radius:10px;background-color:var(--op-field);color:var(--op-muted)}',
  '.op-field svg{width:18px;height:18px;flex:0 0 auto}',
  '.op-field input{flex:1 1 auto;min-width:0;border:0;background:transparent;font:inherit;font-size:14px;color:var(--op-fg);outline:none}',
  '.op-field input::-webkit-search-cancel-button{display:none}',
  '.op-count{font-size:12px;font-variant-numeric:tabular-nums;color:var(--op-muted);white-space:nowrap}',

  // reading area
  '.op-body{position:relative;flex:1 1 auto;min-height:0;display:flex}',
  '.op-scroll{position:relative;flex:1 1 auto;min-width:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-x pan-y}',
  '.op-pages{position:relative;margin:0 auto;box-sizing:content-box;padding:16px}',
  // side by side: the scroll stops on each page (not while zoomed in, to move around freely)
  '.op[data-direction=horizontal] .op-scroll{scroll-snap-type:x mandatory}',
  '.op[data-direction=horizontal][data-zoomed] .op-scroll{scroll-snap-type:none}',
  '.op[data-direction=horizontal] .op-page{scroll-snap-align:center;scroll-snap-stop:always}',
  '.op-page{position:absolute;left:16px;background-color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12),0 6px 20px rgba(0,0,0,.08);border-radius:2px;overflow:hidden;--user-unit:1;--total-scale-factor:calc(var(--scale-factor) * var(--user-unit));--scale-round-x:1px;--scale-round-y:1px}',
  '.op-page canvas{position:absolute;inset:0;width:100%;height:100%;display:block}',
  '.op[data-night] .op-page{background-color:#000}',
  '.op[data-night] .op-page canvas,.op[data-night] .op-thumb canvas{filter:invert(1) hue-rotate(180deg)}',
  '.op-hl{position:absolute;z-index:2;pointer-events:none;border-radius:2px;background-color:var(--op-match,rgba(255,204,0,.42));mix-blend-mode:multiply}',
  '.op[data-night] .op-hl{mix-blend-mode:screen}',
  '.op-hl[data-current]{background-color:var(--op-match-current,rgba(255,149,0,.7));box-shadow:0 0 0 2px rgba(255,149,0,.9)}',
  '.op-hl[data-reading]{background-color:var(--op-reading,rgba(0,122,255,.28));box-shadow:none;transition:left .08s ease,top .08s ease,width .08s ease}',
  // fullscreen: the browser's own, or (iPhone Safari, which only does it for videos) a fixed layer
  '.op:fullscreen{border-radius:0;border:0;width:100%;height:100%}',
  '.op[data-fullscreen]{position:fixed;inset:0;z-index:2147483646;width:100vw;height:100vh;height:100dvh;max-width:none;border-radius:0;border:0}',
  '.op-link{position:absolute;z-index:3;display:block;cursor:pointer;border-radius:2px}',
  '@media (hover:hover){.op-link:hover{background-color:rgba(10,132,255,.12)}}',

  // thumbnails panel
  '.op-thumbs{flex:0 0 auto;width:132px;box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain;padding:12px 10px;display:flex;flex-direction:column;align-items:center;gap:12px;background-color:var(--op-bar);border-right:1px solid var(--op-border)}',
  '@media (max-width:560px){.op-thumbs{position:absolute;z-index:2;top:0;bottom:0;left:0;box-shadow:8px 0 24px rgba(0,0,0,.18)}}',
  '.op-thumb{appearance:none;border:0;margin:0;padding:0;background:transparent;color:inherit;font:inherit;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;flex:0 0 auto}',
  '.op-thumb-frame{position:relative;width:96px;background-color:#fff;border-radius:3px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.18);outline:2px solid transparent;outline-offset:2px;transition:outline-color .15s ease}',
  '.op[data-night] .op-thumb-frame{background-color:#000}',
  '.op-thumb[aria-current=page] .op-thumb-frame{outline-color:var(--op-fg)}',
  '.op-thumb:focus-visible .op-thumb-frame{outline-color:rgba(10,132,255,.8)}',
  '.op-thumb span{font-size:11px;font-variant-numeric:tabular-nums;color:var(--op-muted)}',
  '.op-thumb[aria-current=page] span{color:var(--op-fg);font-weight:600}',

  // menus (more options and table of contents) open below the toolbar
  '.op .ov-menu{bottom:auto;top:calc(100% + 6px);transform-origin:top right;max-height:min(60vh,420px);overflow-y:auto;min-width:200px}',
  '.op-outline .ov-menu-item{white-space:normal;line-height:1.3}',
  '.op-menu-divider{height:1px;margin:6px 4px;background-color:var(--ov-rail)}',
  '.op .ov-menu-item svg{width:18px;height:18px;flex:0 0 auto}',

  // status: loading, error and password prompt
  '.op-status{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;box-sizing:border-box;text-align:center;font-size:14px;color:var(--op-muted)}',
  '.op-status svg{width:32px;height:32px;color:var(--op-fg)}',
  '.op-status form{display:flex;gap:8px;width:min(320px,100%)}',
  '.op-status input{flex:1 1 auto;min-width:0;height:38px;box-sizing:border-box;border:0;border-radius:10px;padding:0 12px;font:inherit;font-size:14px;color:var(--op-fg);background-color:var(--op-field);outline:none}',
  '.op-status input:focus-visible{box-shadow:0 0 0 2px rgba(10,132,255,.55)}',
  '.op-status button{appearance:none;border:0;height:38px;padding:0 14px;border-radius:10px;font:inherit;font-size:14px;font-weight:600;color:var(--op-bar);background-color:var(--op-fg);cursor:pointer}',
  '.op-status .op-error{color:#ff453a}',
  '.op-spinner{width:28px;height:28px;border-radius:50%;border:3px solid var(--ov-rail);border-top-color:var(--op-fg);animation:ov-spin .8s linear infinite}',
  ...TEXT_LAYER,
];

/** Inserts the CSS of the PDF viewer (once, however many viewers are on screen). */
export function ensurePdfStyles(): void {
  ensureControlStyles();
  RULES.forEach((rule, i) => sheet.rule(`pdf-ui:${i}`, rule));
}
