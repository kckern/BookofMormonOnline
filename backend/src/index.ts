import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { createYoga } from 'graphql-yoga';
import { useEngine } from '@envelop/core';
import { execute, parse, subscribe, validate } from 'graphql';
import { env } from './config/env.js';
import { getDb } from './data/db.js';
import { buildSchema } from './graphql/schema.js';
import { buildContext, type AppContext } from './graphql/context.js';
import { resolveLang } from './graphql/lang.js';
import { stripEmptyDeep } from './compat/responseFilter.js';
import { initRealtime } from './realtime/server.js';
import { startBotScheduler } from './bots/scheduler.js';
import { startRetentionJob } from './messaging/retention.js';
import { faxRoutes } from './media/fax/route.js';
import { isInternalLoopback } from './http/rateLimit.js';
import { startEmailWorker } from './email/worker.js';
import { startMailEventConsumer } from './mail/eventConsumer.js';
import { startNotificationEmailScheduler } from './email/notificationScheduler.js';

const app = Fastify({
  logger: { level: env.LOG_LEVEL },
});

const db = getDb();

const yoga = createYoga<{ lang: string; ip: string; bearerToken?: string; ua?: string }, AppContext>({
  schema: buildSchema(),
  graphqlEndpoint: '/graphql',
  landingPage: false,
  // COMPAT: legacy Apollo exposes raw resolver error messages, and the
  // regression baselines pin them — Yoga's default masking would break parity.
  // A4: mask errors in production to prevent raw DB error leakage; keep dev unmasked.
  maskedErrors: process.env.NODE_ENV === 'production',
  logging: app.log,
  context: ({ lang, ip, bearerToken, ua }) => buildContext(db, lang, ip, bearerToken, ua),
  plugins: [
    // COMPAT: pin the graphql-js executor — it builds response maps in
    // selection order (spec); Yoga's default executor appends keys in
    // resolver-completion order, which breaks byte-parity with legacy.
    useEngine({ parse, validate, execute, subscribe }),
    {
      // COMPAT: legacy Apollo formatResponse stripped ''/null/[] keys from data
      onExecutionResult({ result }: { result: unknown }) {
        const r = result as { data?: unknown } | null;
        if (r && typeof r === 'object' && r.data) stripEmptyDeep(r.data);
      },
    },
    {
      // Slow-operation logger: warn with the top-level fields + duration for any
      // GraphQL operation over 1s. Logs field NAMES only (not args) so tokens
      // never hit the log.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onExecute({ args }: { args: any }) {
        const start = Date.now();
        return {
          onExecuteDone() {
            const ms = Date.now() - start;
            if (ms > 1000) {
              const fields = (args.document?.definitions ?? [])
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .flatMap((d: any) => d.selectionSet?.selections ?? [])
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((s: any) => s.name?.value)
                .filter(Boolean)
                .join(', ');
              console.warn(`[slow-gql] ${ms}ms — fields: ${fields}`);
            }
          },
        };
      },
    },
  ],
});

// Accept GraphQL on / and every /{lang} path, like the legacy server (apollo
// middleware mounted per language path). Language resolves from host + the
// ORIGINAL url; Fastify owns body parsing, Yoga gets a clean fetch Request.
const graphqlHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const lang = resolveLang(req.headers.host, req.url);
  const fwd = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd) || req.ip || '';
  // messenger* resolvers identify the acting user from the Bearer token (the
  // frontend MessengerController's gqlRequest sends Authorization: Bearer <token>).
  const authz = req.headers['authorization'];
  const bearerToken =
    typeof authz === 'string' && authz.startsWith('Bearer ') ? authz.slice(7) : undefined;
  const ua = req.headers['user-agent'];
  const response = await yoga.fetch(
    new URL('http://yoga/graphql'),
    {
      method: req.method,
      headers: { 'content-type': req.headers['content-type'] ?? 'application/json' },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    },
    { lang, ip, bearerToken, ua },
  );
  reply.status(response.status);
  response.headers.forEach((value, key) => {
    reply.header(key, value);
  });
  reply.send(Buffer.from(await response.arrayBuffer()));
  return reply;
};

// A3: global per-IP rate limit on public routes. Next SSR calls GraphQL over
// loopback inside this container; exempt that trusted internal hop so unrelated
// crawlers do not collapse into one 127.0.0.1 bucket. Public traffic still has
// the 300/minute ceiling. The fax sub-plugin applies its own tighter 120/min
// limit on top of this.
const rateLimit = (await import('@fastify/rate-limit')).default;
await app.register(rateLimit, {
  max: 300,
  timeWindow: '1 minute',
  allowList: (request) => isInternalLoopback(request.ip),
});

app.get('/health', async () => ({ ok: true }));
app.route({ method: ['GET', 'POST', 'OPTIONS'], url: '/', handler: graphqlHandler });
await app.register(faxRoutes);
app.route({ method: ['GET', 'POST', 'OPTIONS'], url: '/*', handler: graphqlHandler });

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then(async () => {
    app.log.info(`bom-backend listening on :${env.PORT}`);
    // Cutover gate: messaging real-time is on by default; set MESSENGER_ENABLED=false
    // to boot GraphQL-only (kill-switch). Attach socket.io to the underlying Node
    // http.Server (available after listen).
    if (process.env.MESSENGER_ENABLED !== 'false') {
      await initRealtime(app.server);
    } else {
      app.log.info('messaging disabled (MESSENGER_ENABLED=false) — GraphQL only');
    }
    // Bot cron (proactive bot posting). Off by default — opt in with
    // BOT_SCHEDULER_ENABLED=true so it never auto-posts to live channels by
    // accident. Requires a model provider (OPENAI_API_KEY or BOT_LLM_MOCK).
    if (process.env.BOT_SCHEDULER_ENABLED === 'true') {
      startBotScheduler();
    }
    // Message retention (M-7). No-op unless MESSAGE_RETENTION_DAYS is set to a
    // positive integer. Hard-purges soft-deleted rows past the cutoff every 24h.
    startRetentionJob(db);
    // Durable email delivery. The worker itself is fail-closed and does not
    // claim a row unless MAIL_SENDING_ENABLED=true.
    startEmailWorker(db);
    startNotificationEmailScheduler(db);
    await startMailEventConsumer(db);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
