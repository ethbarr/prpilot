/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFiles: ['jest-webextension-mock'],
  moduleNameMapper: {
    '^webextension-polyfill$': '<rootDir>/src/__mocks__/browser.ts',
  },
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/types/**',
    '!src/__mocks__/**',
    '!src/content/content.ts',  // browser runtime — integration tested manually
    '!src/content/ui.ts',       // DOM injection — integration tested manually
    '!src/popup/popup.ts',      // browser runtime — integration tested manually
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
