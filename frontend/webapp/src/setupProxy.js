const { createProxyMiddleware } = require('http-proxy-middleware');

// Use local backend if running via 'npm run dev' from root, otherwise use production.
// Local target defaults to the GREEN-FIELD backend (:5006, GraphQL + /messenger socket.io).
// Override with REACT_APP_LOCAL_BACKEND_PORT=5005 to fall back to the legacy backend.
const LOCAL_PORT = process.env.REACT_APP_LOCAL_BACKEND_PORT || '5006';
const BACKEND_URL = process.env.REACT_APP_LOCAL_BACKEND === 'true'
  ? `http://localhost:${LOCAL_PORT}`
  : 'https://bookofmormon.online';

const API_PATHS = [
  '/graphql', '/api', '/messenger', // /messenger = green-field socket.io (WS upgrade)
  '/fax/render', '/fax/text', '/fax/boxes', // dynamic facsimile render API (backend :5006).
                                    // Prefixes only — the client-side viewer route
                                    // /fax/:version stays in the SPA.
  '/en', '/es', '/fr', '/de', '/ko', '/vn', '/tr', '/ru', '/tgl', '/slv', '/swe',
];

// Segment-aware match (like Express mounts): '/ko' and '/ko/x' proxy, '/enos-1' does not
const isApiPath = (pathname) =>
  API_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

module.exports = function(app) {
  console.log(`[Proxy] Proxying API requests to: ${BACKEND_URL}`);

  // Mounted at root with pathFilter: mounting via app.use('/ko', ...) made Express
  // strip the mount path, so the backend received "/" and language detection fell
  // back to English (docs/bugs/2026-06-09-dev-proxy-strips-language-path.md)
  app.use(
    createProxyMiddleware({
      target: BACKEND_URL,
      changeOrigin: true,
      secure: BACKEND_URL.startsWith('https'),
      ws: true, // proxy the socket.io WebSocket upgrade on /messenger
      pathFilter: isApiPath,
    })
  );
};
