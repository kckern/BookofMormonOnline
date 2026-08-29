import { ClickyProvider } from './clicky';
function mockClicky() {
  window.clicky = { goal: jest.fn(), log: jest.fn(), custom_data: jest.fn() };
  window.clicky_custom = { pageview_disable: true, history_disable: true };
}
afterEach(() => {
  jest.useRealTimers();
  delete window.clicky;
  delete window.clicky_custom;
  document.head.querySelectorAll('script[data-id]').forEach((node) => node.remove());
});

test('identify sets the GLOBAL visitor, calls custom_data, fires NO goal, keeps flags', () => {
  mockClicky();
  new ClickyProvider().identify({ userid: 'u1', username: 'Neo' });
  expect(window.clicky_custom.visitor).toEqual({ userid: 'u1', username: 'Neo' });
  expect(window.clicky_custom.pageview_disable).toBe(true);
  expect(window.clicky.custom_data).toHaveBeenCalled();
  expect(window.clicky.goal).not.toHaveBeenCalled();
});
test('identify(null) deletes visitor', () => {
  mockClicky(); window.clicky_custom.visitor = { userid: 'u1' };
  new ClickyProvider().identify(null);
  expect(window.clicky_custom.visitor).toBeUndefined();
});
test('pageview logs a pageview', () => {
  mockClicky();
  new ClickyProvider().pageview('/lookup/x', 'Lookup: X');
  expect(window.clicky.log).toHaveBeenCalledWith('/lookup/x', 'Lookup: X', 'pageview');
});
test('goal passes name and revenue', () => {
  mockClicky();
  new ClickyProvider().goal('kr_buy', { revenue: 25 });
  expect(window.clicky.goal).toHaveBeenCalledWith('kr_buy', 25);
});
test('init owns the loader and leaves the initial automatic pageview enabled', () => {
  window.clicky_custom = { pageview_disable: true };
  const provider = new ClickyProvider({ siteId: '123', scriptPath: '/analytics.js' });
  provider.init();
  provider.pageview('/', 'Home', { initial: true });

  const script = document.head.querySelector('script[data-id="123"]');
  expect(script).not.toBeNull();
  expect(script.getAttribute('src')).toBe('/analytics.js');
  expect(window.clicky_custom.history_disable).toBe(true);
  expect(window.clicky_custom.pageview_disable).toBeUndefined();
  expect(window.clicky_custom.title).toBe('Home');
});
test('events queued before the loader finishes are flushed after load', () => {
  const provider = new ClickyProvider({ siteId: '123', scriptPath: '/analytics.js' });
  provider.init();
  provider.pageview('/', 'Home', { initial: true });
  provider.pageview('/queued', 'Queued');
  mockClicky();

  document.head.querySelector('script[data-id="123"]')
    .dispatchEvent(new Event('load'));

  expect(window.clicky.log).toHaveBeenCalledWith('/queued', 'Queued', 'pageview');
});
test('fallback waits for React and uses the current document title', () => {
  jest.useFakeTimers();
  document.title = 'Resolved React title';
  const provider = new ClickyProvider({ siteId: '123', scriptPath: '/analytics.js' });
  provider.init();

  jest.advanceTimersByTime(4999);
  expect(document.head.querySelector('script[data-id="123"]')).toBeNull();
  jest.advanceTimersByTime(1);

  expect(document.head.querySelector('script[data-id="123"]')).not.toBeNull();
  expect(window.clicky_custom.title).toBe('Resolved React title');
});
test('a late initial title updates the in-flight automatic pageview', () => {
  const provider = new ClickyProvider({ siteId: '123', scriptPath: '/analytics.js' });
  provider.load();
  provider.load('Late title');

  expect(document.head.querySelectorAll('script[data-id="123"]')).toHaveLength(1);
  expect(window.clicky_custom.title).toBe('Late title');
});
test('all methods are safe when window.clicky is undefined', () => {
  expect(() => { const p = new ClickyProvider(); p.identify({ userid: 'u1' }); p.pageview('/x'); p.goal('signin'); }).not.toThrow();
});
