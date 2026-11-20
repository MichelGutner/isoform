// provider 'auto' + the theme: the bundler (Vite) loads the React DOM adapter.
import '../../examples/showcase/isoform.config';

import { configure } from 'react-isoform';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Showcase } from '../../examples/showcase';

// Web only: the theme colors become CSS variables, so switching the theme rewrites one `:root` rule
// instead of recompiling and re-rendering every component that only reads a color.
configure({ performance: { themeVariables: ['color'] } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Showcase />
  </StrictMode>,
);
