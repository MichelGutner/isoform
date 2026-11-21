import { useEffect, useState, type ReactNode } from 'react';
import { engine, getProvider } from 'react-isoform';
import { PAGES } from './pages';
import { OverlayProvider, SettingsProvider, useSettings } from './settings';
import { Body, Button, ButtonLabel, Title, themeFade } from './ui';

/** The whole layout: a column on phones (navigation on top), a row from `md` (sidebar on the left). */
const Layout = engine('Box', { flex: 1, flexDirection: 'column' })
  .when('breakpoints:md', { style: { flexDirection: 'row' } })
  // on the web the root is not a flex container: fix the height so the content scrolls inside it
  .when('platform:web', { style: { height: '100vh', overflow: 'hidden' } });

/** The page list. On phones it is a screen of its own (hidden while a page is open); from `md` it is the sidebar. */
const Sidebar = engine<'Box', { away?: boolean }>('Box', ({ theme }) => ({
  transition: themeFade(),
  flex: 1,
  gap: theme.spacing.sm,
  padding: theme.spacing.md,
  backgroundColor: theme.color.surface,
}))
  .when('props:away', { style: { display: 'none' } })
  .when('platform:web', { style: { minHeight: 0 } })
  .when('breakpoints:md', {
    style: {
      display: 'flex',
      flexBasis: 'auto',
      flexGrow: 0,
      flexShrink: 0,
      width: 240,
      borderRightWidth: 1,
      padding: 20,
    },
  });

const SidebarHeader = engine('Box', ({ theme }) => ({ gap: theme.spacing.xs }));

/** The scrolling list of pages: vertical, and it takes the height the header leaves. */
const Nav = engine('Scroll', { flex: 1 }).when('platform:web', {
  style: { minHeight: 0 },
});

const NavList = engine('Box', ({ theme }) => ({ gap: theme.spacing.xs }));

const NavItem = engine<'Pressable', { active?: boolean }>(
  'Pressable',
  ({ theme }) => ({
    transition: themeFade('opacity 150ms'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBlock: 14,
    paddingInline: 16,
    borderRadius: theme.borderRadius?.md ?? 14,
    borderWidth: 1,
    borderColor: theme.color.border,
  }),
)
  .attrs({ role: 'button' })
  .when('state:hover', ({ theme }) => ({
    style: { backgroundColor: theme.color.background },
  }))
  .when('props:active', ({ theme }) => ({
    style: { backgroundColor: theme.color.primary, borderColor: theme.color.primary },
  }))
  .when('platform:web', { style: { cursor: 'pointer' } })
  .when('breakpoints:md', {
    style: { paddingBlock: 8, paddingInline: 14, borderWidth: 0 },
  });

const NavLabel = engine<'Text', { active?: boolean }>(
  'Text',
  ({ theme, props }) => ({
    transition: themeFade(),
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    color: props.active ? '#ffffff' : theme.color.text,
  }),
).when('breakpoints:md', { style: { fontSize: 14 } });

/** The "›" at the end of a row: a phone hint that the row opens a screen. */
const NavChevron = engine<'Text', { active?: boolean }>(
  'Text',
  ({ theme, props }) => ({
    fontSize: 20,
    color: props.active ? '#ffffff' : theme.color.muted,
  }),
).when('breakpoints:md', { style: { display: 'none' } });

/** The column next to the sidebar: the phone's top bar and the page. Hidden on phones while the list is showing. */
const Main = engine<'Box', { away?: boolean }>('Box', { flex: 1 })
  .when('props:away', { style: { display: 'none' } })
  .when('platform:web', { style: { minHeight: 0, minWidth: 0 } })
  .when('breakpoints:md', { style: { display: 'flex' } });

/** Phone only: back to the list, the page name and the theme switch. */
const TopBar = engine('Box', ({ theme }) => ({
  transition: themeFade(),
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing.sm,
  paddingBlock: theme.spacing.sm,
  paddingInline: theme.spacing.md,
  borderBottomWidth: 1,
  borderColor: theme.color.border,
  backgroundColor: theme.color.surface,
})).when('breakpoints:md', { style: { display: 'none' } });

const TopBarTitle = engine('Text', ({ theme }) => ({
  transition: themeFade(),
  flex: 1,
  fontSize: 16,
  fontWeight: '800',
  textAlign: 'center',
  color: theme.color.text,
}));

const Content = engine('Scroll', { flex: 1, backgroundColor: 'transparent' }).when('platform:web', {
  style: { minHeight: 0 },
});

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

/** The page id in the web hash (`#video`), when it names a page. */
const hashPage = (): string | undefined => {
  const hash =
    getProvider().os() === 'web' ? globalThis.location?.hash.slice(1) : '';
  return PAGES.find(page => page.id === hash)?.id;
};

/** The page for the web hash, or the first one. */
const pageFromHash = (): string => hashPage() ?? PAGES[0].id;

/** On phones the list and the page are separate screens: a link to a page opens the page, otherwise the list shows first. */
type Screen = 'list' | 'page';
const screenFromHash = (): Screen => (hashPage() ? 'page' : 'list');

function Shell() {
  const { mode, toggleMode } = useSettings();
  const [current, setCurrent] = useState(pageFromHash);
  const [screen, setScreen] = useState<Screen>(screenFromHash);
  const [overlay, setOverlay] = useState<ReactNode>(null);
  const entry = PAGES.find(page => page.id === current) ?? PAGES[0];
  const Current = entry.Component;
  const pageOpen = screen === 'page';

  // keep the web hash in sync, so a page can be linked and the back button works
  useEffect(() => {
    if (getProvider().os() !== 'web') return;
    const onHash = () => {
      setCurrent(pageFromHash());
      setScreen(screenFromHash());
    };
    globalThis.addEventListener('hashchange', onHash);
    return () => globalThis.removeEventListener('hashchange', onHash);
  }, []);

  const open = (id: string) => {
    setCurrent(id);
    setScreen('page');
    if (getProvider().os() === 'web') globalThis.location.hash = id;
  };

  const showList = () => {
    setScreen('list');
    // clear the hash without leaving a "#" behind, so the back button and a reload agree with the screen
    if (getProvider().os() === 'web') {
      globalThis.history.pushState(null, '', globalThis.location.pathname);
    }
  };

  return (
    <OverlayProvider value={setOverlay}>
      <Layout>
        <Sidebar away={pageOpen}>
          <SidebarHeader>
            <Title>isoform</Title>
            <Body muted>One style, every platform.</Body>
          </SidebarHeader>
          <Nav showsVerticalScrollIndicator={false}>
            <NavList>
              {PAGES.map(({ id, title }) => (
                <NavItem
                  key={id}
                  active={id === current}
                  onPress={() => open(id)}
                  testID={`nav-${id}`}>
                  <NavLabel active={id === current}>{title}</NavLabel>
                  <NavChevron active={id === current}>›</NavChevron>
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
        <Main away={!pageOpen}>
          <TopBar>
            <Button
              size="sm"
              variant="secondary"
              onPress={showList}
              testID="nav-back">
              <ButtonLabel>‹ Pages</ButtonLabel>
            </Button>
            <TopBarTitle numberOfLines={1}>{entry.title}</TopBarTitle>
            <Button size="sm" variant="secondary" onPress={toggleMode}>
              <ButtonLabel>{mode === 'dark' ? '☀️' : '🌙'}</ButtonLabel>
            </Button>
          </TopBar>
          <Content
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled">
            <Page key={current}>
              <Current />
            </Page>
          </Content>
        </Main>
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
