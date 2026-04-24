import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFiles: ['jest-webextension-mock'],
  moduleNameMapper: {
    '^webextension-polyfill$': '<rootDir>/src/__mocks__/browser.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/types/**',
    '!src/__mocks__/**',
    '!src/content/content.ts',
    '!src/popup/popup.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  testMatch: ['**/*.test.ts'],
};

export default config;
