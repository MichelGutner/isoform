/* eslint-disable @typescript-eslint/no-explicit-any */
import { warnOnce } from '../../../core/dev';
import type { ApplyPropsInput } from '../../../core/adapter';
import { sheet } from '../css/sheet';
import { filterDomProps } from './domProps';
import { normalizeWebStyle } from './style';
import { flattenStyle } from '../../../core/flatten';

/** Nomes legados do RN → primitiva canônica. */
export const CANONICAL: Record<string, string> = {
  Box: 'Box',
  View: 'Box',
  Text: 'Text',
  Pressable: 'Pressable',
  TouchableOpacity: 'Pressable',
  TouchableHighlight: 'Pressable',
  TouchableWithoutFeedback: 'Pressable',
  Input: 'Input',
  TextInput: 'Input',
  Image: 'Image',
  Scroll: 'Scroll',
  ScrollView: 'Scroll',
  Video: 'Video',
  Audio: 'Audio',
  Pdf: 'Pdf',
};

/**
 * Defaults do RN reproduzidos na web (inseridos uma vez, com a MENOR prioridade).
 * `border-style:solid`: no RN `borderWidth` já desenha a borda; no CSS o padrão é `none`.
 */
const BASE: Record<string, string> = {
  Box: 'border-style:solid;border-width:0;display:flex;flex-direction:column;position:relative;box-sizing:border-box;min-width:0;min-height:0;flex-shrink:0',
  Text: 'border-style:solid;border-width:0;white-space:pre-wrap;overflow-wrap:break-word',
  Pressable:
    'border-style:solid;border-width:0;display:flex;flex-direction:column;position:relative;box-sizing:border-box;min-width:0;min-height:0;flex-shrink:0;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent',
  Input: 'border-style:solid;border-width:0;box-sizing:border-box;margin:0;padding:0;background-color:transparent;font:inherit;color:inherit;min-width:0',
  Image: 'border-style:solid;border-width:0;display:block;box-sizing:border-box;object-fit:cover;flex-shrink:0',
  Scroll:
    'border-style:solid;border-width:0;display:flex;flex-direction:column;position:relative;box-sizing:border-box;overflow-x:hidden;overflow-y:auto;min-width:0;min-height:0;flex-grow:1;flex-shrink:1',
  // vídeo: container dos controles (`position:relative`) que recorta as bordas arredondadas;
  // o `object-fit` daqui é herdado pelo `<video>` de dentro
  Video:
    'border-style:solid;border-width:0;display:block;position:relative;overflow:hidden;box-sizing:border-box;max-width:100%;background-color:#000;object-fit:contain;flex-shrink:0',
  // áudio: o cartão (`.oa`) define layout, borda e cores; aqui só o que não conflita com ele
  Audio: 'box-sizing:border-box;max-width:100%;flex-shrink:0',
  // PDF: the viewer (`.op`) defines layout and colors; a default height keeps the pages scrolling inside it
  Pdf: 'box-sizing:border-box;max-width:100%;height:420px;flex-shrink:0',
};

function baseClass(primitive: string): string {
  const cls = `o-${primitive.toLowerCase()}`;
  sheet.raw(`base:${primitive}`, cls, BASE[primitive], 0);
  if (primitive === 'Pressable') {
    sheet.raw('base:Pressable:disabled', cls, 'cursor:default', 0, '[aria-disabled="true"]');
  }
  return cls;
}

const INPUT_MODE: Record<string, string> = {
  default: 'text',
  'number-pad': 'numeric',
  'decimal-pad': 'decimal',
  numeric: 'numeric',
  'email-address': 'email',
  'phone-pad': 'tel',
  url: 'url',
};

/** Props só-mobile: removidas para não chegarem ao DOM. */
const NATIVE_ONLY_PROPS = [
  'hitSlop',
  'onLayout',
  'activeOpacity',
  'underlayColor',
  'keyboardShouldPersistTaps',
  'onLongPress',
  'collapsable',
  'pointerEvents',
];

/** `accessibilityLabel/Role/Hint/State` (RN) → `aria-*`/`role` (DOM). Valores já em `aria-*` vencem. */
function translateAccessibility(out: Record<string, any>): void {
  if ('accessibilityLabel' in out) {
    out['aria-label'] ??= out.accessibilityLabel;
    delete out.accessibilityLabel;
  }
  if ('accessibilityRole' in out) {
    out.role ??= out.accessibilityRole;
    delete out.accessibilityRole;
  }
  if ('accessibilityHint' in out) {
    out['aria-description'] ??= out.accessibilityHint;
    delete out.accessibilityHint;
  }
  if ('accessibilityState' in out) {
    const state = out.accessibilityState ?? {};
    for (const key of ['disabled', 'selected', 'checked', 'busy', 'expanded']) {
      if (state[key] !== undefined) out[`aria-${key}`] ??= state[key];
    }
    delete out.accessibilityState;
  }
}

