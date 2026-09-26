import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Vite config, added ALONGSIDE react-scripts during the migration off CRA.
 *
 * The contract this must preserve is a directory shape, not a toolchain: the
 * build emits `build/` containing `index.html` plus `static/js/main.<hash>.js`,
 * exactly as CRA did, because four things downstream depend on that layout:
 *   - frontend/next/middleware.ts proxies only `/static/` (CRA_ASSET_PREFIXES)
 *   - public/sw.js cache-busts on `/static/`
 *   - config/cra-index.html's error handler matches filenames containing "main."
 *   - Dockerfile copies frontend/webapp/build, and pm2 serves it with `serve -s`
 * Keep those in sync if the output names ever change.
 *
 * Run with `npm run start:vite` / `npm run build:vite`; the react-scripts
 * scripts still work unchanged so both toolchains coexist until the cutover.
 */

// Language prefixes the backend answers on. GraphQL is POSTed to /{lang}, so
// these must proxy rather than fall through to the SPA (same list as the
// setupProxy.js this replaces).
const LANGS = "en|es|fr|de|ko|vn|tr|ru|tgl|slv|swe";

export default defineConfig(({ mode }) => {
  // Same filenames CRA read (.env, .env.development.local, ...), filtered to the
  // REACT_APP_ prefix, and merged with process.env so the Dockerfile's
  // REACT_APP_CLICKY_* build args keep working.
  const env = loadEnv(mode, __dirname, "REACT_APP_");
  const backend =
    process.env.REACT_APP_LOCAL_BACKEND === "true"
      ? `http://localhost:${process.env.REACT_APP_LOCAL_BACKEND_PORT || "5006"}`
      : "https://bookofmormon.online";
  const port = Number(process.env.PORT) || 8201;

  // Shared by `vite` (dev) and `vite preview`. Regex keys: string keys are
  // prefix matches, which would send /enos-1 to the backend along with /en.
  const proxy = {
    "^/(graphql|api)(/|$)": { target: backend, changeOrigin: true },
    "^/messenger(/|$)": { target: backend, changeOrigin: true, ws: true },
    "^/fax/(render|text|boxes)(/|$)": { target: backend, changeOrigin: true },
    [`^/(${LANGS})(/|$)`]: { target: backend, changeOrigin: true },
  };

  return {
    // 293 .js files contain JSX. Renaming them all to .jsx would also mean
    // rewriting ~96 imports that carry explicit .js extensions (34 of them the
    // lazy() route imports), so that is a separate change. Until then, let
    // plugin-react's Babel transform cover .js as well as .jsx — overriding
    // esbuild's `include` instead stops .jsx being transformed at all.
    plugins: [react({ include: /\.(js|jsx)$/ })],

    define: {
      // CRA inlined these; Vite does not touch process.env by default.
      ...Object.fromEntries(
        Object.entries(env).map(([k, v]) => [`process.env.${k}`, JSON.stringify(v)]),
      ),
      "process.env.NODE_ENV": JSON.stringify(
        mode === "production" ? "production" : "development",
      ),
      // webpack 5 shimmed `global`; Vite does not. Utils.js (global.dictionary),
      // Main.js (global._appDispatch) and appController.js rely on it.
      global: "globalThis",
    },

    resolve: {
      // config-overrides.js pushed `src` and the package root onto
      // webpack's resolve.modules, which is how ~550 `src/...` imports resolve.
      // Regex-anchored so a real package named `src`/`models` could not match.
      // Deliberately the same four prefixes as jest.moduleNameMapper in
      // package.json, so the bundler and the test runner resolve identically.
      // In use today: src/ (588 imports), models/ (2), views/ (1).
      alias: [
        { find: /^src\//, replacement: path.resolve(__dirname, "src") + "/" },
        { find: /^views\//, replacement: path.resolve(__dirname, "src/views") + "/" },
        { find: /^components\//, replacement: path.resolve(__dirname, "src/components") + "/" },
        { find: /^models\//, replacement: path.resolve(__dirname, "src/models") + "/" },
      ],
    },

    // Three layers have to agree that a .js file may contain JSX:
    //   - esbuild, which transforms the entry reached from index.html (and must
    //     therefore also still cover .jsx, or those stop being transformed)
    //   - plugin-react's Babel pass above, which adds react-refresh
    //   - the dependency pre-bundler
    esbuild: { loader: "jsx", include: /src\/.*\.(js|jsx)$/, exclude: [] },
    optimizeDeps: {
      // Only the real entry. config/cra-index.html is react-scripts' template
      // and would otherwise be scanned as a second entry (it has no module
      // script and still contains %PUBLIC_URL%).
      entries: ["index.html"],
      esbuildOptions: { loader: { ".js": "jsx" } },
    },

    css: {
      preprocessorOptions: {
        scss: {
          // The paper-dashboard theme (138 scss files) is written against the
          // legacy Sass API. Silence its deprecations rather than rewrite it.
          silenceDeprecations: [
            "import",
            "global-builtin",
            "color-functions",
            "mixed-decls",
            "legacy-js-api",
          ],
        },
      },
    },

    server: {
      port,
      strictPort: true,
      host: true,
      allowedHosts: true,
      // The Next front door proxies with fetch(), which cannot carry a
      // WebSocket upgrade, so HMR must be reached directly on this port.
      hmr: { clientPort: port },
      // Ported from src/setupProxy.js, which only react-scripts loads.
      proxy,
    },

    // `vite preview` serves the real build; give it the same proxy so the built
    // app can be exercised against the backend without the Next front door.
    preview: { port: 8299, strictPort: true, proxy },

    // Vitest replaces the CRA-era jest 27 setup (jest.config.js + the vendored
    // transforms in config/jest/). It runs through this very Vite config, so the
    // resolve.alias block above is the single source of truth for module
    // resolution — bundler and test runner can no longer drift, which the old
    // moduleNameMapper duplication made easy.
    //
    // Why the switch was forced rather than cosmetic: jest 27 cannot parse
    // ESM-only packages, and html-react-parser 6 (needed for React 19) is
    // ESM-only. 74 suites died on "Cannot use import statement outside a
    // module". Vitest consumes ESM natively, so transformIgnorePatterns and the
    // yet-another-react-lightbox exports-map workaround are both gone.
    test: {
      globals: true,
      environment: "jsdom",
      // Mirrors CRA's testMatch. Every file under a __tests__ dir here is a
      // real test — verified, no fixtures — so this stays equivalent.
      include: [
        "src/**/__tests__/**/*.{js,jsx,ts,tsx}",
        "src/**/*.{spec,test}.{js,jsx,ts,tsx}",
      ],
      // LOAD-BEARING, carried over from jest's `resetMocks: true`: 164 test
      // files were written assuming mocks reset between cases without doing it
      // themselves. Dropping this silently cross-contaminates tests.
      mockReset: true,
      // Same 15s the jest config carried, and for the same reason: the heaviest
      // jsdom tests render a full chapter and blow a 5s budget under parallel
      // load. Vitest's default is also 5s, so this must be restated or the
      // ImageChanger/Read-class tests flake again.
      testTimeout: 15000,
      // CSS imports are no-ops, matching what CRA's cssTransform did. There are
      // no *.module.css files, so no class-name mapping is needed either.
      css: false,
    },

    build: {
      // Kept as a safety net for any CommonJS that reappears under src/.
      // Note it only applies to `vite build` — Vite's dev server serves native
      // ESM, so a CJS source file breaks dev even when the build succeeds.
      // That is why Bible/data.js and MapMarkers.js were converted to ESM.
      commonjsOptions: { include: [/node_modules/, /src\//] },
      // Explicit, because this decides who can use the site and should not be an
      // invisible framework default. These are Vite 7's own
      // "baseline-widely-available" values, pinned so a Vite upgrade cannot
      // silently move them.
      //
      // NOT derived from the old browserslist query (">0.2%, not dead"): that
      // resolves to chrome109/firefox120/safari18.5 today, which is NARROWER
      // than this. The package.json browserslist field was removed rather than
      // wired up, because honouring it would have REDUCED compatibility.
      // CSS vendor prefixing follows this target via esbuild (verified: the
      // built CSS carries more -webkit- rules than the source does).
      target: ["chrome107", "edge107", "firefox104", "safari16"],
      outDir: "build",
      assetsDir: "static",
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: "static/js/main.[hash].js",
          chunkFileNames: "static/js/[name].[hash].chunk.js",
          assetFileNames: "static/[ext]/[name].[hash][extname]",
        },
      },
    },
  };
});
