// Analytics is non-critical; a failure must never break the UI.
function safe(fn) { try { fn(); } catch (_e) { /* swallow */ } }

/** @implements {import('../contract.js').AnalyticsProvider} */
export class ClickyProvider {
  constructor(config = {}) {
    this.siteId = config.siteId || process.env.REACT_APP_CLICKY_SITE_ID;
    this.scriptPath = config.scriptPath || process.env.REACT_APP_CLICKY_JS_PATH;
    this.pending = [];
    this.initialized = false;
  }

  init() {
    safe(() => {
      if (this.initialized || !this.siteId || !this.scriptPath) return;
      this.initialized = true;

      // The provider owns every vendor global and loader detail. Keep the
      // automatic first pageview enabled: that is where Clicky captures the
      // browser's original external referrer. The app emits later SPA views.
      window.clicky_custom = window.clicky_custom || {};
      window.clicky_custom.history_disable = true;
      delete window.clicky_custom.pageview_disable;

      const existing = document.querySelector(
        `script[data-id="${this.siteId}"][src="${this.scriptPath}"]`
      );
      if (existing) {
        existing.addEventListener('load', () => this.flush(), { once: true });
        this.flush();
        return;
      }

      const script = document.createElement('script');
      script.async = true;
      script.dataset.id = this.siteId;
      script.src = this.scriptPath;
      script.addEventListener('load', () => this.flush(), { once: true });
      document.head.appendChild(script);
    });
  }

  flush() {
    if (!window.clicky) return;
    const queued = this.pending.splice(0);
    queued.forEach((operation) => safe(operation));
  }

  identify(user) {
    safe(() => {
      window.clicky_custom = window.clicky_custom || {};
      if (user) window.clicky_custom.visitor = { userid: user.userid, username: user.username };
      else delete window.clicky_custom.visitor;
      window.clicky?.custom_data?.();
    });
  }
  pageview(path, title) {
    const operation = () => window.clicky?.log?.(path, title, 'pageview');
    if (window.clicky) safe(operation);
    else this.pending.push(operation);
  }
  goal(name, opts) {
    const operation = () => window.clicky?.goal?.(name, opts?.revenue);
    if (window.clicky) safe(operation);
    else this.pending.push(operation);
  }
}
