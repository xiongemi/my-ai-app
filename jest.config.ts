import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Handle module path aliases (matching tsconfig.json paths)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^marked$': '<rootDir>/node_modules/marked/lib/marked.cjs',
  },
  // Mock web streams API for tests
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  // Transform ES modules from node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(marked)/)',
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);

