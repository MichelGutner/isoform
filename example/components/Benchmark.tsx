/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { engine, updateTheme, useTheme } from 'omnistyle';
import { Badge, BadgeText, Body, Btn, Caption, Card, Divider, Heading, Pill, PillLabel, Row, Track } from './ui';
import { palette } from '../theme/presets';

const now = () => (globalThis as any).performance?.now?.() ?? Date.now();
const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#0ea5e9'];

// ───────────── variantes: todas desenham a MESMA caixa 12×12 ─────────────

const base = { width: 12, height: 12, margin: 1, borderRadius: 3, borderWidth: 1, borderColor: '#00000022' } as const;
const sheet = StyleSheet.create({ box: { ...base, backgroundColor: '#6366f1' } });

type ItemProps = { i: number };

const StyleSheetItem = (_: ItemProps) => <View style={sheet.box} />;

const InlineItem = (_: ItemProps) => <View style={{ ...base, backgroundColor: '#6366f1' }} />;

/** Abordagem manual: useTheme + objeto inline. É o comparativo "justo" p/ tema. */
const ManualThemeItem = ({ i }: ItemProps) => {
  const theme = useTheme();
  return <View style={{ ...base, backgroundColor: i % 2 ? theme.color.primary : COLORS[i % 5] }} />;
};

const S_static = engine('View', { ...base, backgroundColor: '#6366f1' });

const S_theme = engine('View', ({ theme }) => ({ ...base, backgroundColor: theme.color.primary }));

const S_props = engine<'View', { k: number }>('View', ({ theme, props }) => ({
  ...base,
  backgroundColor: props.k % 2 ? theme.color.primary : COLORS[props.k % 5],
}));
S_props.when('k:0', { style: { borderRadius: 6 } });

/** Pior caso: props únicas por item → todo render é cache miss. */
const S_unique = engine<'View', { k: number }>('View', ({ theme, props }) => ({
  ...base,
  backgroundColor: props.k % 2 ? theme.color.primary : COLORS[props.k % 5],
}));
S_unique.when('k:0', { style: { borderRadius: 6 } });

type Variant = {
  id: string;
  label: string;
  note: string;
  /** reage a mudança de tema? (tem sentido medir "trocar tema") */
  themed: boolean;
  render: (i: number) => React.ReactElement;
};

const VARIANTS: Variant[] = [
  { id: 'sheet', label: 'StyleSheet', note: 'baseline (sem tema)', themed: false, render: i => <StyleSheetItem key={i} i={i} /> },
  { id: 'inline', label: 'Inline', note: 'objeto novo a cada render', themed: false, render: i => <InlineItem key={i} i={i} /> },
  { id: 'manual', label: 'useTheme + inline', note: 'jeito manual com tema', themed: true, render: i => <ManualThemeItem key={i} i={i} /> },
  { id: 'static', label: 'stylized · estático', note: 'objeto fixo → caminho rápido', themed: true, render: i => <S_static key={i} /> },
  { id: 'theme', label: 'stylized · tema', note: 'fn(theme), props iguais', themed: true, render: i => <S_theme key={i} /> },
  { id: 'props', label: 'stylized · props', note: '5 combinações → cache hit', themed: true, render: i => <S_props key={i} k={i % 5} /> },
  { id: 'unique', label: 'stylized · únicas', note: 'pior caso: cache miss', themed: true, render: i => <S_unique key={i} k={i} /> },
];

// ───────────── harness de medição ─────────────

const median = (xs: number[]) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const wait = (ms = 30) => new Promise<void>(r => setTimeout(r, ms));

type Row_ = { mount: number; update: number; theme: number | null };

