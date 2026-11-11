/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { engine, getTheme, updateTheme, useTheme } from 'omnistyle';
import { Badge, BadgeText, Body, Btn, Caption, Card, Divider, Heading, Row } from './ui';

/**
 * Componente "sonda": recebe as props FINAIS calculadas pela lib
 * (attrs + style) e as reporta. Assim os testes verificam o resultado real.
 */
const Probe: any = (p: any) => {
  p.report?.(p);
  return null;
};

type Result = { name: string; ok: boolean; detail?: string };
type Reports = Record<string, any>;

const flat = (style: any): any =>
  Array.isArray(style)
    ? style.reduce((acc, s) => ({ ...acc, ...flat(s) }), {})
    : (style ?? {});

// ── Componentes sob teste (um por feature) ──
const T_static = engine(Probe, { padding: 4 } as any);
const T_themeFn = engine(Probe, (({ theme }: any) => ({ color: theme.color.primary })) as any);
const T_propValue: any = engine(Probe);
T_propValue.when('status:active', { matched: true });
const T_boolean: any = engine(Probe);
T_boolean.when('flag', { hit: true });
const T_fn: any = engine(Probe);
T_fn.when(({ props }: any) => props.n > 3, { big: true });
const T_platform: any = engine(Probe);
T_platform.when('ios', { isIos: true });
T_platform.when('android', { isAndroid: true });
const T_attrs: any = engine(Probe);
T_attrs.attrs({ testID: 'fixed', accessibilityLabel: 'fixed-label' });
const T_order: any = engine(Probe);
T_order.style({ margin: 1 }).style({ margin: 2 });
const T_whenStyle: any = engine(Probe);
T_whenStyle.when('on', { style: { borderWidth: 3 } });
const T_whenFnAttrs: any = engine(Probe);
T_whenFnAttrs.when('on', ({ props }: any) => ({ echoed: props.level * 2 }));
const T_base: any = engine(Probe, { padding: 10 } as any);
const T_extended: any = T_base.extend().style({ margin: 20 });
const T_compose: any = engine(T_static as any, { margin: 7 } as any);
const T_chain: any = engine(Probe)
  .style({ gap: 1 })
  .when('x', { gotX: true })
  .attrs({ fixed: 1 });

/** Cada caso: o que renderizar e como validar o que a lib entregou. */
const cases: {
  key: string;
  name: string;
  render: (report: (v: any) => void) => React.ReactElement;
  check: (p: any, theme: EngineTheme) => boolean | string;
}[] = [
  {
    key: 'static',
    name: 'style estático (objeto)',
    render: r => <T_static report={r} />,
    check: p => flat(p.style).padding === 4,
  },
  {
    key: 'themeFn',
    name: 'style por função lê o tema atual',
    render: r => <T_themeFn report={r} />,
    check: (p, t) => flat(p.style).color === t.color.primary,
  },
  {
    key: 'valueMatch',
    name: "when('status:active') aplica com valor igual",
    render: r => <T_propValue status="active" report={r} />,
    check: p => p.matched === true,
  },
  {
    key: 'valueExact',
    name: "when('status:active') NÃO aplica em 'inactive' (match exato)",
    render: r => <T_propValue status="inactive" report={r} />,
    check: p => p.matched === undefined,
  },
  {
    key: 'boolOn',
    name: "when('flag') aplica quando a prop é truthy",
    render: r => <T_boolean flag report={r} />,
    check: p => p.hit === true,
  },
  {
    key: 'boolOff',
    name: "when('flag') não aplica quando ausente",
    render: r => <T_boolean report={r} />,
    check: p => p.hit === undefined,
  },
  {
    key: 'fnOn',
    name: 'when(fn) verdadeiro (n=5)',
    render: r => <T_fn n={5} report={r} />,
    check: p => p.big === true,
  },
  {
    key: 'fnOff',
    name: 'when(fn) falso (n=1)',
    render: r => <T_fn n={1} report={r} />,
    check: p => p.big === undefined,
  },
  {
    key: 'platform',
    name: `when('ios'|'android') só na plataforma atual (${Platform.OS})`,
    render: r => <T_platform report={r} />,
    check: p =>
      (p.isIos === true) === (Platform.OS === 'ios') &&
      (p.isAndroid === true) === (Platform.OS === 'android'),
  },
  {
    key: 'attrs',
    name: 'attrs() injeta props fixas',
    render: r => <T_attrs report={r} />,
    check: p => p.testID === 'fixed' && p.accessibilityLabel === 'fixed-label',
  },
  {
    key: 'attrsOverride',
    name: 'props do usuário sobrescrevem attrs()',
    render: r => <T_attrs testID="mine" report={r} />,
    check: p => p.testID === 'mine',
  },
  {
    key: 'order',
    name: 'múltiplos style() — o último vence',
    render: r => <T_order report={r} />,
    check: p => flat(p.style).margin === 2,
  },
  {
    key: 'userStyle',
    name: 'prop style do usuário é mesclada por cima',
    render: r => <T_static style={{ padding: 99, opacity: 0.5 }} report={r} />,
    check: p => flat(p.style).padding === 99 && flat(p.style).opacity === 0.5,
  },
  {
    key: 'whenStyle',
    name: 'when() com style dentro dos attrs',
    render: r => <T_whenStyle on report={r} />,
    check: p => flat(p.style).borderWidth === 3,
  },
  {
    key: 'whenFnAttrs',
    name: 'when() com attrs em função (recebe props)',
    render: r => <T_whenFnAttrs on level={4} report={r} />,
    check: p => p.echoed === 8,
  },
  {
    key: 'extend',
    name: 'extend() herda as regras e adiciona novas',
    render: r => <T_extended report={r} />,
    check: p => flat(p.style).padding === 10 && flat(p.style).margin === 20,
  },
  {
    key: 'extendIsolated',
    name: 'extend() NÃO altera o componente original',
    render: r => <T_base report={r} />,
    check: p => flat(p.style).margin === undefined,
  },
  {
    key: 'compose',
    name: 'engine(engineComp) compõe estilos',
    render: r => <T_compose report={r} />,
    check: p => flat(p.style).padding === 4 && flat(p.style).margin === 7,
  },
  {
    key: 'chain',
    name: 'encadeamento .style().when().attrs()',
    render: r => <T_chain x report={r} />,
    check: p => flat(p.style).gap === 1 && p.gotX === true && p.fixed === 1,
  },
];

