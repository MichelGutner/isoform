import { useState } from 'react';
import { engine, getTheme, updateTheme, useTheme } from 'omnistyle';
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
import { PseudoLab, TransitionLab } from './Pseudo';
import { ResponsiveDemo } from './Responsive';
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
  .when('web', { style: { borderStyle: 'dashed' } })
  .when('native', { style: { borderStyle: 'solid' } });

export function Showcase() {
  const theme = useTheme();
  const [dark, setDark] = useState(false);
  const [name, setName] = useState('');
  const [count, setCount] = useState(0);
  const [tag, setTag] = useState('web');

  const toggleDark = () => {
    updateTheme(dark ? lightTokens : darkTokens);
    setDark(!dark);
  };

  return (
    <Screen>
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
            <Body muted>keyframes() + when('hover' | 'pressed' | 'focus'): passe o mouse/clique nos botões e foque o input.</Body>
          </Row>
        </Card>

        <ResponsiveDemo />

        <PseudoLab />

        <TransitionLab />

        <AnimationLab />

        <PlatformCard>
          <Heading>when('web') / when('native')</Heading>
          <Body muted>A borda deste card é tracejada na web e sólida no mobile (composição com engine(Card)).</Body>
        </PlatformCard>
      </Page>
    </Screen>
  );
}
