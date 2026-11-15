import { useState } from 'react';
import { engine } from 'omnistyle';
import { Breadcrumbs } from './Breadcrumbs';
import { ContentViewer } from './ContentViewer';
import { Menu } from './Menu';
import { Playlist } from './Playlist';
import { course } from './course.mock';
import { useClassroom } from './useClassroom';

/**
 * Layout responsivo da sala de aula:
 *  · celular: conteúdo em cima, menu embaixo;
 *  · desktop (`lg`, ≥ 1024px): conteúdo à esquerda e menu à direita, que pode ser recolhido.
 */

const MENU_WIDTH = 320;

const Page = engine('Scroll', ({ theme }) => ({ flexGrow: 1, backgroundColor: theme.color.background }))
  // na web o contêiner não tem altura definida: garante que o fundo preencha a tela
  .when('web', { style: { minHeight: '100vh' } });

const Layout = engine('Box', ({ theme }) => ({
  width: '100%',
  maxWidth: '90rem',
  marginInline: 'auto',
  padding: theme.spacing.md,
  gap: theme.spacing.lg,
})).when('lg', ({ theme }) => ({
  style: { flexDirection: 'row', alignItems: 'flex-start', padding: theme.spacing.xl },
}));

const Main = engine('Box', ({ theme }) => ({ gap: theme.spacing.lg })).when('lg', { style: { flex: 1, minWidth: 0 } });

const TopBar = engine('Box', { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' });

/** Coluna do menu: no desktop a largura vai a 0 quando recolhido. */
const Aside = engine<'Box', { open: boolean }>('Box', { width: '100%' }).when('lg', ({ props }) => ({
  style: {
    width: props.open ? MENU_WIDTH : 0,
    marginLeft: props.open ? 24 : 0,
    overflow: 'hidden',
    transition: 'width 250ms ease, margin-left 250ms ease',
  },
}));

const OpenMenuButton = engine('Pressable', ({ theme }) => ({
  display: 'none',
  paddingBlock: 6,
  paddingInline: theme.spacing.md,
  borderRadius: theme.borderRadius?.md,
  backgroundColor: theme.color.primary,
}))
  .when('lg', { style: { display: 'flex' } })
  .when('web', { style: { cursor: 'pointer' } });

const OpenMenuLabel = engine('Text', { color: '#ffffff', fontSize: 13, fontWeight: '700' });

export function Classroom() {
  const classroom = useClassroom(course);
  const [isMenuOpen, setIsMenuOpen] = useState(true);

  return (
    <Page>
      <Layout>
        <Main>
          <TopBar>
            <Breadcrumbs items={course.breadcrumb} />
            {isMenuOpen ? null : (
              <OpenMenuButton onPress={() => setIsMenuOpen(true)} testID="open-menu">
                <OpenMenuLabel>‹ Conteúdo</OpenMenuLabel>
              </OpenMenuButton>
            )}
          </TopBar>

          <ContentViewer
            asset={classroom.current}
            moduleTitle={classroom.currentModule.title}
            isLoading={classroom.isLoading}
            isCompleted={classroom.completedIds.has(classroom.current.id)}
            onToggleCompleted={() => classroom.toggleCompleted(classroom.current.id)}
            onPrevious={classroom.goPrevious}
            onNext={classroom.goNext}
          />
        </Main>

        <Aside open={isMenuOpen}>
          <Menu
            title={course.title}
            subtitle={course.subtitle}
            progress={classroom.progress}
            onCollapse={() => setIsMenuOpen(false)}
          >
            <Playlist
              modules={course.modules}
              currentId={classroom.current.id}
              currentModuleId={classroom.currentModule.id}
              completedIds={classroom.completedIds}
              onSelect={classroom.select}
            />
          </Menu>
        </Aside>
      </Layout>
    </Page>
  );
}
