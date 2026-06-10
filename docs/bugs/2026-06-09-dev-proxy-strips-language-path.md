# Dev CRA proxy strips the language path — /ko serves English

**Symptom:** `POST https://bom.kckern.net/ko {query}` returns English content;
`POST http://localhost:5005/ko` (direct backend) correctly returns Korean. Surfaced by
the GraphQL regression suite: all 46 `[ko]` cases fail on `TARGET=dev` (every failure in
the `TARGET=dev npm run test:gql` run except the two `sandboxSkip` types, which now skip).

**Root cause:** `frontend/webapp/src/setupProxy.js` mounts http-proxy-middleware with
`app.use(['/en','/es',…,'/ko',…], createProxyMiddleware({target}))`. Express strips the
mount path before the middleware sees the request, so the proxied request reaches the
backend as `/` and the backend's path-based language detection
(`src/config/apollo.ts` context: `pathlang = req.url.split('/').reverse().shift()`)
falls back to English.

**Fix sketch:** mount the proxy at root with a path filter, or restore the original path
via `pathRewrite`/`(path, req) => req.originalUrl`, so the backend receives `/ko/...`.
This only affects the CRA dev server (dev public URL); prod serves the backend directly
and is unaffected.

**Regression test:** `TARGET=dev npm run test:gql` — the `[ko]` cases. They must pass
once this is fixed; no suite changes needed.

**Status:** FIXED 2026-06-09 (commit 36852f7) — proxy mounted at root with a
segment-aware `pathFilter`. All 46 `[ko]` dev cases green.
