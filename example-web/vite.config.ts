import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const lib = path.resolve(__dirname, '../src/index.ts');
const showcase = path.resolve(__dirname, '../examples/showcase');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // aponta para o código-fonte da lib (no app real: `npm i isoform`)
      isoform: lib,
    },
    // uma única cópia de React, mesmo com arquivos fora desta pasta; o pdf.js
    // (dependência da lib) também vem daqui, já que a lib é lida do código-fonte
    dedupe: ['react', 'react-dom', 'pdfjs-dist'],
  },
  server: { fs: { allow: [path.resolve(__dirname, '..')] } },
  // a lib de UI compartilhada fica fora do projeto
  optimizeDeps: { entries: ['index.html', path.join(showcase, '**/*.tsx')] },
});
