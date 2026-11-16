import { useEffect, useState, type ReactNode } from 'react';
import { engine, getProvider } from 'omnistyle';
import { PAGES } from './pages';
import { OverlayProvider, SettingsProvider, useSettings } from './settings';
import { Body, Button, ButtonLabel, Title, themeFade } from './ui';

/** The whole layout: a column on phones (navigation on top), a row from `md` (sidebar on the left). */
const Layout = engine('Box', { flex: 1, flexDirection: 'column' })
  .when('breakpoints:md', { style: { flexDirection: 'row' } })
  // on the web the root is not a flex container: fix the height so the content scrolls inside it
  .when('platform:web', { style: { height: '100vh' } });

const Sidebar = engine('Box', ({ theme }) => ({
  transition: themeFade(),
  gap: theme.spacing.sm,
  padding: theme.spacing.md,
  borderBottomWidth: 1,
  borderColor: theme.color.border,
  backgroundColor: theme.color.surface,
})).when('breakpoints:md', {
  style: { width: 240, borderBottomWidth: 0, borderRightWidth: 1, padding: 20 },
});

/** Page links: a scrolling row on phones, a column from `md`. */
const Nav = engine('Scroll', { flexGrow: 0 });

const NavList = engine('Box', ({ theme }) => ({
  flexDirection: 'row',
  gap: theme.spacing.xs,
})).when('breakpoints:md', {
  style: { flexDirection: 'column' },
});

const NavItem = engine<'Pressable', { active?: boolean }>(
  'Pressable',
  ({ theme }) => ({
    transition: themeFade('opacity 150ms'),
    paddingBlock: 8,
    paddingInline: 14,
    borderRadius: theme.borderRadius?.md ?? 14,
  }),
)
  .attrs({ role: 'button' })
  .when('state:hover', ({ theme }) => ({
    style: { backgroundColor: theme.color.background },
  }))
  .when('props:active', ({ theme }) => ({
    style: { backgroundColor: theme.color.primary },
  }))
  .when('platform:web', { style: { cursor: 'pointer' } });

const NavLabel = engine<'Text', { active?: boolean }>(
  'Text',
  ({ theme, props }) => ({
    transition: themeFade(),
    fontSize: 14,
    fontWeight: '700',
    color: props.active ? '#ffffff' : theme.color.text,
  }),
);

const Content = engine('Scroll', { flex: 1, backgroundColor: 'transparent' });

/** React Native reads `pointerEvents` as a prop (a style entry is ignored); the web strips it and uses the style below. */
const BOX_NONE = { pointerEvents: 'box-none' } as object;

/** Covers the screen above the content; touches pass through to what is behind. */
const Overlay = engine('Box', {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
}).when('platform:web', {
  style: { pointerEvents: 'none' },
});

const Page = engine('Box', ({ theme }) => ({
  padding: theme.spacing.lg,
  width: '100%',
  maxWidth: '48rem',
  marginInline: 'auto',
}));

/** The page for the web hash (`#video`), or the first one. */
const pageFromHash = (): string => {
  const hash =
    getProvider().os() === 'web' ? globalThis.location?.hash.slice(1) : '';
  return PAGES.some(page => page.id === hash) ? hash : PAGES[0].id;
};

function Shell() {
  const { mode, toggleMode } = useSettings();
  const [current, setCurrent] = useState(pageFromHash);
  const [overlay, setOverlay] = useState<ReactNode>(null);
  const Current = (PAGES.find(page => page.id === current) ?? PAGES[0])
    .Component;

  // keep the web hash in sync, so a page can be linked and the back button works
  useEffect(() => {
    if (getProvider().os() !== 'web') return;
    const onHash = () => setCurrent(pageFromHash());
    globalThis.addEventListener('hashchange', onHash);
    return () => globalThis.removeEventListener('hashchange', onHash);
  }, []);

  const open = (id: string) => {
    setCurrent(id);
    if (getProvider().os() === 'web') globalThis.location.hash = id;
  };

  return (
    <OverlayProvider value={setOverlay}>
      <Layout>
        <Sidebar>
          <Title>omnistyle</Title>
          <Body muted>One style, every platform.</Body>
          <Nav horizontal showsHorizontalScrollIndicator={false}>
            <NavList>
              {PAGES.map(({ id, title }) => (
                <NavItem
                  key={id}
                  active={id === current}
                  onPress={() => open(id)}
                  testID={`nav-${id}`}>
                  <NavLabel active={id === current}>{title}</NavLabel>
                </NavItem>
              ))}
            </NavList>
          </Nav>
          <Button size="sm" variant="secondary" onPress={toggleMode}>
            <ButtonLabel>
              {mode === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </ButtonLabel>
          </Button>
        </Sidebar>
        <Content
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled">
          <Page key={current}>
            <Current />
          </Page>
        </Content>
        {overlay ? <Overlay {...BOX_NONE}>{overlay}</Overlay> : null}
      </Layout>
    </OverlayProvider>
  );
}

/** The showcase app: one page per feature. The same component runs on web, iOS and Android. */
export function Showcase() {
  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  );
}
