import { sheet } from '../../css/sheet';
import { ensureControlStyles } from '../shared/controlStyles';

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
  `.ov-glass{width:46px;height:46px;${GLASS}}`,
  '.ov-glass svg{width:26px;height:26px}',
  `.ov-big{width:64px;height:64px;${GLASS};box-shadow:0 10px 30px rgba(0,0,0,.25)}`,
  '.ov-big svg{width:30px;height:30px}',
  '@media (hover:hover){.ov-glass:hover,.ov-big:hover{background-color:rgba(60,60,64,.5)}}',

  // barra de baixo
  '.ov-bar{position:absolute;left:0;right:0;bottom:0;padding:0 12px 8px;display:flex;flex-direction:column;gap:2px}',
  '.ov-row{display:flex;align-items:center;gap:2px}',
  '.ov-spacer{flex:1}',
  '.ov-time{font-size:12.5px;font-variant-numeric:tabular-nums;opacity:.92;padding:0 8px;white-space:nowrap}',

  // trilho (progresso e volume)

  // volume: o trilho abre ao passar o mouse (ou com foco no teclado)

  // menu de velocidade

  // carregando
];

/** Insere o CSS do player (uma vez só, mesmo com vários vídeos na tela). */
export function ensureVideoStyles(): void {
  ensureControlStyles();
  RULES.forEach((rule, i) => sheet.rule(`video-ui:${i}`, rule));
}
