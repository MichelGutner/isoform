// Provider 'auto' + tema do Dende: o bundler (Vite) carrega o adapter React DOM.
import '../../examples/shared-ui/classroom/config';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Showcase } from '../../examples/shared-ui';
import { Classroom } from '../../examples/shared-ui/classroom';

// `?showcase` abre a vitrine de componentes; o padrão é a sala de aula.
const Root = location.search.includes('showcase') ? Showcase : Classroom;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
