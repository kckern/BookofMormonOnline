/**
 * Retired virtual-group webhook.
 *
 * The former backup duplicated the flagship roster, personas, prompts, model,
 * and channel identifier in source. That configuration is intentionally no
 * longer retained in executable code; use the reviewed DB configurator in
 * backend/scripts/configure-study-group.ts.
 */

const virtualgrouptrigger = async (_req, res) => {
  const body = {
    success: false,
    status: 410,
    message: 'Virtual groups are DB-configured; this legacy webhook is retired.',
  };
  if (res && typeof res.status === 'function') return res.status(410).send(body);
  if (res && typeof res.send === 'function') return res.send(body);
  return body;
};

module.exports = { virtualgrouptrigger };
