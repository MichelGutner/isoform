/** @type {import('jest').Config} */
const base = require('./jest.config.js');

module.exports = {
  ...base,
  testMatch: ['**/*.bench.ts'],
};
