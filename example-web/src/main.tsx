// provider 'auto' + the theme: the bundler (Vite) loads the React DOM adapter.
import '../../examples/showcase/isoform.config';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Showcase } from '../../examples/showcase';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Showcase />
  </StrictMode>,
);
