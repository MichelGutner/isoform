import { sheet } from '../css/sheet';

/**
 * CSS dos controles do `Video` na web. São regras fixas (não dependem de props),
 * inseridas uma única vez no mesmo `<style>` das classes atômicas — por isso
 * também saem no SSR via `getStyleText()`.
 *
 * Visual: vidro escuro com blur (como o player do iOS), ícones brancos, barra de
 * progresso que engrossa no hover e controles que somem sozinhos durante o play.
 */
const GLASS = 'background-color:rgba(20,20,22,.38);-webkit-backdrop-filter:blur(16px) saturate(170%);backdrop-filter:blur(16px) saturate(170%)';
const FONT = 'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

const RULES = [
  // vídeo: ocupa o container; `object-fit:inherit` deixa o `objectFit` do estilo valer
  '.ov-media{display:block;width:100%;height:100%;object-fit:inherit;background-color:#000}',
  '.ov[data-fullscreen]{border-radius:0}',

  // camada de interação (cobre o player inteiro e recebe o foco do teclado)
  `.ov-ui{position:absolute;inset:0;outline:none;color:#fff;${FONT};user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}`,
  '.ov-ui:focus-visible{box-shadow:inset 0 0 0 3px rgba(10,132,255,.7)}',
  '.ov-ui[data-idle]{cursor:none}',
  '.ov-hit{position:absolute;inset:0}',

  '.ov-layer{position:absolute;inset:0;pointer-events:none;transition:opacity .25s ease}',
  '.ov-layer[data-hidden]{opacity:0}',
  '.ov-layer[data-hidden] *{pointer-events:none!important}',
  '.ov-scrim{position:absolute;left:0;right:0;bottom:0;height:min(150px,65%);background:linear-gradient(to top,rgba(0,0,0,.7),rgba(0,0,0,.28) 50%,transparent)}',

  // centro: −10s · play/pause · +10s
  '.ov-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:clamp(16px,6%,40px)}',

  // botões
  '.ov-btn{appearance:none;border:0;margin:0;padding:0;background:transparent;color:inherit;font:inherit;width:36px;height:36px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;pointer-events:auto;transition:background-color .15s ease,transform .15s ease}',
  '.ov-btn:active{transform:scale(.9)}',
  '.ov-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}',
  '.ov-btn svg{width:22px;height:22px;display:block}',
  `.ov-glass{width:46px;height:46px;${GLASS}}`,
  '.ov-glass svg{width:26px;height:26px}',
  `.ov-big{width:64px;height:64px;${GLASS};box-shadow:0 10px 30px rgba(0,0,0,.25)}`,
  '.ov-big svg{width:30px;height:30px}',
  '.ov-pill{width:auto;min-width:36px;padding:0 10px;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}',
  '@media (hover:hover){.ov-btn:hover{background-color:rgba(255,255,255,.16)}.ov-glass:hover,.ov-big:hover{background-color:rgba(60,60,64,.5)}}',

  // barra de baixo
  '.ov-bar{position:absolute;left:0;right:0;bottom:0;padding:0 12px 8px;display:flex;flex-direction:column;gap:2px}',
  '.ov-row{display:flex;align-items:center;gap:2px}',
  '.ov-spacer{flex:1}',
  '.ov-time{font-size:12.5px;font-variant-numeric:tabular-nums;opacity:.92;padding:0 8px;white-space:nowrap}',

  // trilho (progresso e volume)
  '.ov-track{position:relative;height:18px;display:flex;align-items:center;cursor:pointer;touch-action:none;pointer-events:auto;outline:none}',
  '.ov-rail{position:relative;width:100%;height:4px;border-radius:999px;background-color:rgba(255,255,255,.28);overflow:hidden;transition:height .15s ease}',
  '.ov-buffer,.ov-fill{position:absolute;left:0;top:0;bottom:0;border-radius:inherit}',
  '.ov-buffer{background-color:rgba(255,255,255,.35)}',
  '.ov-fill{background-color:#fff}',
  '.ov-thumb{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background-color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:scale(0);transition:transform .15s ease}',
  '.ov-track[data-active] .ov-rail,.ov-track:focus-visible .ov-rail{height:6px}',
  '.ov-track[data-active] .ov-thumb,.ov-track:focus-visible .ov-thumb{transform:scale(1)}',
  '@media (hover:hover){.ov-track:hover .ov-rail{height:6px}.ov-track:hover .ov-thumb{transform:scale(1)}}',
  '.ov-tip{position:absolute;bottom:22px;transform:translateX(-50%);padding:3px 7px;border-radius:6px;background-color:rgba(0,0,0,.78);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none}',

  // volume: o trilho abre ao passar o mouse (ou com foco no teclado)
  '.ov-volume{display:flex;align-items:center}',
  '.ov-volume-slot{width:0;opacity:0;overflow:hidden;transition:width .2s ease,opacity .2s ease}',
  '.ov-volume-slot .ov-track{width:64px;margin:0 8px}',
  '.ov-volume:hover .ov-volume-slot,.ov-volume:focus-within .ov-volume-slot{width:80px;opacity:1}',

  // menu de velocidade
  '.ov-menu-anchor{position:relative;display:flex}',
  `.ov-menu{position:absolute;right:0;bottom:calc(100% + 8px);min-width:150px;padding:6px;border-radius:14px;background-color:rgba(32,32,35,.88);-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);box-shadow:0 14px 40px rgba(0,0,0,.45);pointer-events:auto;animation:ov-pop .16s ease-out;transform-origin:bottom right}`,
  '.ov-menu-title{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;opacity:.55;padding:6px 10px 4px}',
  '.ov-menu-item{appearance:none;border:0;margin:0;background:transparent;color:inherit;font:inherit;font-size:14px;font-variant-numeric:tabular-nums;width:100%;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;text-align:left}',
  '.ov-menu-item:focus-visible{outline:2px solid #fff;outline-offset:-2px}',
  '@media (hover:hover){.ov-menu-item:hover{background-color:rgba(255,255,255,.1)}}',
  '.ov-check{width:16px;display:inline-flex}',
  '.ov-check svg{width:14px;height:14px}',
  '@keyframes ov-pop{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:none}}',

  // carregando
  '.ov-spinner{position:absolute;left:50%;top:50%;width:42px;height:42px;margin:-21px 0 0 -21px;border-radius:50%;border:3px solid rgba(255,255,255,.25);border-top-color:#fff;animation:ov-spin .8s linear infinite;pointer-events:none}',
  '@keyframes ov-spin{to{transform:rotate(360deg)}}',
];

/** Insere o CSS do player (uma vez só, mesmo com vários vídeos na tela). */
export function ensureVideoStyles(): void {
  RULES.forEach((rule, i) => sheet.rule(`video-ui:${i}`, rule));
}
