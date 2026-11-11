/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  collectCoverage: false,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testTimeout: 20000,
  // o exemplo compartilhado importa 'omnistyle' como um app real faria
  moduleNameMapper: { '^omnistyle$': '<rootDir>/src/index.ts' },
  // os exemplos têm o próprio tsconfig (estrito, com o EngineTheme do app); aqui só executamos
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: { exclude: ['**/examples/**'] } }],
  },
  modulePathIgnorePatterns: ['/dist/', '/example/', '/node_modules/'],
  testPathIgnorePatterns: [],
  transformIgnorePatterns: ['node_modules'],
};

module.exports = config;
