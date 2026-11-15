import { engine, keyframes } from 'omnistyle';

/**
 * Biblioteca de componentes ESCRITA UMA VEZ: só importa de 'omnistyle'
 * (nada de react-native nem react-dom) e usa as primitivas neutras.
 */

/** Troca de tema suave: ao chamar `updateTheme`, cores animam em vez de pular (CSS na web, Animated no mobile). */
/** Mesma duração e curva da bolha (ThemeBubble): as cores trocam junto com ela, nas duas plataformas. */
const FADE = ['background-color', 'border-color', 'color'].map((p) => `${p} 550ms cubic-bezier(0.4, 0, 0.2, 1)`).join(', ');

/** `transition` de troca de tema; `extra` acrescenta outras propriedades (ex.: `opacity 150ms`). */
export const themeFade = (extra = ''): string => (extra ? `${FADE}, ${extra}` : FADE);

export const Screen = engine('Scroll', ({ theme }) => ({
  transition: themeFade(),
  backgroundColor: theme.color.background,
  flexGrow: 1,
}));

export const Card = engine<'Box', { flat?: boolean; accent?: boolean }>(
  'Box',
  ({ theme }) => ({
    backgroundColor: theme.color.surface,
    transition: themeFade(),
    borderRadius: theme.borderRadius?.lg ?? 20,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
  }),
)
  .when('props:flat', { style: { boxShadow: 'none' } })
  .when('props:accent', ({ theme }) => ({
    style: { borderColor: theme.color.primary, borderLeftWidth: 4 },
  }));

export const Row = engine<'Box', { wrap?: boolean; between?: boolean }>('Box', ({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing.sm,
}))
  .when('props:wrap', { style: { flexWrap: 'wrap' } })
  .when('props:between', { style: { justifyContent: 'space-between' } });

export const Title = engine('Text', ({ theme }) => ({
  transition: themeFade(),
  fontSize: theme.typography?.fontSize?.xl ?? 26,
  fontWeight: '800',
  color: theme.color.text,
  letterSpacing: -0.5,
}));

export const Heading = engine('Text', ({ theme }) => ({
  transition: themeFade(),
  fontSize: theme.typography?.fontSize?.lg ?? 18,
  fontWeight: '800',
  color: theme.color.text,
}));

export const Body = engine<'Text', { muted?: boolean }>('Text', ({ theme, props }) => ({
  transition: themeFade(),
  fontSize: theme.typography?.fontSize?.md ?? 15,
  lineHeight: '1.4', // multiplicador (como no CSS): 1.4 × fontSize nas duas plataformas
  color: props.muted ? theme.color.muted : theme.color.text,
}));

type Variant = 'primary' | 'secondary' | 'success' | 'warning' | 'error';
const variantColor = (theme: EngineTheme, v: Variant = 'primary') =>
  (theme.color[v] as string | undefined) ?? theme.color.primary;

export const Button = engine<
  'Pressable',
  { variant?: Variant; size?: 'sm' | 'md' | 'lg'; outlined?: boolean }
>('Pressable', ({ theme, props }) => ({
  backgroundColor: variantColor(theme, props.variant),
  borderWidth: 1.5,
  transition: themeFade('opacity 150ms, transform 100ms'),
  borderColor: variantColor(theme, props.variant),
  paddingBlock: theme.spacing.sm,
  paddingInline: '1.25rem', // rem funciona nas duas plataformas
  borderRadius: theme.borderRadius?.md ?? 14,
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
  gap: theme.spacing.sm,
}))
  .attrs({ role: 'button' })
  .when('props:outlined', ({ theme, props }) => ({
    style: { backgroundColor: 'transparent', borderColor: variantColor(theme, props.variant) },
  }))
  .when('props:size=sm', { style: { paddingBlock: 6, paddingInline: '0.75rem' } })
  .when('props:size=lg', { style: { paddingBlock: 16 } })
  .when('props:disabled', { style: { opacity: 0.4 } })
  // estados de interação: :hover/:active na web, estado do Pressable no mobile
  .when('state:hover', { style: { opacity: 0.85 } })
  .when('state:pressed', { style: { transform: 'scale(0.97)' } })
  // escape hatches por plataforma
  .when('platform:web', { style: { cursor: 'pointer' } })
  .when('platform:native', { style: { elevation: 1 } });

export const ButtonLabel = engine<'Text', { outlined?: boolean; variant?: Variant }>(
  'Text',
  ({ theme, props }) => ({
    transition: themeFade(),
    color: props.outlined ? variantColor(theme, props.variant) : '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  }),
);

export const Field = engine<'Input', { invalid?: boolean }>('Input', ({ theme }) => ({
  transition: themeFade(),
  backgroundColor: theme.color.background,
  color: theme.color.text,
  borderWidth: 1.5,
  borderColor: theme.color.border,
  borderRadius: theme.borderRadius?.md ?? 14,
  paddingBlock: theme.spacing.md,
  paddingInline: theme.spacing.md,
  fontSize: 15,
}))
  .when('state:focus', ({ theme }) => ({ style: { borderColor: theme.color.primary } }))
  .when('props:invalid', ({ theme }) => ({ style: { borderColor: theme.color.error } }));

const pulse = keyframes({
  from: { opacity: 1, transform: 'scale(1)' },
  to: { opacity: 0.35, transform: 'scale(0.8)' },
});

export const PulseDot = engine('Box', ({ theme }) => ({
  width: 14,
  height: 14,
  borderRadius: 7,
  backgroundColor: theme.color.success,
  animation: `${pulse} 900ms ease-in-out infinite alternate`,
}));

export const Chip = engine<'Pressable', { active?: boolean }>('Pressable', ({ theme }) => ({
  transition: themeFade(),
  paddingBlock: 6,
  paddingInline: theme.spacing.md,
  borderRadius: theme.borderRadius?.full ?? 999,
  borderWidth: 1,
  borderColor: theme.color.border,
  backgroundColor: 'transparent',
})).when('props:active', ({ theme }) => ({
  style: { backgroundColor: theme.color.primary, borderColor: theme.color.primary },
}));

export const ChipLabel = engine<'Text', { active?: boolean }>('Text', ({ theme, props }) => ({
  transition: themeFade(),
  fontSize: 13,
  fontWeight: '700',
  color: props.active ? '#ffffff' : theme.color.text,
}));

export const Badge = engine<'Box', { tone?: Variant }>('Box', ({ theme, props }) => ({
  transition: themeFade(),
  alignSelf: 'flex-start',
  paddingBlock: 3,
  paddingInline: 10,
  borderRadius: 999,
  backgroundColor: variantColor(theme, props.tone) + '22',
}));

export const BadgeText = engine<'Text', { tone?: Variant }>('Text', ({ theme, props }) => ({
  transition: themeFade(),
  fontSize: 12,
  fontWeight: '800',
  color: variantColor(theme, props.tone),
}));
