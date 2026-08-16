const crypto = require('crypto');
const { config } = require('../config/env');

/**
 * Constant-time string comparison to avoid timing attacks on token checks.
 */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validate Meta's X-Hub-Signature-256 header against the raw request body.
 * Returns true when META_APP_SECRET is not configured (verification disabled).
 */
function verifyMetaSignature(req, rawBody) {
  if (!config.META_APP_SECRET) return true;
  const header = req.headers['x-hub-signature-256'];
  if (!header || typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  if (!rawBody || rawBody.length === 0) return false;
  const expected = crypto
    .createHmac('sha256', config.META_APP_SECRET)
    .update(rawBody)
    .digest('hex');
  return safeEqual(header.slice('sha256='.length), expected);
}

module.exports = { safeEqual, verifyMetaSignature };
