/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator as RNActivity,
  Platform,
  ScrollView,
  StatusBar,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { engine, getTheme, useTheme } from 'omnistyle';
import { Benchmark } from '../components/Benchmark';
import { SelfTests } from '../components/SelfTests';
import {
  Badge,
  BadgeText,
  Bar,
  Body,
  Btn,
  Caption,
  Card,
  Divider,
  Heading,
  Input,
  Pill,
  PillLabel,
  Row,
  Screen,
  Title,
  Track,
} from '../components/ui';
import {
  ACCENTS,
  AccentName,
  Density,
  Mode,
  applyTheme,
  palette,
} from '../theme/presets';

// ───────────── componentes específicos desta tela ─────────────

const Swatch = engine<'TouchableOpacity', { selected?: boolean; color: string }>(
  'TouchableOpacity',
  ({ theme, props }) => ({
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: props.color,
    borderWidth: 3,
    borderColor: 'transparent',
  }),
);
Swatch.when('selected', ({ theme }: any) => ({
  style: { borderColor: theme.color.text },
}));

/** `when(true, fn)` — attrs dependentes do tema (props não-style). */
const Toggle = engine('Switch');
Toggle.when(true, ({ theme }: any) => ({
  trackColor: { false: palette(theme).border, true: theme.color.primary },
  thumbColor: '#ffffff',
}));

const Spinner = engine(RNActivity);
Spinner.when(true, ({ theme }: any) => ({ color: theme.color.primary }));

const Chip = engine('View', ({ theme }) => ({
  paddingVertical: theme.spacing.sm,
  paddingHorizontal: theme.spacing.md,
  borderRadius: theme.borderRadius?.md ?? 14,
  backgroundColor: palette(theme).background,
  borderWidth: 1,
  borderColor: palette(theme).border,
  marginRight: theme.spacing.sm,
}));

const Hscroll = engine(ScrollView);
Hscroll.attrs({ horizontal: true, showsHorizontalScrollIndicator: false });

/** Status: demonstra match EXATO ('status:active' ≠ 'inactive'). */
const StatusDot = engine<'View', { status: 'active' | 'inactive' | 'pending' }>(
  'View',
  { width: 12, height: 12, borderRadius: 6 },
);
StatusDot.when('status:active', ({ theme }: any) => ({
  style: { backgroundColor: theme.color.success },
}));
StatusDot.when('status:inactive', ({ theme }: any) => ({
  style: { backgroundColor: theme.color.error },
}));
StatusDot.when('status:pending', ({ theme }: any) => ({
  style: { backgroundColor: theme.color.warning },
}));

/** Condição por função sobre props. */
const Meter = engine<'View', { level: number }>('View', {
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderRadius: 12,
});
Meter.when(({ props }: any) => props.level >= 7, ({ theme }: any) => ({
  style: { backgroundColor: theme.color.error + '33' },
}));
Meter.when(({ props }: any) => props.level >= 4 && props.level < 7, ({ theme }: any) => ({
  style: { backgroundColor: theme.color.warning + '33' },
}));
Meter.when(({ props }: any) => props.level < 4, ({ theme }: any) => ({
  style: { backgroundColor: theme.color.success + '33' },
}));

/** extend(): herda e especializa sem mexer na base. */
const BaseTag = engine<'View', {}>('View', ({ theme }) => ({
  paddingVertical: 6,
  paddingHorizontal: 12,
  borderRadius: 8,
  backgroundColor: palette(theme).border,
}));
const DangerTag: any = (BaseTag as any)
  .extend()
  .style(({ theme }: any) => ({ backgroundColor: theme.color.error + '33' }));

/** Composição: engine(componenteEngine, estilo extra). */
const BigCard = engine(Card as any, ({ theme }: any) => ({
  padding: theme.spacing.lg,
  borderRadius: 28,
}));

const Tab = engine<'TouchableOpacity', { active?: boolean }>('TouchableOpacity', ({ theme }) => ({
  flex: 1,
  paddingVertical: theme.spacing.sm + 2,
  alignItems: 'center',
  borderRadius: theme.borderRadius?.md ?? 14,
}));
Tab.when('active', ({ theme }: any) => ({
  style: { backgroundColor: theme.color.primary },
}));

const Section = ({ n, title, hint, children }: any) => (
  <View style={{ gap: 10 }}>
    <Row>
      <Badge>
        <BadgeText>{n}</BadgeText>
      </Badge>
      <Heading>{title}</Heading>
    </Row>
    {hint ? <Body muted>{hint}</Body> : null}
    {children}
  </View>
);

// ───────────── abas ─────────────

