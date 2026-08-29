export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const variablePattern = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

export function interpolate(template: string, variables: Record<string, string | number>): string {
  return template.replace(variablePattern, (_match, key: string) => {
    if (!(key in variables)) throw new Error(`Missing email template variable: ${key}`);
    return String(variables[key] ?? '');
  });
}

/**
 * Intentionally small Markdown subset. Content is escaped first, preventing
 * arbitrary HTML/script injection; only HTTPS links, headings and paragraphs
 * are emitted into the fixed, responsive brand layout.
 */
export function renderMarkdown(markdown: string): { html: string; text: string } {
  const source = markdown.replace(/\r\n/g, '\n').trim();
  const text = source
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '$1: $2')
    .replace(/\*\*([^*]+)\*\*/g, '$1');
  const blocks = source.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const html = blocks.map((block) => {
    const heading = block.match(/^#{1,3}\s+(.+)$/s);
    const raw = heading?.[1] ?? block;
    let safe = escapeHtml(raw);
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(
      /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,
      '<a href="$2" style="color:#7b5b24;text-decoration:underline">$1</a>',
    );
    safe = safe.replace(/\n/g, '<br>');
    return heading
      ? `<h2 style="font:600 22px Georgia,serif;color:#2e2a24;margin:24px 0 12px">${safe}</h2>`
      : `<p style="margin:0 0 18px;line-height:1.65">${safe}</p>`;
  }).join('');
  return { html, text };
}

export function renderBrandedEmail(input: {
  subjectTemplate: string;
  bodyMarkdown: string;
  variables: Record<string, string | number>;
  preheaderTemplate?: string;
  brandName: string;
  footerText: string;
  ctaText?: string | null;
  ctaUrl?: string | null;
}): RenderedEmail {
  const subject = interpolate(input.subjectTemplate, input.variables).trim();
  const body = interpolate(input.bodyMarkdown, input.variables);
  const preheader = input.preheaderTemplate
    ? interpolate(input.preheaderTemplate, input.variables).trim()
    : subject;
  if (!subject || subject.length > 255) throw new Error('Email subject must be 1–255 characters');
  const rendered = renderMarkdown(body);
  const cta = input.ctaText && input.ctaUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:#7b5b24;color:#fff;padding:12px 18px;border-radius:5px;text-decoration:none;font-weight:600">${escapeHtml(input.ctaText)}</a></p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#f4f1ea;color:#2e2a24;font:16px Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #ded7ca;border-radius:8px"><tr><td style="padding:28px"><div style="font:600 24px Georgia,serif;color:#5f461d;margin-bottom:24px">${escapeHtml(input.brandName)}</div>${rendered.html}${cta}<div style="border-top:1px solid #e7e1d7;margin-top:28px;padding-top:18px;color:#777;font-size:12px">${escapeHtml(input.footerText)}</div></td></tr></table></td></tr></table></body></html>`;
  const text = input.ctaText && input.ctaUrl
    ? `${rendered.text}\n\n${input.ctaText}: ${input.ctaUrl}`
    : rendered.text;
  return { subject, html, text };
}
