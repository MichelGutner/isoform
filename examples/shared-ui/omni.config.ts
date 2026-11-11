import { configure } from 'omnistyle';
import { lightTokens } from './tokens';

/**
 * UM arquivo de configuração para os dois apps.
 *
 * `provider: 'auto'` usa o que o bundler incluiu: React Native no Metro
 * (iOS/Android) e React DOM no Vite/Next/webpack. Dá para ser explícito:
 *   configure({ provider: 'react-native', theme })  // app mobile
 *   configure({ provider: 'react', theme })         // app web
 */
configure({
  provider: 'auto',
  theme: lightTokens,
});
