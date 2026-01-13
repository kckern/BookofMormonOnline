const { createProxyMiddleware } = require('http-proxy-middleware');

// Use local backend if running via 'npm run dev' from root, otherwise use production
const BACKEND_URL = process.env.REACT_APP_LOCAL_BACKEND === 'true' 
  ? 'http://localhost:5005' 
  : 'https://bookofmormon.online';

module.exports = function(app) {
  console.log(`[Proxy] Proxying API requests to: ${BACKEND_URL}`);
  
  // Proxy API requests
  app.use(
    '/graphql',
    createProxyMiddleware({
      target: BACKEND_URL,
      changeOrigin: true,
      secure: BACKEND_URL.startsWith('https'),
    })
  );
  
  // Proxy language endpoints (used by Theater, etc)
  app.use(
    ['/en', '/es', '/fr', '/de', '/ko', '/vn', '/tr', '/ru', '/tgl', '/slv', '/swe'],
    createProxyMiddleware({
      target: BACKEND_URL,
      changeOrigin: true,
      secure: BACKEND_URL.startsWith('https'),
    })
  );
  
  // Proxy API endpoints
  app.use(
    '/api',
    createProxyMiddleware({
      target: BACKEND_URL,
      changeOrigin: true,
      secure: BACKEND_URL.startsWith('https'),
    })
  );
};
