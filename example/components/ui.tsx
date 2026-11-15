/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { engine } from 'omnistyle';
import { palette } from '../theme/presets';

// ───────────────────────── Layout ─────────────────────────

/** engine() sobre um componente de terceiros (não-RN). */
export const Screen = engine(SafeAreaView, ({ theme }) => ({
  flex: 1,
  backgroundColor: palette(theme).background,
}));

/**
 * Card: style dinâmico (theme) + `when` com style dentro dos attrs.
 * `flat` e `outlined` são props booleanas usadas como condição.
 */
export const Card = engine<'View', { flat?: boolean; accent?: boolean }>(
  'View',
  ({ theme }) => ({
    backgroundColor: palette(theme).surface,
    borderRadius: theme.borderRadius?.lg ?? 20,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: palette(theme).border,
    ...(theme.shadows?.md ?? {}),
  }),
);
Card.when('props:flat', {
  style: { shadowOpacity: 0, elevation: 0 },
});
Card.when(
  'props:accent',
  ({ theme }) =>
    ({
      style: {
        borderColor: theme.color.primary,
        borderLeftWidth: 4,
      },
    }) as any,
);

export const Row = engine<'View', { wrap?: boolean; between?: boolean }>(
  'View',
  ({ theme }) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  }),
);
Row.when('props:wrap', { style: { flexWrap: 'wrap' } });
Row.when('props:between', { style: { justifyContent: 'space-between' } });

// ───────────────────────── Tipografia ─────────────────────────

export const Title = engine('Text', ({ theme }) => ({
  fontSize: (theme.typography?.fontSize?.xl as number) ?? 26,
  fontWeight: (theme.typography?.fontWeight?.bold as any) ?? '800',
  color: theme.color.text,
  letterSpacing: -0.5,
}));

export const Heading = engine('Text', ({ theme }) => ({
  fontSize: (theme.typography?.fontSize?.lg as number) ?? 18,
  fontWeight: (theme.typography?.fontWeight?.bold as any) ?? '800',
  color: theme.color.text,
}));

export const Body = engine<'Text', { muted?: boolean; mono?: boolean }>(
  'Text',
  ({ theme, props }) => ({
    fontSize: (theme.typography?.fontSize?.md as number) ?? 15,
    lineHeight: 21,
    color: props.muted ? palette(theme).muted : theme.color.text,
  }),
);
Body.when('props:mono', { style: { fontFamily: 'Courier', fontSize: 12 } });

export const Caption = engine('Text', ({ theme }) => ({
  fontSize: (theme.typography?.fontSize?.xs as number) ?? 11,
  fontWeight: '700',
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  color: palette(theme).muted,
}));

// ───────────────────────── Botões ─────────────────────────

type Variant = 'primary' | 'secondary' | 'success' | 'warning' | 'error';
type Size = 'sm' | 'md' | 'lg';

const variantColor = (theme: EngineTheme, v: Variant = 'primary') =>
  (theme.color[v] as string) ?? theme.color.primary;

/**
 * Button: style por função + várias `when`:
 *  - 'outlined' (prop boolean)       - 'disabled' (prop boolean)
 *  - 'size:lg' / 'size:sm' (valor)   - função (ctx) => boolean
 *  - 'ios' / 'android' (plataforma)  - attrs() fixos (acessibilidade)
 */
export const Button = engine<
  'TouchableOpacity',
  { variant?: Variant; size?: Size; outlined?: boolean; pill?: boolean }
>('TouchableOpacity', ({ theme, props }) => ({
  backgroundColor: variantColor(theme, props.variant),
  borderWidth: 1.5,
  borderColor: variantColor(theme, props.variant),
  paddingVertical: theme.spacing.md,
  paddingHorizontal: theme.spacing.lg,
  borderRadius: theme.borderRadius?.md ?? 14,
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
  gap: theme.spacing.sm,
}));
Button.attrs({ accessibilityRole: 'button', activeOpacity: 0.75 });
Button.when('props:outlined', ({ theme, props }: any) => ({
  style: {
    backgroundColor: 'transparent',
    borderColor: variantColor(theme, props.variant),
  },
}));
Button.when('props:size=sm', { style: { paddingVertical: 6, paddingHorizontal: 12 } });
Button.when('props:size=lg', { style: { paddingVertical: 18 } });
Button.when('props:pill', ({ theme }: any) => ({
  style: { borderRadius: theme.borderRadius?.full ?? 999 },
}));
Button.when('props:disabled', { style: { opacity: 0.4 } });
Button.when('platform:ios', { style: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } } });
Button.when('platform:android', { style: { elevation: 2 } });

