import { describe, expect, it } from 'vitest';
import { formatTemplate, validateTemplateVariables } from '../../src/email/templates.js';

describe('email translation grid', () => {
  it('rejects missing and undeclared variables', () => {
    expect(() => validateTemplateVariables('reset', ['resetUrl'], {})).toThrow('expected resetUrl');
    expect(() => validateTemplateVariables('reset', ['resetUrl'], {
      resetUrl: 'https://example.test', extra: 'not declared',
    })).toThrow('received extra,resetUrl');
  });

  it('formats locale-aware ICU plurals', () => {
    const source = '{activityCount, plural, one {# unread update} other {# unread updates}}';
    expect(formatTemplate(source, 'en', { activityCount: 1 })).toBe('1 unread update');
    expect(formatTemplate(source, 'en', { activityCount: 4 })).toBe('4 unread updates');
  });
});
