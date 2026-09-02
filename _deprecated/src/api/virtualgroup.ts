/**
 * Retired virtual-group webhook.
 *
 * Persona, roster, prompt, model, pacing, and corpus configuration previously
 * embedded here now lives in the normalized bom_ai_* / bom_bot tables. The
 * active implementation is backend/src/bots/scheduler.ts. Keeping this endpoint
 * as an explicit tombstone prevents an old deployment from running a second,
 * ungoverned bot loop.
 */
const virtualgrouptrigger = async (_req: any, res: any) => {
  const payload = {
    success: false,
    status: 410,
    message: 'Legacy virtual-group automation is retired; use the database-configured scheduler.',
  };
  if (typeof res?.status === 'function') return res.status(410).send(payload);
  return res?.send?.(payload);
};

export { virtualgrouptrigger };
