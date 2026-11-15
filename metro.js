/**
 * Helper do Metro (opcional): tira do bundle JS o código dos módulos desligados
 * no `omnistyle.config.json` da raiz do app.
 *
 *   // metro.config.js
 *   const { withOmnistyle } = require('omnistyle/metro');
 *   module.exports = withOmnistyle(getDefaultConfig(__dirname));
 *
 * Sem o arquivo (ou sem este helper), nada muda: o código fica no bundle e o
 * `configure` decide em runtime.
 */
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = 'omnistyle.config.json';

/** Arquivo de cada módulo → versão vazia (mesmo nome + `.disabled`, mesma extensão). */
const MODULE_FILES = {
  video: /[\\/]adapters[\\/]react-native[\\/]media[\\/]video[\\/]Video\.(tsx|js)$/,
  audio: /[\\/]adapters[\\/]react-native[\\/]media[\\/]audio[\\/]Audio\.(tsx|js)$/,
};

/** `modules` do arquivo (ex.: `{ video: true, audio: { enabled: false } }`), ou `null` se o app não tem o arquivo. */
function readModules(projectRoot) {
  const file = path.join(projectRoot, CONFIG_FILE);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')).modules ?? {};
}

/** `true` ou `{ enabled: true }`. */
const isEnabled = (setting) => setting === true || (typeof setting === 'object' && setting !== null && setting.enabled === true);

const disabledVersion = (filePath) => filePath.replace(/\.(tsx|js)$/, '.disabled.$1');

function withOmnistyle(config, { projectRoot = config.projectRoot ?? process.cwd() } = {}) {
  const modules = readModules(projectRoot);
  if (!modules) return config;

  const off = Object.entries(MODULE_FILES)
    .filter(([name]) => !isEnabled(modules[name]))
    .map(([, pattern]) => pattern);
  if (!off.length) return config;

  const upstream = config.resolver?.resolveRequest;
  const resolveRequest = (context, moduleName, platform) => {
    const resolve = upstream ?? context.resolveRequest;
    const result = resolve(context, moduleName, platform);
    const isOff = result?.type === 'sourceFile' && off.some((pattern) => pattern.test(result.filePath));
    return isOff ? { type: 'sourceFile', filePath: disabledVersion(result.filePath) } : result;
  };

  return { ...config, resolver: { ...config.resolver, resolveRequest } };
}

module.exports = { withOmnistyle, readModules };
