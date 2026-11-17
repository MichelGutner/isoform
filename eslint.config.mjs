import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ['dist/**', 'coverage/**', 'example/**', 'example-web/**', 'docs/**', 'website/**'] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-unused-vars': 'warn',
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    // codegen specs: React Native's codegen needs `{}` for events without a payload
    files: ['src/adapters/react-native/**/native/*NativeComponent.ts'],
    rules: { '@typescript-eslint/no-empty-object-type': 'off' },
  },
  {
    // tests build loose mocks and fixtures
    files: ['**/*.test.{ts,tsx}', '**/*.bench.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
];
