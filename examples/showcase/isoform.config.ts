import { configure } from '@michelgutner/isoform';
// Módulos opcionais (todos desligados por padrão). O MESMO arquivo é lido pelo
// build nativo (Gradle/CocoaPods) e pelo Metro: o que está desligado nem entra no app.
// Num app de verdade ele fica na raiz do app; aqui, na raiz do app mobile de exemplo.
import isoform from '../../example/isoform.config.json';
import { lightTokens } from './tokens';

/**
 * UM arquivo de configuração para os dois apps.
 *
 * `provider: 'auto'` usa o que o bundler incluiu: React Native no Metro
 * (iOS/Android) e React DOM no Vite/Next/webpack. Dá para ser explícito:
 *   configure({ provider: 'react-native', theme })  // app mobile
 *   configure({ provider: 'react', theme })         // app web
 */
/**
 * Measurement switch: `true` lets the isoform JSX runtime render theme-free styled components as the
 * component underneath (no wrapper). Only where the app's Babel config uses the runtime (the mobile app).
 */
export const INLINE = true;

configure({
  provider: 'auto',
  theme: lightTokens,
  modules: isoform.modules,
  performance: { inline: INLINE },
});
