import { analytics, createProvider, GOALS } from './index';
import { useAnalytics } from './useAnalytics';
import { NoopProvider } from './providers/noop';
import { ClickyProvider } from './providers/clicky';
test('default singleton is a ClickyProvider in the browser (jsdom has window)', () => { expect(analytics).toBeInstanceOf(ClickyProvider); });
test('createProvider returns Noop when disabled', () => { expect(createProvider({ enabled: false })).toBeInstanceOf(NoopProvider); });
test('useAnalytics returns the same singleton', () => { expect(useAnalytics()).toBe(analytics); });
test('re-exports the GOALS catalog', () => { expect(GOALS.SIGNIN).toBe('signin'); });
