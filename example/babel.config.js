const path = require('path');

/**
 * The isoform JSX runtime + Babel plugin: styled components whose style never reads the theme render
 * as the component underneath, with no wrapper (`configure({ performance: { inline } })` turns it off).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: '@michelgutner/isoform' }]],
    // in a real app: plugins: ['@michelgutner/isoform/babel']
    plugins: [path.resolve(__dirname, '../babel.js')],
  };
};
