import { describe, expect, it } from 'vitest';
import { interpolate, renderBrandedEmail, renderMarkdown } from '../../src/email/render.js';

describe('transactional email rendering', () => {
  it('requires every declared variable to be supplied', () => {
    expect(() => interpolate('Hello {{name}}', {})).toThrow('Missing email template variable: name');
  });

  it('escapes dynamic content and permits only HTTPS markdown links', () => {
    const rendered = renderBrandedEmail({
      subjectTemplate: 'Message from {{name}}',
      preheaderTemplate: '{{summary}}',
      bodyMarkdown: '{{summary}}\n\n[Safe]({{url}})',
      brandName: 'Localized Brand',
      footerText: 'Localized Footer',
      variables: {
        name: '<img src=x onerror=alert(1)>',
        summary: '<script>alert(1)</script>',
        url: 'https://example.test/path',
      },
    });
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).not.toContain('<img');
    expect(rendered.html).toContain('&lt;script&gt;');
    expect(rendered.html).toContain('href="https://example.test/path"');
    expect(rendered.html).toContain('Localized Brand');
    expect(rendered.text).toContain('Safe: https://example.test/path');
  });

  it('does not turn non-HTTPS markdown into an anchor', () => {
    expect(renderMarkdown('[Unsafe](javascript:alert(1))').html).not.toContain('<a ');
  });
});