// ── Testes da API do tema (puros, sem render) ──
function runThemeTests(): Result[] {
  const out: Result[] = [];
  const t = (name: string, fn: () => boolean) => {
    let ok = false;
    try {
      ok = fn();
    } catch (e: any) {
      out.push({ name, ok: false, detail: String(e?.message ?? e) });
      return;
    }
    out.push({ name, ok });
  };

  const snapshot = getTheme();
  const originalPrimary = snapshot.color.primary;

  t('updateTheme(obj) mescla e preserva chaves vizinhas', () => {
    const bg = getTheme().color.background;
    updateTheme({ color: { primary: '#abcdef' } } as any);
    return getTheme().color.primary === '#abcdef' && getTheme().color.background === bg;
  });

  t('updateTheme(fn) recebe o tema anterior', () => {
    updateTheme((prev: any) => ({ color: { primary: prev.color.primary + '' === '#abcdef' ? '#123456' : '#000' } }) as any);
    return getTheme().color.primary === '#123456';
  });

  t('updateTheme retorna o tema resultante (=== getTheme())', () => {
    const r = updateTheme({ color: { primary: '#222222' } } as any);
    return r === getTheme();
  });

  t('referências de ramos intocados são preservadas', () => {
    const spacingBefore = getTheme().spacing;
    updateTheme({ color: { primary: '#333333' } } as any);
    return getTheme().spacing === spacingBefore;
  });

  t('sem mudança real não cria novo objeto de tema', () => {
    const before = getTheme();
    updateTheme({ color: { primary: '#333333' } } as any);
    return getTheme() === before;
  });

  // restaura
  updateTheme({ color: { primary: originalPrimary } } as any);
  return out;
}

const ResultRow = ({ r }: { r: Result }) => (
  <Row between>
    <Body style={{ flex: 1, fontSize: 13 }}>{r.name}</Body>
    <Badge tone={r.ok ? 'success' : 'error'}>
      <BadgeText tone={r.ok ? 'success' : 'error'}>{r.ok ? 'OK' : 'FALHOU'}</BadgeText>
    </Badge>
  </Row>
);

export function SelfTests() {
  const theme = useTheme(); // re-renderiza quando o tema muda → re-executa os casos
  const reports = useRef<Reports>({});
  const [tick, setTick] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [themeResults, setThemeResults] = useState<Result[]>([]);

  useEffect(() => {
    const comp: Result[] = cases.map(c => {
      const p = reports.current[c.key];
      if (!p) return { name: c.name, ok: false, detail: 'sonda não renderizou' };
      let ok: boolean | string = false;
      try {
        ok = c.check(p, theme);
      } catch (e: any) {
        return { name: c.name, ok: false, detail: String(e?.message ?? e) };
      }
      return { name: c.name, ok: ok === true };
    });
    setResults(comp);
  }, [tick, theme]);

  const all = [...themeResults, ...results];
  const passed = all.filter(r => r.ok).length;
  const allOk = all.length > 0 && passed === all.length;

  return (
    <Card accent>
      {/* Sondas invisíveis: renderizam cada caso e reportam as props finais. */}
      {cases.map(c => (
        <React.Fragment key={c.key}>
          {c.render(v => {
            reports.current[c.key] = v;
          })}
        </React.Fragment>
      ))}

      <Row between>
        <Heading>Autotestes</Heading>
        <Badge tone={all.length === 0 ? 'neutral' : allOk ? 'success' : 'error'}>
          <BadgeText tone={all.length === 0 ? 'neutral' : allOk ? 'success' : 'error'}>
            {all.length === 0 ? 'não executado' : `${passed}/${all.length} passaram`}
          </BadgeText>
        </Badge>
      </Row>
      <Body muted>
        Cada caso renderiza uma “sonda” e confere as props finais que a lib entregou.
      </Body>
      <Btn
        label="▶ Executar todos os testes"
        variant="primary"
        onPress={() => {
          setThemeResults(runThemeTests());
          setTick(t => t + 1);
        }}
      />

      {themeResults.length > 0 && (
        <>
          <Divider />
          <Caption>API do tema</Caption>
          {themeResults.map(r => (
            <ResultRow key={r.name} r={r} />
          ))}
        </>
      )}
      {results.length > 0 && (
        <>
          <Divider />
          <Caption>Engine / builder</Caption>
          {results.map(r => (
            <ResultRow key={r.name} r={r} />
          ))}
        </>
      )}
    </Card>
  );
}
