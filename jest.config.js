export default {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  moduleFileExtensions: ['js', 'json', 'mjs'],
  transform: {},
  collectCoverageFrom: [
    'app.js',
    'ventas.js',
    'gestion.js',
    'utils/**/*.js',
    'services/**/*.js',
    'schemas/**/*.js',
    '!**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@schemas/(.*)$': '<rootDir>/schemas/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};