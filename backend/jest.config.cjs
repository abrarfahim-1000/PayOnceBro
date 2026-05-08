// jest.config.cjs
// Test runner configuration for the Member 1 unit-test suite.
//
// Why .cjs and not .js: the backend's package.json has `"type": "module"`,
// which makes every `.js` file an ES module. Jest's config loader expects
// `module.exports = ...` (CommonJS), so we use the `.cjs` extension to
// override the package-level setting just for this one file.

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // The test files use `import` syntax. Jest supports ESM via the
  // experimental VM modules flag — see the `test` script in package.json.
  transform: {},
  // Each test file should be isolated; clear mocks between cases.
  clearMocks: true,
  // The default 5s timeout is too tight for Supabase round-trips.
  testTimeout: 30000,
  verbose: true,
};
