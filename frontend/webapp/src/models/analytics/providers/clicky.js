// Analytics is non-critical; a failure must never break the UI.
function safe(fn) { try { fn(); } catch (_e) { /* swallow */ } }

/** @implements {import('../contract.js').AnalyticsProvider} */
export class ClickyProvider {
  // No-op: the Clicky loader self-inits the site from the script tag's data-id
  // (see frontend/webapp/public/index.html). Calling clicky.init() here would
  // append a second site id and double-fire every beacon.
  init() {}
  identify(user) {
    safe(() => {
      window.clicky_custom = window.clicky_custom || {};
      if (user) window.clicky_custom.visitor = { userid: user.userid, username: user.username };
      else delete window.clicky_custom.visitor;
      window.clicky?.custom_data?.();
    });
  }
  pageview(path, title) { safe(() => window.clicky?.log?.(path, title, 'pageview')); }
  goal(name, opts) { safe(() => window.clicky?.goal?.(name, opts?.revenue)); }
}
