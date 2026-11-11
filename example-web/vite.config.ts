import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const lib = path.resolve(__dirname, '../src/index.ts');
const sharedUi = path.resolve(__dirname, '../examples/shared-ui');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // aponta para o código-fonte da lib (no app real: `npm i omnistyle`)
      omnistyle: lib,
    },
    // uma única cópia de React, mesmo com arquivos fora desta pasta
    dedupe: ['react', 'react-dom'],
  },
  server: { fs: { allow: [path.resolve(__dirname, '..')] } },
  // a lib de UI compartilhada fica fora do projeto
  optimizeDeps: { entries: ['index.html', path.join(sharedUi, '**/*.tsx')] },
});
