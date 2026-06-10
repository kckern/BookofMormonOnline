import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { createYoga } from 'graphql-yoga';
import { env } from './config/env.js';
import { getDb } from './data/db.js';
import { buildSchema } from './graphql/schema.js';
import { buildContext, type AppContext } from './graphql/context.js';
import { resolveLang } from './graphql/lang.js';
import { stripEmptyDeep } from './compat/responseFilter.js';

const app = Fastify({
  logger: { level: env.LOG_LEVEL },
});

const db = getDb();

const yoga = createYoga<{ lang: string }, AppContext>({
  schema: buildSchema(),
  graphqlEndpoint: '/graphql',
  landingPage: false,
  logging: app.log,
  context: ({ lang }) => buildContext(db, lang),
  plugins: [
    {
      // COMPAT: legacy Apollo formatResponse stripped ''/null/[] keys from data
      onExecutionResult({ result }: { result: unknown }) {
        const r = result as { data?: unknown } | null;
        if (r && typeof r === 'object' && r.data) stripEmptyDeep(r.data);
      },
    },
  ],
});

// Accept GraphQL on / and every /{lang} path, like the legacy server (apollo
// middleware mounted per language path). Language resolves from host + the
// ORIGINAL url; Fastify owns body parsing, Yoga gets a clean fetch Request.
const graphqlHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const lang = resolveLang(req.headers.host, req.url);
  const response = await yoga.fetch(
    'http://yoga/graphql',
    {
      method: req.method,
      headers: { 'content-type': req.headers['content-type'] ?? 'application/json' },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    },
    { lang },
  );
  reply.status(response.status);
  response.headers.forEach((value, key) => {
    reply.header(key, value);
  });
  reply.send(Buffer.from(await response.arrayBuffer()));
  return reply;
};

app.get('/health', async () => ({ ok: true }));
app.route({ method: ['GET', 'POST', 'OPTIONS'], url: '/', handler: graphqlHandler });
app.route({ method: ['GET', 'POST', 'OPTIONS'], url: '/*', handler: graphqlHandler });

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`bom-backend listening on :${env.PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
