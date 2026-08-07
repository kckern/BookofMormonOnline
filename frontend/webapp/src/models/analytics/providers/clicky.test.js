import { ClickyProvider } from './clicky';
function mockClicky() {
  window.clicky = { goal: jest.fn(), log: jest.fn(), custom_data: jest.fn() };
  window.clicky_custom = { pageview_disable: true, history_disable: true };
}
afterEach(() => { delete window.clicky; delete window.clicky_custom; });

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
test('init is a no-op and does not init clicky', () => {
  mockClicky(); window.clicky.init = jest.fn();
  new ClickyProvider().init();
  expect(window.clicky.init).not.toHaveBeenCalled();
});
test('all methods are safe when window.clicky is undefined', () => {
  expect(() => { const p = new ClickyProvider(); p.identify({ userid: 'u1' }); p.pageview('/x'); p.goal('signin'); }).not.toThrow();
});
