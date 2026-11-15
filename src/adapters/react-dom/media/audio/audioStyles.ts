import { sheet } from '../../css/sheet';
import { ensureControlStyles } from '../shared/controlStyles';

/**
 * CSS of the web `Audio` card. Fixed rules, inserted once into the same
 * `<style>` as the atomic classes (so they also show up in SSR).
 *
 * Look: a rounded card that follows the light/dark scheme (`color-scheme` or the
 * OS setting), a cover with a gradient fallback, a filled play button and the
 * shared seek track. Colors are CSS variables, so a parent can override them:
 * `--oa-bg`, `--oa-fg`, `--oa-muted`, `--oa-accent`, `--oa-accent-fg`.
 */
const FONT = 'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

const LIGHT =
  '--oa-bg:#fff;--oa-fg:#1c1c1e;--oa-muted:#6e6e73;--oa-accent:#0a84ff;--oa-accent-fg:#fff;--oa-border:rgba(0,0,0,.08);' +
  '--ov-fg:#1c1c1e;--ov-rail:rgba(60,60,67,.18);--ov-buffer:rgba(60,60,67,.18);--ov-hover:rgba(60,60,67,.1);' +
  '--ov-menu-bg:rgba(255,255,255,.92);--ov-menu-fg:#1c1c1e;--ov-menu-hover:rgba(60,60,67,.08)';
const DARK =
  '--oa-bg:#1c1c1e;--oa-fg:#fff;--oa-muted:#98989f;--oa-accent:#0a84ff;--oa-accent-fg:#fff;--oa-border:rgba(255,255,255,.1);' +
  '--ov-fg:#fff;--ov-rail:rgba(235,235,245,.2);--ov-buffer:rgba(235,235,245,.2);--ov-hover:rgba(255,255,255,.12);' +
  '--ov-menu-bg:rgba(44,44,46,.92);--ov-menu-fg:#fff;--ov-menu-hover:rgba(255,255,255,.1)';

const RULES = [
  `.oa{${LIGHT};position:relative;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:20px;background-color:var(--oa-bg);color:var(--oa-fg);border:1px solid var(--oa-border);box-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.06);${FONT};outline:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}`,
  `@media (prefers-color-scheme:dark){.oa{${DARK}}}`,
  `.oa[data-scheme=dark]{${DARK}}`,
  `.oa[data-scheme=light]{${LIGHT}}`,
  '.oa:focus-visible{box-shadow:0 0 0 3px rgba(10,132,255,.55)}',
  '.oa-media{display:none}',

  // topo: capa, título/artista e velocidade
  '.oa-head{display:flex;align-items:center;gap:12px;min-width:0}',
  '.oa-art{position:relative;flex:0 0 auto;width:56px;height:56px;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,#5e5ce6,#0a84ff 55%,#64d2ff);box-shadow:0 2px 8px rgba(10,132,255,.25)}',
  '.oa-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
  '.oa-art svg{width:26px;height:26px}',
  '.oa-meta{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}',
  '.oa-title{font-size:15px;font-weight:600;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.oa-artist{font-size:13px;line-height:1.25;color:var(--oa-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',

  // tempos sob a barra
  '.oa-times{display:flex;justify-content:space-between;font-size:12px;font-variant-numeric:tabular-nums;color:var(--oa-muted);margin-top:-4px}',

  // controles
  '.oa-controls{display:flex;align-items:center;gap:6px}',
  '.oa-spacer{flex:1}',
  '.oa-play{width:52px;height:52px;background-color:var(--oa-accent);color:var(--oa-accent-fg);box-shadow:0 6px 16px rgba(10,132,255,.35)}',
  '.oa-play svg{width:26px;height:26px}',
  '@media (hover:hover){.oa-play:hover{background-color:var(--oa-accent);filter:brightness(1.08)}}',
  '.oa-skip{width:42px;height:42px}',
  '.oa-skip svg{width:26px;height:26px}',
  '.oa-wait{position:absolute;inset:-3px;border-radius:50%;border:3px solid rgba(255,255,255,.35);border-top-color:#fff;animation:ov-spin .8s linear infinite;pointer-events:none}',
  '.oa-play{position:relative}',
  '.oa .ov-volume-slot .ov-track{width:72px}',
  '.oa .ov-menu{bottom:auto;top:calc(100% + 8px);transform-origin:top right}',
];

/** Inserts the CSS of the audio card (once, however many players are on screen). */
export function ensureAudioStyles(): void {
  ensureControlStyles();
  RULES.forEach((rule, i) => sheet.rule(`audio-ui:${i}`, rule));
}
