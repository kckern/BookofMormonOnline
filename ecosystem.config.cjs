// pm2 runs the 3 greenfield processes inside the single container. Real runtime
// env (DB creds, clickySiteAdmin, CLICKY_*, SANDBOX, NODE_ENV, …) is injected by
// the container from Infisical via the compose env_file; the only fixed values
// here are the intra-container ports. NPM fronts the container:
//   /graphql,/api,/messenger(WS) -> backend:5005 ; everything else -> next:8200.
module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: '/app/backend',
      script: 'dist/src/index.js',
      env: { PORT: '5005' },
      max_memory_restart: '500M',
    },
    {
      name: 'next',
      cwd: '/app/frontend/next',
      script: '/app/frontend/next/node_modules/.bin/next',
      args: 'start --port 8200',
      // SSR runs in the same container as Fastify. Keep the local-development
      // fallback (:5006) out of production or reading-page renders fail with
      // ECONNREFUSED while the browser-facing GraphQL proxy still appears healthy.
      env: { GRAPHQL_URL: 'http://localhost:5005/graphql' },
      // Production SSR crawler bursts stabilize around 400–430 MiB. The old
      // 400M limit recycled Next every few minutes and exposed NPM 502s during
      // each single-worker restart; retain headroom while preserving a guard.
      max_memory_restart: '768M',
    },
    {
      name: 'cra',
      cwd: '/app',
      script: '/usr/local/bin/serve',
      args: '-s frontend/webapp/build -l 8201',
      max_memory_restart: '128M',
    },
  ],
};
