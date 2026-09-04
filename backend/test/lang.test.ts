import { describe, expect, test } from 'vitest';

process.env.MYSQL_HOST ||= 'test';
process.env.MYSQL_USER ||= 'test';
process.env.MYSQL_PASSWORD ||= 'test';

const { normalizeInternalLang, resolveLang } = await import('../src/graphql/lang.js');

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
    expect(resolveLang('livredemormon.fr', '/graphql')).toBe('fr');
  });

  test('unknown path segments clamp to English', () => {
    expect(resolveLang('localhost:5006', '/graphql')).toBe('en');
  });

  test('Japanese aliases use the existing jp storage code', () => {
    expect(normalizeInternalLang('jp')).toBe('jp');
    expect(normalizeInternalLang('jpn')).toBe('jp');
    expect(normalizeInternalLang('ja')).toBe('jp');
    expect(resolveLang('localhost:5006', '/jp')).toBe('jp');
    expect(resolveLang('localhost:5006', '/jpn')).toBe('jp');
    expect(resolveLang('localhost:5006', '/ja')).toBe('jp');
  });
});
