/**
 * Props de componentes omnistyle servem também para dirigir estilo
 * (`<Button variant="primary" outlined />`). No RN elas chegam ao componente e
 * são ignoradas; no DOM viram atributos inválidos e geram warnings do React.
 * Por isso, nas primitivas, só repassamos o que é válido para o elemento.
 */

const GLOBAL = [
  'id', 'className', 'style', 'role', 'tabIndex', 'title', 'lang', 'dir', 'hidden', 'draggable',
  'slot', 'translate', 'spellCheck', 'contentEditable', 'inert', 'accessKey', 'enterKeyHint',
  'inputMode', 'autoFocus', 'nonce', 'is', 'part', 'popover',
  'itemID', 'itemProp', 'itemRef', 'itemScope', 'itemType',
  'children', 'dangerouslySetInnerHTML', 'suppressContentEditableWarning', 'suppressHydrationWarning',
  'key', 'ref',
];

const INPUT = [
  'type', 'value', 'defaultValue', 'checked', 'defaultChecked', 'placeholder', 'readOnly', 'disabled',
  'name', 'min', 'max', 'step', 'pattern', 'required', 'autoComplete', 'autoCapitalize', 'autoCorrect',
  'maxLength', 'minLength', 'multiple', 'rows', 'cols', 'wrap', 'form', 'list', 'size', 'accept',
  'capture', 'dirName', 'formAction', 'formMethod', 'formNoValidate', 'formTarget',
  // consumidas pelo próprio componente `Input`
  'multiline',
];

const IMAGE = [
  'src', 'srcSet', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding', 'crossOrigin',
  'referrerPolicy', 'useMap', 'fetchPriority',
];

const SCROLL = [
  // consumidas pelo próprio componente `Scroll`
  'horizontal', 'contentContainerStyle', 'showsVerticalScrollIndicator', 'showsHorizontalScrollIndicator',
];

// consumidas pelo próprio componente de vídeo (que traduz para o elemento)
const PLAYBACK = ['src', 'autoPlay', 'loop', 'muted', 'rate', 'volume', 'controls'];

// listas (`items`) com carrossel, aceitas por Video, Audio e Pdf
const PLAYLIST = ['items', 'initialIndex', 'carousel', 'autoAdvance'];

const ALLOWED: Record<string, Set<string>> = {
  Box: new Set(GLOBAL),
  Text: new Set(GLOBAL),
  Pressable: new Set(GLOBAL),
  Input: new Set([...GLOBAL, ...INPUT]),
  Image: new Set([...GLOBAL, ...IMAGE]),
  Scroll: new Set([...GLOBAL, ...SCROLL]),
  Video: new Set([...GLOBAL, ...PLAYBACK, ...PLAYLIST, 'poster']),
  Audio: new Set([...GLOBAL, ...PLAYBACK, ...PLAYLIST, 'title', 'artist', 'artwork']),
  BottomSheet: new Set([...GLOBAL, 'open', 'detents', 'detent', 'dismissible', 'modal', 'grabber', 'label']),
  Pdf: new Set([...GLOBAL, ...PLAYLIST, 'src', 'password', 'initialPage', 'controls', 'nightMode', 'fit', 'direction', 'maxZoom', 'speechLanguage', 'speechVoice']),
};

const ALWAYS = /^(data-|aria-|on[A-Z])/;

/** Remove (in place) as props que não são válidas para o elemento da primitiva. */
export function filterDomProps(props: Record<string, unknown>, primitive: string): void {
  const allowed = ALLOWED[primitive];
  if (!allowed) return;
  for (const key in props) {
    if (!allowed.has(key) && !ALWAYS.test(key)) delete props[key];
  }
}