export function Benchmark() {
  const theme = useTheme();
  const [n, setN] = useState(300);
  const [rounds, setRounds] = useState(5);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<Record<string, Row_>>({});

  // estado do harness
  const [active, setActive] = useState<Variant | null>(null);
  const [tick, setTick] = useState(0);
  const resolver = useRef<(() => void) | null>(null);

  // Roda a cada commit deste componente (o React Compiler memoizaria um
  // filho "Marker" sem props e o effect dele só dispararia na montagem).
  // Effects do pai rodam depois dos dos filhos → o commit dos itens já acabou.
  useLayoutEffect(() => {
    const r = resolver.current;
    resolver.current = null;
    r?.();
  });

  /** Executa `action` e retorna quanto levou até o commit terminar. */
  const timed = (action: () => void) =>
    new Promise<number>(resolve => {
      const t0 = now();
      // Timeout de segurança: se nenhum commit acontecer, não trava o benchmark.
      const guard = setTimeout(() => {
                resolver.current = null;
        resolve(NaN);
      }, 8000);
      resolver.current = () => {
        clearTimeout(guard);
                resolve(now() - t0);
      };
      action();
    });

  const run = async () => {
    setRunning(true);
    setResults({});
    const out: Record<string, Row_> = {};
    const original = theme.color.primary;
    let colorIdx = 0; // sempre muda a cor (se fosse igual, ninguém re-renderiza)

    for (const v of VARIANTS) {
      const mounts: number[] = [];
      const updates: number[] = [];
      const themes: number[] = [];

      for (let r = 0; r < rounds + 1; r++) {
        setProgress(`${v.label} · rodada ${r === 0 ? 'aquecimento' : `${r}/${rounds}`}`);

        const m = await timed(() => setActive(v)); // monta N itens
        await wait();
        const u = await timed(() => setTick(t => t + 1)); // re-render, props iguais
        await wait();
        let th: number | null = null;
        if (v.themed) {
          colorIdx++;
          const color = colorIdx % 2 ? '#ff00aa' : '#00aaff';
          th = await timed(() => updateTheme({ color: { primary: color } } as any)); // troca de tema
          await wait();
        }
        await timed(() => setActive(null)); // desmonta
        await wait();

        if (r > 0) {
          mounts.push(m);
          updates.push(u);
          if (th != null) themes.push(th);
        }
      }
      out[v.id] = {
        mount: median(mounts),
        update: median(updates),
        theme: v.themed ? median(themes) : null,
      };
      setResults({ ...out });
    }

    updateTheme({ color: { primary: original } } as any);
    setProgress('');
    setRunning(false);
  };

  const done = !running && Object.keys(results).length === VARIANTS.length;
  type Key = 'mount' | 'update' | 'theme';
  /** ranking (menor = melhor) de uma métrica entre as variantes medidas */
  const rank = (key: Key) =>
    VARIANTS.filter(v => results[v.id] && results[v.id][key] != null)
      .map(v => ({ v, ms: results[v.id][key] as number }))
      .sort((a, b) => a.ms - b.ms);
  const medal = (key: Key, id: string) => {
    const i = rank(key).findIndex(x => x.v.id === id);
    return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
  };
  const METRICS: { key: Key; title: string; hint: string }[] = [
    { key: 'mount', title: 'Montar', hint: 'custo de criar N componentes do zero' },
    { key: 'update', title: 'Re-render', hint: 'custo de renderizar de novo com as mesmas props (hash + cache)' },
    { key: 'theme', title: 'Trocar tema', hint: 'custo de updateTheme com tudo montado (só variantes com tema)' },
  ];

  const baseRow = results.sheet;
  const maxMount = Math.max(1, ...Object.values(results).map(r => r.mount));
  const maxUpdate = Math.max(1, ...Object.values(results).map(r => r.update));
  const f = (x: number) => (x < 10 ? x.toFixed(1) : Math.round(x).toString());
  const ratio = (x: number, b?: number) => (b ? `${(x / Math.max(b, 0.1)).toFixed(1)}×` : '');

  return (
    <View style={{ gap: theme.spacing.lg as number }}>
      <Card accent>
        <Heading>Benchmark</Heading>
        <Body muted>
          Mede o tempo de JS render + commit (monta, re-renderiza com props iguais e troca de tema)
          de N caixas idênticas em cada abordagem. Mediana de {rounds} rodadas após 1 de aquecimento.
        </Body>

        <Caption>Quantidade de componentes</Caption>
        <Row wrap>
          {[100, 300, 1000, 3000].map(v => (
            <Pill key={v} active={n === v} onPress={() => !running && setN(v)}>
              <PillLabel active={n === v}>{v}</PillLabel>
            </Pill>
          ))}
        </Row>
        <Caption>Rodadas</Caption>
        <Row wrap>
          {[3, 5, 10].map(v => (
            <Pill key={v} active={rounds === v} onPress={() => !running && setRounds(v)}>
              <PillLabel active={rounds === v}>{v}</PillLabel>
            </Pill>
          ))}
        </Row>

        <Btn label={running ? 'Executando…' : '▶ Rodar benchmark'} disabled={running} onPress={run} />
        {running ? <Body muted>{progress}</Body> : null}
        <Badge tone={__DEV__ ? 'warning' : 'success'}>
          <BadgeText tone={__DEV__ ? 'warning' : 'success'}>
            {__DEV__ ? 'modo DEV — números inflados; use --no-dev --minify' : 'modo release'}
          </BadgeText>
        </Badge>
      </Card>

      {done && (
        <Card accent>
          <Heading>🏆 Quem foi melhor em quê</Heading>
          {METRICS.map(m => {
            const r = rank(m.key);
            if (r.length < 2) return null;
            const margin = (r[1].ms - r[0].ms) / Math.max(r[0].ms, 0.1);
            const tie = margin < 0.1; // <10% é ruído de medição
            // melhor entre as variantes stylized
            const bestStylized = r.find(x => x.v.id.startsWith('s') && x.v.label.startsWith('stylized'));
            const manual = r.find(x => x.v.id === 'manual');
            return (
              <View key={m.key} style={{ gap: 4 }}>
                <Divider />
                <Caption>{m.title}</Caption>
                <Row between>
                  <Body style={{ fontWeight: '800', flex: 1 }}>
                    {tie ? '🤝 empate técnico' : `🥇 ${r[0].v.label}`}
                  </Body>
                  <Badge tone={tie ? 'warning' : 'success'}>
                    <BadgeText tone={tie ? 'warning' : 'success'}>
                      {f(r[0].ms)} ms{tie ? '' : ` · ${(r[1].ms / Math.max(r[0].ms, 0.1)).toFixed(1)}× mais rápido`}
                    </BadgeText>
                  </Badge>
                </Row>
                <Body muted style={{ fontSize: 12 }}>
                  {r.slice(0, 3).map((x, i) => `${['🥇', '🥈', '🥉'][i]} ${x.v.label} ${f(x.ms)}ms`).join('  ·  ')}
                </Body>
                {bestStylized && manual ? (
                  <Body muted style={{ fontSize: 12 }}>
                    vs manual (useTheme + inline): melhor stylized {f(bestStylized.ms)} ms vs {f(manual.ms)} ms →{' '}
                    {bestStylized.ms <= manual.ms * 1.1
                      ? 'equivalente ou melhor'
                      : `${(bestStylized.ms / Math.max(manual.ms, 0.1)).toFixed(1)}× mais lento`}
                  </Body>
                ) : null}
                <Caption>{m.hint}</Caption>
              </View>
            );
          })}
          <Divider />
          <Body muted style={{ fontSize: 12 }}>
            Diferença menor que 10% é tratada como empate técnico. Rode algumas vezes e em release para confirmar.
          </Body>
        </Card>
      )}

      {Object.keys(results).length > 0 && (
        <Card>
          <Heading>Resultados ({n} itens)</Heading>
          <Body muted>Menor é melhor. “×” compara com StyleSheet.</Body>
          {VARIANTS.filter(v => results[v.id]).map(v => {
            const r = results[v.id];
            return (
              <View key={v.id} style={{ gap: 6 }}>
                <Divider />
                <Row between>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: '800' }}>{v.label}</Body>
                    <Caption>{v.note}</Caption>
                  </View>
                </Row>
                <Metric label="montar" value={r.mount} max={maxMount} text={`${medal('mount', v.id)} ${f(r.mount)} ms ${ratio(r.mount, baseRow?.mount)}`} />
                <Metric label="re-render" value={r.update} max={maxUpdate} text={`${medal('update', v.id)} ${f(r.update)} ms ${ratio(r.update, baseRow?.update)}`} />
                {r.theme != null && <Metric label="trocar tema" value={r.theme} max={Math.max(1, ...Object.values(results).map(x => x.theme ?? 0))} text={`${medal('theme', v.id)} ${f(r.theme)} ms`} />}
              </View>
            );
          })}
        </Card>
      )}

      {/* Área de medição (fora da tela visível ocupa pouco espaço) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', maxHeight: 40, overflow: 'hidden', opacity: 0.0 }} data-tick={tick}>
        {active ? Array.from({ length: n }, (_, i) => active.render(i)) : null}
      </View>
    </View>
  );
}

const Metric = ({ label, value, max, text }: { label: string; value: number; max: number; text: string }) => {
  const theme = useTheme();
  return (
    <Row>
      <Caption style={{ width: 78 }}>{label}</Caption>
      <View style={{ flex: 1 }}>
        <Track>
          <View style={{ height: 10, borderRadius: 999, width: `${Math.max(3, (value / max) * 100)}%`, backgroundColor: theme.color.primary }} />
        </Track>
      </View>
      <Body style={{ width: 124, textAlign: 'right', fontSize: 12 }}>{text}</Body>
    </Row>
  );
};
