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

// `import ... from '@michelgutner/isoform'` aponta direto para o código-fonte da lib.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@michelgutner/isoform') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(libRoot, 'src/index.ts'),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Módulos desligados no isoform.config.json saem do bundle JS.
const { withIsoform } = require('@michelgutner/isoform/metro');

module.exports = withIsoform(config);
