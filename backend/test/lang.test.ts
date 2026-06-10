import { describe, expect, test } from 'vitest';

process.env.MYSQL_HOST ||= 'test';
process.env.MYSQL_USER ||= 'test';
process.env.MYSQL_PASSWORD ||= 'test';

const { resolveLang } = await import('../src/graphql/lang.js');

describe('resolveLang (legacy apollo.ts rules, verbatim)', () => {
  test('path language wins for plain hosts', () => {
    expect(resolveLang('localhost:5006', '/ko')).toBe('ko');
    expect(resolveLang('localhost:5006', '/en')).toBe('en');
  });

  test('root path falls back to en', () => {
    expect(resolveLang('localhost:5006', '/')).toBe('en');
  });

  test('language subdomain overrides path', () => {
    expect(resolveLang('ko.bookofmormon.online', '/en')).toBe('ko');
  });

  test('langDomains map applies', () => {
    expect(resolveLang('xn--289a67xla.kr', '/')).toBe('ko');
  });

  test('legacy quirk preserved: last path segment is taken as-is', () => {
    // legacy resolves POST /graphql to lang "graphql" (no translations match → English behavior)
    expect(resolveLang('localhost:5006', '/graphql')).toBe('graphql');
  });
});
