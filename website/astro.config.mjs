// @ts-check
import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLinksValidator from 'starlight-links-validator';

const repo = 'https://github.com/MichelGutner/isoform';
const root = fileURLToPath(new URL('..', import.meta.url));
// The live examples import the library from its source, like example-web does.
const lib = fileURLToPath(new URL('../src/index.ts', import.meta.url));

/**
 * Public address of the site (canonical URLs, sitemap). Deployed on Vercel at the domain root:
 * `SITE_URL` wins when set; otherwise Vercel's production domain; otherwise the default.
 */
const productionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const site =
  process.env.SITE_URL ?? (productionDomain ? `https://${productionDomain}` : 'https://isoform-kappa.vercel.app');

/** One sidebar group whose pages are listed in order (slugs under src/content/docs). */
const group = (label, items) => ({ label, items });

export default defineConfig({
  site,
  trailingSlash: 'always',
  integrations: [
    react(),
    starlight({
      title: 'Isoform',
      description:
        'One styling and component API for React and React Native: write a component once, run it on the web, iOS and Android.',
      logo: { src: './src/assets/logo.svg', alt: 'Isoform' },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: repo }],
      editLink: { baseUrl: `${repo}/edit/main/website/` },
      lastUpdated: true,
      customCss: ['./src/styles/custom.css'],
      // English lives at the root. To add Portuguese later: create src/content/docs/pt-br/
      // and add `'pt-br': { label: 'Português do Brasil', lang: 'pt-BR' }` below.
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
      },
      plugins: [starlightLinksValidator({ errorOnLocalLinks: true })],
      sidebar: [
        group('Getting started', [
          'getting-started/introduction',
          'getting-started/installation',
          'getting-started/quick-start',
          'getting-started/comparison',
          'getting-started/configuration',
        ]),
        group('Guides', [
          'guides/style-vocabulary',
          'guides/theming',
          'guides/conditions',
          'guides/responsive',
          'guides/states',
          'guides/pseudo-elements',
          'guides/animations',
          'guides/platform-differences',
          'guides/composition',
          'guides/typescript',
          'guides/server-side-rendering',
          'guides/performance',
          'guides/how-it-works',
        ]),
        group('Primitives', [
          'primitives/overview',
          'primitives/box',
          'primitives/text',
          'primitives/pressable',
          'primitives/input',
          'primitives/image',
          'primitives/scroll',
          'primitives/native-and-legacy',
        ]),
        group('Native modules', [
          'modules/overview',
          'modules/video',
          'modules/audio',
          'modules/playlists',
          'modules/pdf',
          'modules/sheet',
          'modules/svg',
          'modules/camera',
          'modules/date-picker',
          'modules/image',
          'modules/modal',
        ]),
        group('API reference', [
          'reference/configure',
          'reference/engine',
          'reference/engine-component',
          'reference/keyframes',
          'reference/theme',
          'reference/images',
          'reference/get-style-text',
          'reference/platform-adapter',
          'reference/jsx-runtime',
          'reference/types',
        ]),
        group('Recipes', [
          'recipes/button-variants',
          'recipes/dark-mode',
          'recipes/responsive-layout',
          'recipes/form-field',
          'recipes/icons',
          'recipes/testing',
          'recipes/troubleshooting',
        ]),
        group('Project', [
          'project/migration',
          'project/contributing',
          'project/changelog',
        ]),
      ],
    }),
  ],
  vite: {
    resolve: {
      alias: { 'react-isoform': lib },
      // One copy of React (and of pdf.js, a dependency of the lib) even though the
      // library's files live outside this folder: they resolve from website/node_modules.
      dedupe: ['react', 'react-dom', 'pdfjs-dist'],
    },
    server: { fs: { allow: [root] } },
    // The PDF example ships pdf.js's worker (~1 MB), loaded only on the PDF page.
    build: { chunkSizeWarningLimit: 1200 },
  },
});
