/**
 * media/ping.ts — analytics pageview forwarder (port of legacy src/library/ping.ts).
 *
 * The `stats.js` beacon base64-encodes a query-string pageview payload. We decode it,
 * inject the real client IP + User-Agent (legacy did this server-side so they aren't
 * spoofable / so the Clicky admin sitekey stays server-only), and GET it to Clicky.
 *
 * Best-effort and fire-and-forget: analytics must never affect the request. Requires
 * the `clickySiteAdmin` env (same name as legacy); absent → no-op.
 */

/** Forward one decoded pageview beacon to Clicky. Never throws. */
export async function forwardPageview(base64Data: string, ip: string, ua: string): Promise<void> {
  const sitekeyAdmin = process.env['clickySiteAdmin'];
  if (!sitekeyAdmin || !base64Data) return;

  const params: Record<string, string> = {};
  try {
    const decoded = Buffer.from(base64Data, 'base64').toString('utf-8');
    new URLSearchParams(decoded).forEach((value, key) => {
      params[key] = value;
    });
  } catch {
    return; // malformed payload — drop it
  }

  if (ip) params['ip_address'] = ip;
  if (ua) params['ua'] = ua;

  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `https://in.getclicky.com/in.php?sitekey_admin=${encodeURIComponent(sitekeyAdmin)}&${qs}`;

  try {
    await fetch(url);
  } catch {
    // best-effort
  }
}