/** `{ compiled }` produzido por `compileStyle` na web. */
interface Compiled {
  className: string;
}

export function applyWebProps({
  primitive,
  compiled,
  props,
  userStyle,
}: ApplyPropsInput): Record<string, any> {
  const out = props;
  const classes: string[] = [];
  const canon = primitive ? CANONICAL[primitive] : undefined;

  if (primitive && !canon) {
    // nome sem equivalente na web (Switch, Modal…) — o builder já trata o erro; aqui só por segurança
    warnOnce(`web-prim:${primitive}`, `"${primitive}" não existe na web.`);
  }

  if (canon) {
    classes.push(baseClass(canon));

    for (const name of NATIVE_ONLY_PROPS) if (name in out) delete out[name];
    translateAccessibility(out);

    if (out.testID !== undefined) {
      out['data-testid'] = out.testID;
      delete out.testID;
    }

    switch (canon) {
      case 'Text': {
        if (out.numberOfLines) {
          const n = out.numberOfLines;
          classes.push(
            sheet.raw(
              `clamp:${n}`,
              `o-clamp-${n}`,
              `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${n};overflow:hidden`,
              4,
            ),
          );
        }
        delete out.numberOfLines;
        break;
      }

      case 'Pressable': {
        const { onPress, disabled, onPressIn, onPressOut } = out;
        delete out.onPress;
        delete out.disabled;
        delete out.onPressIn;
        delete out.onPressOut;
        if (!disabled) {
          const chain = (name: string, handler: (e: any) => void) => {
            const user = out[name];
            out[name] = (e: any) => {
              user?.(e);
              handler(e);
            };
          };
          if (onPressIn) chain('onPointerDown', onPressIn);
          if (onPressOut) {
            chain('onPointerUp', onPressOut);
            chain('onPointerLeave', onPressOut);
            chain('onPointerCancel', onPressOut);
          }
        }
        out.role ??= 'button';
        if (disabled) {
          out['aria-disabled'] = true;
          out.tabIndex = -1;
        } else {
          out.tabIndex ??= 0;
          if (onPress) {
            const userKeyDown = out.onKeyDown;
            out.onClick = (e: any) => onPress(e);
            out.onKeyDown = (e: any) => {
              userKeyDown?.(e);
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPress(e);
              }
            };
          }
        }
        break;
      }

      case 'Input': {
        const { onChangeText, onSubmitEditing } = out;
        delete out.onChangeText;
        delete out.onSubmitEditing;

        if (onChangeText) {
          const userChange = out.onChange;
          out.onChange = (e: any) => {
            userChange?.(e);
            onChangeText(e.target.value);
          };
        }
        if (onSubmitEditing && !out.multiline) {
          const userKeyDown = out.onKeyDown;
          out.onKeyDown = (e: any) => {
            userKeyDown?.(e);
            if (e.key === 'Enter') onSubmitEditing(e);
          };
        }
        if (out.editable === false) out.readOnly = true;
        delete out.editable;
        if (out.secureTextEntry) out.type = 'password';
        delete out.secureTextEntry;
        if (out.keyboardType) {
          out.inputMode ??= INPUT_MODE[out.keyboardType] ?? out.keyboardType;
          delete out.keyboardType;
        }
        if (typeof out.autoCorrect === 'boolean') out.autoCorrect = out.autoCorrect ? 'on' : 'off';
        if (out.multiline && out.numberOfLines) out.rows = out.numberOfLines;
        delete out.numberOfLines;
        if (out.placeholderTextColor) {
          const color = out.placeholderTextColor;
          classes.push(
            sheet.raw(`ph:${color}`, `o-ph-${color.replace(/[^a-z0-9]/gi, '')}`, `color:${color};opacity:1`, 4, '::placeholder'),
          );
        }
        delete out.placeholderTextColor;
        break;
      }

      case 'Image': {
        if (out.src === undefined && out.source !== undefined) {
          const { source } = out;
          if (typeof source === 'string') out.src = source;
          else if (source && typeof source === 'object' && 'uri' in source) out.src = source.uri;
          else warnOnce('web-image-source', '`source` numérico (require) não é suportado na web; use `src`.');
        }
        delete out.source;
        out.alt ??= '';
        break;
      }

      default:
        break;
    }

    // props que só dirigem estilo (variant, outlined, wrap…) não podem chegar ao DOM
    filterDomProps(out, canon);
  }

  const c = compiled as Compiled;
  if (c?.className) classes.push(c.className);
  if (out.className) classes.push(out.className);
  if (classes.length) out.className = classes.join(' ');

  if (userStyle) out.style = normalizeWebStyle(flattenStyle(userStyle));

  return out;
}
