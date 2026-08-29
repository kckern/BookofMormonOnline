import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { renderBrandedEmail, type RenderedEmail } from './render.js';
import { IntlMessageFormat } from 'intl-messageformat';

export type TransactionalTemplateKey =
  | 'password-reset'
  | 'account-recovery'
  | 'notification-reply'
  | 'notification-mention'
  | 'notification-invite'
  | 'notification-direct-message'
  | 'notification-summary';

export interface ResolvedEmailTemplate extends RenderedEmail {
  templateKey: TransactionalTemplateKey;
  templateVersion: number;
  lang: string;
}

export function validateTemplateVariables(
  key: string,
  required: string[],
  variables: Record<string, string | number>,
): void {
  const supplied = Object.keys(variables).sort();
  const expected = [...required].sort();
  if (JSON.stringify(supplied) !== JSON.stringify(expected)) {
    throw new Error(`Invalid variables for ${key}: expected ${expected.join(',')}; received ${supplied.join(',')}`);
  }
}

export function formatTemplate(
  template: string,
  lang: string,
  variables: Record<string, string | number>,
): string {
  const value = new IntlMessageFormat(template, lang).format(variables);
  return Array.isArray(value) ? value.join('') : String(value);
}

export async function renderTransactionalTemplate(
  db: Kysely<DB>,
  key: TransactionalTemplateKey,
  lang: string,
  variables: Record<string, string | number>,
): Promise<ResolvedEmailTemplate> {
  const requestedLang = lang || 'en';
  const exact = await db.selectFrom('bom_email_template').selectAll()
    .where('template_key', '=', key)
    .where('lang', '=', requestedLang)
    .where('active', '=', 1)
    .where('translation_status', '=', 'published')
    .orderBy('version', 'desc')
    .executeTakeFirst();
  const row = exact ?? (requestedLang !== 'en'
    ? await db.selectFrom('bom_email_template').selectAll()
      .where('template_key', '=', key)
      .where('lang', '=', 'en')
      .where('active', '=', 1)
      .where('translation_status', '=', 'published')
      .orderBy('version', 'desc')
      .executeTakeFirst()
    : null);
  if (!row) throw new Error(`No active email template for ${key} (${requestedLang})`);
  const definition = await db.selectFrom('bom_email_template_definition').selectAll()
    .where('template_key', '=', key)
    .where('version', '=', row.version)
    .where('active', '=', 1)
    .executeTakeFirst();
  if (!definition) throw new Error(`No active email template definition for ${key}@${row.version}`);
  const rawRequired = typeof definition.required_variables === 'string'
    ? JSON.parse(definition.required_variables) as unknown
    : definition.required_variables;
  const required = Array.isArray(rawRequired)
    ? rawRequired.filter((value): value is string => typeof value === 'string')
    : [];
  validateTemplateVariables(key, required, variables);
  const format = (template: string): string => formatTemplate(template, row.lang, variables);
  const ctaUrlValue = row.cta_url_variable ? variables[row.cta_url_variable] : null;
  const ctaUrl = typeof ctaUrlValue === 'string' ? ctaUrlValue : null;
  if (ctaUrl && !ctaUrl.startsWith('https://')) throw new Error(`Unsafe CTA URL for ${key}`);
  if (row.lang !== requestedLang) {
    console.warn(`[email-template-fallback] key=${key} requested=${requestedLang} resolved=${row.lang}`);
  }
  return {
    ...renderBrandedEmail({
      subjectTemplate: format(row.subject_template),
      preheaderTemplate: format(row.preheader_template),
      bodyMarkdown: format(row.body_markdown),
      brandName: row.brand_name,
      footerText: row.footer_text,
      ctaText: row.cta_text ? format(row.cta_text) : null,
      ctaUrl,
      variables: {},
    }),
    templateKey: key,
    templateVersion: row.version,
    lang: row.lang,
  };
}
