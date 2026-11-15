import { sheet } from '../../css/sheet';

/**
 * CSS shared by the web `Video` and `Audio` players: icon buttons, the seek/volume
 * track, the speed menu and the spinner. Colors come from CSS variables, with the
 * dark "glass" video look as the default:
 * `--ov-fg`, `--ov-rail`, `--ov-buffer`, `--ov-hover`, `--ov-menu-bg`, `--ov-menu-fg`, `--ov-menu-hover`.
 * The audio card overrides them to follow the light/dark scheme.
 */
const RULES = [
  '.ov-btn{appearance:none;border:0;margin:0;padding:0;background:transparent;color:inherit;font:inherit;width:36px;height:36px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;pointer-events:auto;transition:background-color .15s ease,transform .15s ease}',
  '.ov-btn:active{transform:scale(.9)}',
  '.ov-btn:focus-visible{outline:2px solid var(--ov-fg,#fff);outline-offset:2px}',
  '.ov-btn svg{width:22px;height:22px;display:block}',
  '.ov-pill{width:auto;min-width:36px;padding:0 10px;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}',
  '@media (hover:hover){.ov-btn:hover{background-color:var(--ov-hover,rgba(255,255,255,.16))}}',
  '.ov-track{position:relative;height:18px;display:flex;align-items:center;cursor:pointer;touch-action:none;pointer-events:auto;outline:none}',
  '.ov-rail{position:relative;width:100%;height:4px;border-radius:999px;background-color:var(--ov-rail,rgba(255,255,255,.28));overflow:hidden;transition:height .15s ease}',
  '.ov-buffer,.ov-fill{position:absolute;left:0;top:0;bottom:0;border-radius:inherit}',
  '.ov-buffer{background-color:var(--ov-buffer,rgba(255,255,255,.35))}',
  '.ov-fill{background-color:var(--ov-fg,#fff)}',
  '.ov-thumb{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background-color:var(--ov-fg,#fff);box-shadow:0 1px 4px rgba(0,0,0,.4);transform:scale(0);transition:transform .15s ease}',
  '.ov-track[data-active] .ov-rail,.ov-track:focus-visible .ov-rail{height:6px}',
  '.ov-track[data-active] .ov-thumb,.ov-track:focus-visible .ov-thumb{transform:scale(1)}',
  '@media (hover:hover){.ov-track:hover .ov-rail{height:6px}.ov-track:hover .ov-thumb{transform:scale(1)}}',
  '.ov-tip{position:absolute;bottom:22px;transform:translateX(-50%);padding:3px 7px;border-radius:6px;background-color:rgba(0,0,0,.78);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none}',
  '.ov-volume{display:flex;align-items:center}',
  '.ov-volume-slot{width:0;opacity:0;overflow:hidden;transition:width .2s ease,opacity .2s ease}',
  '.ov-volume-slot .ov-track{width:64px;margin:0 8px}',
  '.ov-volume:hover .ov-volume-slot,.ov-volume:focus-within .ov-volume-slot{width:80px;opacity:1}',
  '.ov-menu-anchor{position:relative;display:flex}',
  `.ov-menu{position:absolute;right:0;bottom:calc(100% + 8px);min-width:150px;padding:6px;border-radius:14px;background-color:var(--ov-menu-bg,rgba(32,32,35,.88));color:var(--ov-menu-fg,#fff);-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);box-shadow:0 14px 40px rgba(0,0,0,.45);pointer-events:auto;animation:ov-pop .16s ease-out;transform-origin:bottom right}`,
  '.ov-menu-title{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;opacity:.55;padding:6px 10px 4px}',
  '.ov-menu-item{appearance:none;border:0;margin:0;background:transparent;color:inherit;font:inherit;font-size:14px;font-variant-numeric:tabular-nums;width:100%;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;text-align:left}',
  '.ov-menu-item:focus-visible{outline:2px solid var(--ov-fg,#fff);outline-offset:-2px}',
  '@media (hover:hover){.ov-menu-item:hover{background-color:var(--ov-menu-hover,rgba(255,255,255,.1))}}',
  '.ov-check{width:16px;display:inline-flex}',
  '.ov-check svg{width:14px;height:14px}',
  '@keyframes ov-pop{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:none}}',
  '.ov-spinner{position:absolute;left:50%;top:50%;width:42px;height:42px;margin:-21px 0 0 -21px;border-radius:50%;border:3px solid var(--ov-rail,rgba(255,255,255,.25));border-top-color:var(--ov-fg,#fff);animation:ov-spin .8s linear infinite;pointer-events:none}',
  '@keyframes ov-spin{to{transform:rotate(360deg)}}',
];

/** Inserts the shared player CSS (once, however many players are on screen). */
export function ensureControlStyles(): void {
  RULES.forEach((rule, i) => sheet.rule(`player-controls:${i}`, rule));
}