export const ButtonLabel = engine<
  'Text',
  { variant?: Variant; outlined?: boolean; size?: Size }
>('Text', ({ theme, props }) => ({
  color: props.outlined ? variantColor(theme, props.variant) : '#ffffff',
  fontWeight: '700',
  fontSize: props.size === 'sm' ? 13 : props.size === 'lg' ? 17 : 15,
}));

type BtnProps = React.ComponentProps<typeof Button> & { label: string };

/** Botão + rótulo já combinados. */
export const Btn = ({ label, ...rest }: BtnProps) => (
  <Button {...(rest as any)}>
    <ButtonLabel
      variant={(rest as any).variant}
      outlined={(rest as any).outlined}
      size={(rest as any).size}
    >
      {label}
    </ButtonLabel>
  </Button>
);

// ───────────────────────── Pills / Badges ─────────────────────────

export const Pill = engine<'TouchableOpacity', { active?: boolean }>(
  'TouchableOpacity',
  ({ theme }) => ({
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius?.full ?? 999,
    borderWidth: 1,
    borderColor: palette(theme).border,
    backgroundColor: 'transparent',
  }),
);
Pill.when('props:active', ({ theme }: any) => ({
  style: {
    backgroundColor: theme.color.primary,
    borderColor: theme.color.primary,
  },
}));

export const PillLabel = engine<'Text', { active?: boolean }>(
  'Text',
  ({ theme, props }) => ({
    fontSize: 13,
    fontWeight: '700',
    color: props.active ? '#fff' : theme.color.text,
  }),
);

export const Badge = engine<'View', { tone?: Variant | 'neutral' }>(
  'View',
  ({ theme, props }) => {
    const base =
      props.tone && props.tone !== 'neutral'
        ? variantColor(theme, props.tone)
        : palette(theme).muted;
    return {
      alignSelf: 'flex-start',
      paddingVertical: 3,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: base + '22',
    };
  },
);

export const BadgeText = engine<'Text', { tone?: Variant | 'neutral' }>(
  'Text',
  ({ theme, props }) => ({
    fontSize: 12,
    fontWeight: '800',
    color:
      props.tone && props.tone !== 'neutral'
        ? variantColor(theme, props.tone)
        : palette(theme).muted,
  }),
);

export const Divider = engine('View', ({ theme }) => ({
  height: 1,
  backgroundColor: palette(theme).border,
  marginVertical: theme.spacing.xs,
}));

// ───────────────────────── Inputs ─────────────────────────

export const Input = engine<'TextInput', { invalid?: boolean }>(
  'TextInput',
  ({ theme }) => ({
    backgroundColor: palette(theme).background,
    color: theme.color.text,
    borderWidth: 1.5,
    borderColor: palette(theme).border,
    borderRadius: theme.borderRadius?.md ?? 14,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: 15,
  }),
);
Input.attrs({ autoCapitalize: 'none', autoCorrect: false });
Input.when('props:invalid', ({ theme }: any) => ({
  style: { borderColor: theme.color.error },
}));

export const Bar = engine<'View', { value: number }>(
  'View',
  ({ theme, props }) => ({
    height: 10,
    borderRadius: 999,
    width: `${Math.max(0, Math.min(100, props.value))}%` as any,
    backgroundColor:
      props.value > 70 ? theme.color.success : props.value > 35 ? theme.color.warning : theme.color.error,
  }),
);

export const Track = engine('View', ({ theme }) => ({
  height: 10,
  borderRadius: 999,
  overflow: 'hidden',
  backgroundColor: palette(theme).border,
}));
