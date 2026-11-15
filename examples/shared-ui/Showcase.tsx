import { useState } from 'react';
import { engine, getProvider, getTheme, useTheme } from 'omnistyle';
import {
  Badge,
  BadgeText,
  Body,
  Button,
  ButtonLabel,
  Card,
  Chip,
  ChipLabel,
  Field,
  Heading,
  PulseDot,
  Row,
  Screen,
  Title,
} from './ui';
import { AnimationLab } from './Animations';
import { Cubes } from './Cubes';
import { Gyroscope } from './Gyroscope';
import { Helix } from './Helix';
import { PrismScene } from './Prism';
import { WaveGrid } from './WaveGrid';
import { PseudoLab, TransitionLab } from './Pseudo';
import { ResponsiveDemo } from './Responsive';
import { useThemeBubble } from './ThemeBubble';
import { darkTokens, lightTokens } from './tokens';

/** Um componente de página ESCRITO UMA VEZ e renderizado na web e no mobile. */

const Header = engine('Box', ({ theme }) => ({ gap: theme.spacing.xs }));

const Page = engine('Box', ({ theme }) => ({
  padding: theme.spacing.lg,
  gap: theme.spacing.lg,
  // string CSS: maxWidth e centralização fazem sentido na web; no mobile o `margin: auto` é ignorado
  maxWidth: '40rem',
  width: '100%',
  marginInline: 'auto',
}));

/** O mesmo `Card` com uma regra só da web e outra só do mobile. */
const PlatformCard = engine(Card)
  .when('platform:web', { style: { borderStyle: 'dashed' } })
  .when('platform:native', { style: { borderStyle: 'solid' } });

export function Showcase() {
  const theme = useTheme();
  const [dark, setDark] = useState(false);
  const [name, setName] = useState('');
  const [count, setCount] = useState(0);
  const [tag, setTag] = useState('web');

  const { switchTheme, backdrop } = useThemeBubble();
  const toggleDark = (event?: unknown) => {
    const next = dark ? lightTokens : darkTokens;
    switchTheme(event, next, next.color.background);
    setDark(!dark);
  };

  return (
    <>
    {backdrop}
    <Screen style={{ backgroundColor: 'transparent' }}>
      <Page>
        <Header>
          <Title>omnistyle</Title>
          <Body muted>Um estilo, duas plataformas: estes componentes são os mesmos no Expo e no Vite.</Body>
        </Header>

        <Card>
          <Heading>Tema global</Heading>
          <Row wrap>
            <Button size="sm" onPress={toggleDark} testID="toggle-theme">
              <ButtonLabel>{dark ? '☀️ Claro' : '🌙 Escuro'}</ButtonLabel>
            </Button>
            <Badge tone="primary">
              <BadgeText tone="primary">fundo {getTheme().color.background}</BadgeText>
            </Badge>
          </Row>
        </Card>

        <Card accent>
          <Heading>Botões e variantes</Heading>
          <Row wrap>
            {(['primary', 'secondary', 'success', 'warning', 'error'] as const).map((v) => (
              <Button key={v} variant={v} size="sm" onPress={() => setCount((c) => c + 1)}>
                <ButtonLabel>{v}</ButtonLabel>
              </Button>
            ))}
          </Row>
          <Row wrap>
            <Button variant="primary" outlined onPress={() => setCount((c) => c + 1)}>
              <ButtonLabel outlined>outlined</ButtonLabel>
            </Button>
            <Button disabled onPress={() => setCount((c) => c + 1)}>
              <ButtonLabel>disabled</ButtonLabel>
            </Button>
          </Row>
          <Body testID="count">Cliques: {count}</Body>
        </Card>

        <Card>
          <Heading>Input</Heading>
          <Field
            value={name}
            onChangeText={setName}
            placeholder="Digite seu nome…"
            placeholderTextColor={theme.color.muted}
            invalid={name.length > 0 && name.length < 3}
            testID="name-input"
          />
          <Body muted testID="greeting">
            {name ? `Olá, ${name}!` : 'Aguardando…'}
          </Body>
        </Card>

        <Card>
          <Heading>Chips (when por prop)</Heading>
          <Row wrap>
            {['web', 'mobile', 'universal'].map((t) => (
              <Chip key={t} active={t === tag} onPress={() => setTag(t)}>
                <ChipLabel active={t === tag}>{t}</ChipLabel>
              </Chip>
            ))}
          </Row>
        </Card>

        <Card>
          <Heading>Estados e animação</Heading>
          <Row>
            <PulseDot testID="pulse" />
            <Body muted>keyframes() + when('state:hover' | 'pressed' | 'focus'): passe o mouse/clique nos botões e foque o input.</Body>
          </Row>
        </Card>

        <ResponsiveDemo />

        <PseudoLab />

        <TransitionLab />

        {/* <Card>
          <Heading>Hélice (animação difícil)</Heading>
          <Body muted>36 keyframes de 21 quadros: translateX + scale + opacity + cor mudando juntos, defasados.</Body>
          <Helix />
        </Card>

        <Card>
          <Heading>Giroscópio (ainda mais difícil)</Heading>
          <Body muted>3D aninhado, morfose do núcleo, entrada com delay e 24 partículas em Lissajous.</Body>
          <Gyroscope />
        </Card>

        <Card>
          <Heading>Grade de ondas (nível máximo)</Heading>
          <Body muted>49 células × 3 camadas: onda, torção, colapso. Cor por crossfade de opacity: tudo no driver nativo.</Body>
          <WaveGrid />
        </Card>

        <Card>
          <Heading>Cubos 3D (web e mobile)</Heading>
          <Body muted>3D projetado em JS e assado nos keyframes: rotate + skewX + scale por face, luz e faces ocultas por opacity.</Body>
          <Cubes />
        </Card> */}

        {/* só na web: usa 3D real (translateZ), conic-gradient, backdrop-filter, clip-path… */}
        {getProvider().os() === 'web' && (
          <Card>
            <Heading>Prisma 3D (só web)</Heading>
            <Body muted>preserve-3d, translateZ, conic-gradient, backdrop-filter, mix-blend-mode, clip-path e filter animados.</Body>
            <PrismScene />
          </Card>
        )}

        <AnimationLab />

        <PlatformCard>
          <Heading>when('platform:web') / when('platform:native')</Heading>
          <Body muted>A borda deste card é tracejada na web e sólida no mobile (composição com engine(Card)).</Body>
        </PlatformCard>
      </Page>
    </Screen>
    </>
  );
}
