import { NoopProvider } from './noop';
test('NoopProvider methods are safe no-ops and never touch globals', () => {
  const p = new NoopProvider();
  const before = window.clicky_custom;
  expect(() => { p.init(); p.identify({ userid: 'u1', username: 'n' }); p.identify(null); p.pageview('/x', 'X'); p.goal('signin', { revenue: 5 }); }).not.toThrow();
  expect(window.clicky_custom).toBe(before);
});
