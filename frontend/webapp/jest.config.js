/**
 * Standalone Jest config, so the test suite no longer needs react-scripts.
 *
 * This is CRA's own effective configuration, dumped verbatim from
 * react-scripts/scripts/utils/createJestConfig while react-scripts was still
 * installed, with its three transforms vendored into config/jest/. Keeping it
 * identical is deliberate: 164 test files were written against these semantics,
 * and `resetMocks: true` in particular is load-bearing — tests rely on mocks
 * being reset between cases without doing it themselves.
 *
 * Pinned to the jest 27 line that react-scripts 5 shipped. Migrating to Vitest
 * (or a newer jest) is a separate change: 234 jest.fn / 93 jest.mock call sites
 * plus fake timers and requireActual would all be in scope at once.
 *
 * moduleNameMapper mirrors the resolve aliases in vite.config.mjs so bundler
 * and test runner resolve identically.
 */
module.exports = {
  roots: ["<rootDir>/src"],

  collectCoverageFrom: ["src/**/*.{js,jsx,ts,tsx}", "!src/**/*.d.ts"],

  setupFiles: [require.resolve("react-app-polyfill/jsdom")],
  setupFilesAfterEnv: [],

  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}",
  ],

  testEnvironment: "jsdom",

  transform: {
    "^.+\\.(js|jsx|mjs|cjs|ts|tsx)$": "<rootDir>/config/jest/babelTransform.js",
    "^.+\\.css$": "<rootDir>/config/jest/cssTransform.js",
    "^(?!.*\\.(js|jsx|mjs|cjs|ts|tsx|css|json)$)": "<rootDir>/config/jest/fileTransform.js",
  },

  transformIgnorePatterns: [
    // yet-another-react-lightbox publishes ESM only, so it must be transformed
    // rather than skipped like the rest of node_modules.
    "[/\\\\]node_modules[/\\\\](?!yet-another-react-lightbox)(.+)\\.(js|mjs|jsx|ts|tsx)$",
    "^.+\\.module\\.(css|sass|scss)$",
  ],

  modulePaths: [],

  moduleNameMapper: {
    "^react-native$": "react-native-web",
    "^.+\\.module\\.(css|sass|scss)$": "identity-obj-proxy",
    // Same four prefixes as vite.config.mjs's resolve.alias.
    "^src/(.*)$": "<rootDir>/src/$1",
    "^views/(.*)$": "<rootDir>/src/views/$1",
    "^components/(.*)$": "<rootDir>/src/components/$1",
    "^models/(.*)$": "<rootDir>/src/models/$1",
    // jest 27 does not honour package "exports" maps, so this subpath needs
    // pointing at the real file.
    "^yet-another-react-lightbox/styles.css$":
      "<rootDir>/node_modules/yet-another-react-lightbox/dist/styles.css",
  },

  moduleFileExtensions: [
    "web.js",
    "js",
    "web.ts",
    "ts",
    "web.tsx",
    "tsx",
    "json",
    "web.jsx",
    "jsx",
    "node",
  ],

  watchPlugins: [
    "jest-watch-typeahead/filename",
    "jest-watch-typeahead/testname",
  ],

  // Load-bearing: see the note above.
  resetMocks: true,

  // CRA left this at jest's default 5000. That was always marginal for the
  // heaviest jsdom tests — Read.test.js renders a full 43-verse chapter, and
  // its slowest case measured ~12.6s for the suite in isolation — and adding a
  // 165th test file tipped it over: the test passed alone but blew the 5s
  // budget in the full run, where a worker is shared with neighbours like
  // WitnessLifeHeatmap.test.js (49.8s). Nothing about the app got slower; the
  // test only ever had 5 seconds of a contended CPU.
  //
  // Raised for the whole suite rather than that one test, so the next
  // borderline case fails honestly instead of flaking. The cost is that a
  // genuinely hung test now takes 15s to report instead of 5s.
  testTimeout: 15000,
};
