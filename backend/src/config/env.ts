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
  MAIL_FROM: z.string().optional(),
  MAIL_REGION: z.string().default('us-east-1'),
  APP_BASE_URL: z.string().default('https://bom.kckern.net'),
  SUPPORTED_LANGUAGES: z
    .string()
    .default('en,fr,de,nl,pt,ko,jpn,zh,ru,hi,eo,es,vn,tgl,th,ukr,tam,swe'),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);
