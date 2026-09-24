// pm2 runs the 3 greenfield processes inside the single container. Real runtime
// env (DB creds, clickySiteAdmin, CLICKY_*, SANDBOX, NODE_ENV, …) is injected by
// the container from Infisical via the compose env_file; the only fixed values
// here are the intra-container ports. NPM fronts the container:
//   /graphql,/api,/messenger(WS) -> backend:5005 ; everything else -> next:8200.
// Logs go to the container's stdout ONLY — never to files inside the container.
// pm2 writes ~/.pm2/logs/<app>-out.log with NO rotation (pm2-logrotate is a
// module, and modules are not started under pm2-runtime), so these files grew
// to 1.6 GB in two weeks, filled the 34 GB root, and made the blue-green deploy
// refuse to pull an image ("disk remains 90% full after emergency prune").
// Nothing is lost: pm2-runtime still forwards every line to its own stdout
// (verified: identical output with and without this redirection), and that
// stdout is exactly what Vector's docker_logs source ships to VictoriaLogs.
// Docker's own json.log is bounded by --log-opt in ops/production/deploy-blue-green.sh.
const LOGS_TO_STDOUT = { out_file: '/dev/null', error_file: '/dev/null' };

module.exports = {
  apps: [
    {
      name: 'backend',
      ...LOGS_TO_STDOUT,
      cwd: '/app/backend',
      script: 'dist/src/index.js',
      // NODE_ENV hard-pinned (not only from the rendered .env): GraphQL error
      // masking + introspection-disable gate on it, so a missing env var must not
      // silently open them up (2026-09-08 security audit).
      env: { PORT: '5005', NODE_ENV: 'production' },
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
      ...LOGS_TO_STDOUT,
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
      ...LOGS_TO_STDOUT,
      cwd: '/app',
      script: '/usr/local/bin/serve',
      args: '-s frontend/webapp/build -l 8201',
      max_memory_restart: '128M',
    },
  ],
};
