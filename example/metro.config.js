const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const libRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Observa a lib (../src) para o Fast Refresh funcionar ao editar o código dela.
config.watchFolders = [libRoot];

// Dependências (react, react-native...) sempre resolvidas a partir do example,
// evitando duas cópias de React quando os arquivos da lib importam algo.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

// `import ... from '@michelgutner/isoform'` (e o JSX runtime dela) aponta direto para o código-fonte da lib.
const LIB_ENTRIES = {
  '@michelgutner/isoform': 'src/index.ts',
  '@michelgutner/isoform/jsx-runtime': 'src/jsx-runtime.ts',
  '@michelgutner/isoform/jsx-dev-runtime': 'src/jsx-dev-runtime.ts',
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const entry = LIB_ENTRIES[moduleName];
  if (entry) {
    return { type: 'sourceFile', filePath: path.resolve(libRoot, entry) };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Módulos desligados no isoform.config.json saem do bundle JS.
const { withIsoform } = require('@michelgutner/isoform/metro');

module.exports = withIsoform(config);