function VisualTab() {
  const theme = useTheme();
  const [count, setCount] = useState(3);
  const [invalid, setInvalid] = useState(false);
  const [notif, setNotif] = useState(true);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [outlined, setOutlined] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [stress, setStress] = useState(0);
  const [ms, setMs] = useState<number | null>(null);
  const inputRef = useRef<TextInput>(null);

  const stressItems = useMemo(() => Array.from({ length: stress }, (_, i) => i), [stress]);
  const runStress = () => {
    const t0 = Date.now();
    setStress(n => (n ? 0 : 300));
    requestAnimationFrame(() => setMs(Date.now() - t0));
  };

  return (
    <View style={{ gap: theme.spacing.xl as number }}>
      <Section n="1" title="Botões e variantes" hint="style por função + when por prop (variant, size, outlined, pill, disabled) + plataforma.">
        <Card>
          <Row wrap>
            {(['primary', 'secondary', 'success', 'warning', 'error'] as const).map(v => (
              <Btn key={v} label={v} variant={v} size="sm" outlined={outlined} disabled={disabled} onPress={() => {}} />
            ))}
          </Row>
          <Row wrap>
            <Btn label="Small" size="sm" pill onPress={() => {}} />
            <Btn label="Medium" size="md" pill onPress={() => {}} />
            <Btn label="Large" size="lg" variant="secondary" onPress={() => {}} />
          </Row>
          <Divider />
          <Row between>
            <Body>outlined</Body>
            <Toggle value={outlined} onValueChange={setOutlined} />
          </Row>
          <Row between>
            <Body>disabled</Body>
            <Toggle value={disabled} onValueChange={setDisabled} />
          </Row>
        </Card>
      </Section>

      <Section n="2" title="Match exato por valor" hint="when('status:active') não pode casar com 'inactive' (antes era substring).">
        <Card>
          {(['active', 'inactive', 'pending'] as const).map(s => (
            <Row key={s}>
              <StatusDot status={s} />
              <Body style={{ flex: 1 }}>{s}</Body>
              <Badge tone={s === 'active' ? 'success' : s === 'inactive' ? 'error' : 'warning'}>
                <BadgeText tone={s === 'active' ? 'success' : s === 'inactive' ? 'error' : 'warning'}>
                  {s === 'active' ? 'verde' : s === 'inactive' ? 'vermelho' : 'amarelo'} esperado
                </BadgeText>
              </Badge>
            </Row>
          ))}
        </Card>
      </Section>

      <Section n="3" title="Condição por função" hint="when(({ props }) => ...) com faixas — mude o nível.">
        <Card>
          <Row between>
            <Btn label="−" size="sm" variant="secondary" onPress={() => setCount(c => Math.max(0, c - 1))} />
            <Heading>Nível {count}</Heading>
            <Btn label="+" size="sm" variant="secondary" onPress={() => setCount(c => Math.min(10, c + 1))} />
          </Row>
          <Meter level={count}>
            <Body>
              {count >= 7 ? 'Crítico (vermelho)' : count >= 4 ? 'Atenção (amarelo)' : 'Saudável (verde)'}
            </Body>
          </Meter>
          <Track>
            <Bar value={count * 10} />
          </Track>
        </Card>
      </Section>

      <Section n="4" title="Inputs, ref e attrs" hint="attrs() fixos (autoCapitalize), when('invalid'), ref encaminhado.">
        <Card>
          <Input
            ref={inputRef as any}
            value={text}
            onChangeText={setText}
            placeholder="Digite algo…"
            placeholderTextColor={palette(theme).muted}
            invalid={invalid}
          />
          <Row wrap>
            <Btn label="Focar via ref" size="sm" variant="secondary" onPress={() => inputRef.current?.focus()} />
            <Btn label={invalid ? 'Remover erro' : 'Marcar inválido'} size="sm" variant="error" outlined onPress={() => setInvalid(v => !v)} />
          </Row>
          <Row between>
            <Body>Notificações (Switch)</Body>
            <Toggle value={notif} onValueChange={setNotif} />
          </Row>
          <Row between>
            <Body>Carregando (ActivityIndicator)</Body>
            <Row>
              {loading ? <Spinner /> : null}
              <Toggle value={loading} onValueChange={setLoading} />
            </Row>
          </Row>
        </Card>
      </Section>

      <Section n="5" title="Cards: when com style" hint="Variantes por prop booleana: padrão, flat e accent.">
        <Card><Body>Card padrão (sombra do tema)</Body></Card>
        <Card flat><Body>Card flat (sem sombra)</Body></Card>
        <Card accent><Body>Card accent (borda com a cor primária)</Body></Card>
      </Section>

      <Section n="6" title="extend() e composição" hint="extend herda regras sem alterar a base; engine(engineComp) empilha estilos.">
        <Card>
          <Row wrap>
            <BaseTag><Body>Base</Body></BaseTag>
            <DangerTag><Body>Extendido</Body></DangerTag>
            <BaseTag><Body>Base de novo (intacta)</Body></BaseTag>
          </Row>
        </Card>
        <BigCard>
          <Body>engine(Card, …): padding 24 e raio 28 por cima do Card.</Body>
        </BigCard>
      </Section>

      <Section n="7" title="Style do usuário e ScrollView" hint="A prop style é mesclada por cima; ScrollView horizontal vem de attrs().">
        <Card>
          <Btn label="Com style={{ transform: rotate }}" size="sm" style={{ transform: [{ rotate: '-2deg' }], alignSelf: 'flex-start' }} onPress={() => {}} />
          <Hscroll>
            {['Design', 'Código', 'Teste', 'Deploy', 'Monitorar', 'Iterar'].map(c => (
              <Chip key={c}><Body>{c}</Body></Chip>
            ))}
          </Hscroll>
        </Card>
      </Section>

      <Section n="8" title="Plataforma" hint="when('ios' | 'android' | 'web') — só a regra da plataforma atual deve valer.">
        <Card accent>
          <Row between>
            <Body>Rodando em</Body>
            <Badge tone="success"><BadgeText tone="success">{Platform.OS}</BadgeText></Badge>
          </Row>
          <Btn label={`Sombra ${Platform.OS === 'ios' ? 'iOS (shadow*)' : Platform.OS === 'android' ? 'Android (elevation)' : 'padrão'}`} onPress={() => {}} />
        </Card>
      </Section>

      <Section n="9" title="Stress / cache" hint="300 componentes com props iguais devem reaproveitar o cache de estilo.">
        <Card>
          <Row between>
            <Btn label={stress ? 'Limpar' : 'Renderizar 300'} size="sm" onPress={runStress} />
            {ms != null && <Badge><BadgeText>{ms} ms</BadgeText></Badge>}
          </Row>
          <Row wrap>
            {stressItems.map(i => (
              <Swatch key={i} color={Object.values(ACCENTS)[i % 5]} selected={i % 7 === 0} style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2 }} />
            ))}
          </Row>
        </Card>
      </Section>
    </View>
  );
}

