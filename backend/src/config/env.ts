import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(5006),
  MYSQL_HOST: z.string().min(1),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASSWORD: z.string().min(1),
  MYSQL_DB: z.string().default('bom_prd'),
  FAX_S3_BUCKET: z.string().optional(),
  FAX_S3_PUBLIC_URL: z.string().optional(),
  SANDBOX: z
    .string()
    .default('1')
    .transform((v) => v !== '0'),
  LOG_LEVEL: z.string().default('info'),
  // Transactional email (SES). When MAIL_FROM is unset the mailer falls back to
  // a console transport (logs instead of sending) — safe before creds land.
  // MAIL_PROVIDER selects the transport adapter (extend the enum + factory to
  // add e.g. 'sendgrid'). 'console' forces the log-only transport (staging).
  MAIL_PROVIDER: z.enum(['ses', 'console']).default('ses'),
  MAIL_FROM: z.string().optional(),
  MAIL_REGION: z.string().default('us-west-2'),
  MAIL_CONFIGURATION_SET: z.string().default('bom-transactional'),
  // Both switches are intentionally fail-closed. Deploying code or schema can
  // never start sending mail without an explicit production configuration.
  MAIL_SENDING_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  MAIL_SECURITY_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  MAIL_NOTIFICATIONS_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  MAIL_WORKER_INTERVAL_MS: z.coerce.number().int().min(250).default(1000),
  MAIL_SENDS_PER_SECOND: z.coerce.number().int().min(1).max(14).default(10),
  MAIL_MAX_TRANSACTIONAL_PER_RECIPIENT_HOUR: z.coerce.number().int().min(1).max(100).default(3),
  MAIL_MAX_NOTIFICATIONS_PER_USER_HOUR: z.coerce.number().int().min(1).max(100).default(3),
  MAIL_MAX_NOTIFICATIONS_PER_USER_DAY: z.coerce.number().int().min(1).max(100).default(8),
  MAIL_NONPROD_ALLOWLIST: z.string().default(''),
  MAIL_STAFF_USERS: z.string().default(''),
  MAIL_EVENT_QUEUE_URL: z.string().optional(),
  MAIL_UNSUBSCRIBE_SECRET: z.string().optional(),
  MAIL_RATE_LIMIT_SECRET: z.string().optional(),
  APP_BASE_URL: z.string().default('https://bom.kckern.net'),
  SUPPORTED_LANGUAGES: z
    .string()
    .default('en,fr,de,nl,pt,ko,jpn,zh,ru,hi,eo,es,vn,tgl,th,ukr,tam,swe'),
  // Authentication provider. 'opaque' (default) delegates to the SessionStore
  // token table. 'jwt' and 'cognito' are reserved for future providers.
  AUTH_PROVIDER: z.enum(['opaque', 'jwt', 'cognito']).default('opaque'),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);
