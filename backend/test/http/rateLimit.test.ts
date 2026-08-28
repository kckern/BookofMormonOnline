import { describe, expect, it } from 'vitest';
import { isInternalLoopback } from '../../src/http/rateLimit.js';

describe('isInternalLoopback', () => {
  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])('allows the internal SSR peer %s', (ip) => {
    expect(isInternalLoopback(ip)).toBe(true);
  });

  it.each(['172.18.0.4', '10.0.0.12', '203.0.113.8', ''])('does not exempt public/proxy peer %s', (ip) => {
    expect(isInternalLoopback(ip)).toBe(false);
  });
});
