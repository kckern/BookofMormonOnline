/** Retry an async fn up to `attempts` times with linear backoff. Throws the last error if all fail. */
export async function withRetry<T>(fn: () => Promise<T>, opts: { attempts: number; delayMs: number }): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < opts.attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < opts.attempts - 1) await new Promise((r) => setTimeout(r, opts.delayMs * (i + 1)));
    }
  }
  throw lastErr;
}
