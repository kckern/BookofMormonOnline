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
      // SSR fetches this process in-container, so a recycle briefly refuses
      // connections and 500s every crawler mid-render. The 500M limit clipped
      // normal crawler-burst working set (~530 MiB observed) and recycled hourly;
      // give the same headroom the `next` process gets. Retry in lib/graphql.ts
      // bridges the gap; this reduces how often it is exercised.
      // See docs/bugs/2026-09-08-npm-5xx-burst-ssr-econnrefused.md.
      max_memory_restart: '768M',
    },
    {
      name: 'next',
      cwd: '/app/frontend/next',
      // Do not accept SSR traffic until the colocated GraphQL process is
      // listening. This removes the startup ECONNREFUSED/false-404 window.
      script: '/app/ops/container/start-next.mjs',
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
