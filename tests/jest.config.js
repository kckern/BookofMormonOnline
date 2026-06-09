const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname, '..'),
  roots: ['<rootDir>/tests'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  testTimeout: 120000,
  maxWorkers: 1, // serial: mutation ordering + politeness to prod
  verbose: true,
  transform: {
    // configFile/babelrc false: never pick up CRA babel config from frontend/webapp
    '^.+\\.js$': ['babel-jest', {
      configFile: false,
      babelrc: false,
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    }],
  },
};
