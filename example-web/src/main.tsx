// A MESMA config do app mobile: provider 'auto' → aqui o bundler (Vite) carrega o adapter React DOM.
import '../../examples/shared-ui/omni.config';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Showcase } from '../../examples/shared-ui';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Showcase />
  </StrictMode>,
);
