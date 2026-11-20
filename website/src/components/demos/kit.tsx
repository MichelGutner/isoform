/** Small building blocks shared by the examples (themselves built with Isoform). */
import { engine } from 'react-isoform';

export const Row = engine('Box', { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' });

export const Stack = engine('Box', { gap: 12 });

export const Button = engine<'Pressable', { variant?: 'primary' | 'ghost' }>('Pressable', ({ theme }) => ({
  paddingBlock: theme.spacing.sm,
  paddingInline: '1rem',
  borderRadius: 10,
  borderWidth: 1,
  borderColor: theme.color.primary,
  backgroundColor: theme.color.primary,
  alignSelf: 'flex-start',
}))
  .attrs({ role: 'button' })
  .when('props:variant=ghost', { style: { backgroundColor: 'transparent' } })
  .when('state:pressed', { style: { transform: 'scale(0.97)' } })
  .when('platform:web', { style: { cursor: 'pointer', transition: 'transform .1s' } });

export const ButtonText = engine<'Text', { ghost?: boolean }>('Text', { color: '#fff', fontWeight: '600', fontSize: 14 })
  .when('props:ghost', ({ theme }) => ({ style: { color: theme.color.primary } }));

export const Caption = engine('Text', ({ theme }) => ({ color: theme.color.muted, fontSize: 13 }));

/** URL of a file in the site's `public/demo/` folder (the examples' media). */
export const asset = (path: string): string => `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}demo/${path}`;