function TestsTab() {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.lg as number }}>
      <SelfTests />
      <Card>
        <Heading>Inspetor do tema</Heading>
        <Body muted>Valor de getTheme() — atualiza em tempo real com useTheme().</Body>
        <Body mono>{JSON.stringify({ color: theme.color, spacing: theme.spacing }, null, 2)}</Body>
        <Caption>identidade: {String(getTheme() === theme)}</Caption>
      </Card>
    </View>
  );
}

// ───────────── tela ─────────────

export default function HomeScreen() {
  const theme = useTheme();
  const [tab, setTab] = useState<'visual' | 'tests' | 'bench'>('visual');
  const [mode, setMode] = useState<Mode>('light');
  const [accent, setAccent] = useState<AccentName>('indigo');
  const [density, setDensity] = useState<Density>('comfortable');

  const apply = (m: Mode, a: AccentName, d: Density) => {
    setMode(m);
    setAccent(a);
    setDensity(d);
    applyTheme(m, a, d);
  };

  return (
    <Screen>
      <StatusBar barStyle={mode === 'light' ? 'dark-content' : 'light-content'} />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg as number, gap: theme.spacing.lg as number, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 4 }}>
          <Caption>omnistyle</Caption>
          <Title>Playground</Title>
          <Body muted>Todas as features da lib em uma tela. Edite ../src e veja o Fast Refresh.</Body>
        </View>

        <Card>
          <Caption>Tema ao vivo (updateTheme)</Caption>
          <Row wrap>
            <Pill active={mode === 'light'} onPress={() => apply('light', accent, density)}>
              <PillLabel active={mode === 'light'}>☀️ Claro</PillLabel>
            </Pill>
            <Pill active={mode === 'dark'} onPress={() => apply('dark', accent, density)}>
              <PillLabel active={mode === 'dark'}>🌙 Escuro</PillLabel>
            </Pill>
            <Pill active={density === 'compact'} onPress={() => apply(mode, accent, density === 'compact' ? 'comfortable' : 'compact')}>
              <PillLabel active={density === 'compact'}>↕ Compacto</PillLabel>
            </Pill>
          </Row>
          <Row>
            {(Object.keys(ACCENTS) as AccentName[]).map(a => (
              <Swatch key={a} color={ACCENTS[a]} selected={a === accent} onPress={() => apply(mode, a, density)} />
            ))}
          </Row>
        </Card>

        <Card accent>
          <Caption>omnistyle · multiplataforma</Caption>
          <Body muted>
            A tela “Universal” é a mesma lib de componentes que roda no app web (example-web).
          </Body>
          <Btn label="Abrir tela universal (shared-ui) →" onPress={() => router.push('/universal')} />
        </Card>

        <Card style={{ flexDirection: 'row', padding: 6, gap: 6 }}>
          <Tab active={tab === 'visual'} onPress={() => setTab('visual')}>
            <PillLabel active={tab === 'visual'}>Visual</PillLabel>
          </Tab>
          <Tab active={tab === 'tests'} onPress={() => setTab('tests')}>
            <PillLabel active={tab === 'tests'}>Testes</PillLabel>
          </Tab>
          <Tab active={tab === 'bench'} onPress={() => setTab('bench')}>
            <PillLabel active={tab === 'bench'}>Benchmark</PillLabel>
          </Tab>
        </Card>

        {tab === 'visual' ? <VisualTab /> : tab === 'tests' ? <TestsTab /> : <Benchmark />}
      </ScrollView>
    </Screen>
  );
}
