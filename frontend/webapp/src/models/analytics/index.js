import { ClickyProvider } from './providers/clicky.js';
import { NoopProvider } from './providers/noop.js';
import { GOALS } from './goals.js';

/** @param {import('./contract.js').AnalyticsConfig} [config] */
export function createProvider(config = {}) {
  if (typeof window === 'undefined' || config.enabled === false) return new NoopProvider();
  return new ClickyProvider();
}
export const analytics = createProvider();
export { GOALS };
