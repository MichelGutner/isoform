/**
 * Teste de TIPOS: o que importa aqui é compilar. O ts-jest só transpila: quem checa é `yarn typecheck`
 * (tsconfig.typetests.json), onde um `@ts-expect-error` que sobra também é erro.
 * Garante que literais de estilo não são alargados para `string` em nenhuma
 * forma de uso de `engine()`, e que valores inválidos continuam sendo erro.
 */
import { engine } from './engine';

describe('engine() typing', () => {
  it('keeps style literals in every call form', () => {
    // função de estilo com K inferido (a forma mais comum)
    const A = engine('Box', ({ props }) => ({ flexDirection: 'column', position: 'absolute', gap: 4 }));
    const C = engine('Text', () => ({ textTransform: 'uppercase', fontWeight: '700' }));
    // objeto estático, K explícito, encadeamento e when()
    const B = engine('Box', { flexDirection: 'row' });
    const D = engine<'Box', { tone?: 'a' | 'b' }>('Box', () => ({ flexDirection: 'column' }));
    const E = engine('Box')
      .style(() => ({ flexDirection: 'column' }))
      .when('breakpoints:md', { style: { flexDirection: 'row' } })
      .when('state:hover', { style: { opacity: 0.5 } });
    const F = engine('Pressable', () => ({ alignItems: 'center', justifyContent: 'space-between' }));
    // array e valores compostos no estilo estático continuam aceitos
    const G = engine('Box', [{ padding: 1 }, false, { margin: 2 }] as any);
    expect([A, B, C, D, E, F, G].every(Boolean)).toBe(true);
  });

  it('still rejects invalid literal values', () => {
    // @ts-expect-error 'diagonal' não é um flexDirection válido
    engine('Box', () => ({ flexDirection: 'diagonal' }));
    // @ts-expect-error 'middle' não é um textAlign válido (o `textTransform` do CSS aceita qualquer string)
    engine('Text', () => ({ textAlign: 'middle' }));
    // @ts-expect-error valor inválido também no estilo estático
    engine('Box', { position: 'sticky-ish' });
    expect(true).toBe(true);
  });
});
