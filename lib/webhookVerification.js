import crypto from 'crypto';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Verifies Retell's X-Retell-Signature header.
 *
 * Per Retell's docs (docs.retellai.com/features/secure-webhook), the header is formatted
 * as `v=<timestamp_ms>,d=<hex_digest>`, where digest = HMAC-SHA256(key = Retell API key,
 * message = rawRequestBody + timestamp). This same scheme secures both webhook deliveries
 * and custom function calls. Only an API key with the "webhook" badge in the Retell
 * dashboard can be used to verify — a plain (non-webhook-badged) key will fail here.
 */
export function verifyRetellSignature(rawBody, signatureHeader, apiKey) {
  if (!rawBody || !signatureHeader || !apiKey) return false;

  const match = /^v=(\d+),d=(.+)$/.exec(signatureHeader.trim());
  if (!match) return false;
  const [, timestampStr, digestHex] = match;

  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() - timestamp) > FIVE_MINUTES_MS) return false;

  const expected = crypto.createHmac('sha256', apiKey).update(rawBody + timestampStr).digest('hex');

  let expectedBuf, digestBuf;
  try {
    expectedBuf = Buffer.from(expected, 'hex');
    digestBuf = Buffer.from(digestHex, 'hex');
  } catch (e) {
    return false;
  }
  if (expectedBuf.length !== digestBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, digestBuf);
}

/**
 * Verifies a Retell request and returns the parsed JSON body, or throws.
 * Use with routes that have `export const config = { api: { bodyParser: false } }`.
 */
export function verifyAndParse(rawBody, req) {
  const apiKey = process.env.RETELL_API_KEY;
  const signature = req.headers['x-retell-signature'];
  if (!verifyRetellSignature(rawBody, signature, apiKey)) {
    const err = new Error('Invalid or missing Retell signature.');
    err.statusCode = 401;
    throw err;
  }
  try {
    return JSON.parse(rawBody || '{}');
  } catch (e) {
    const err = new Error('Invalid JSON body.');
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Retell's "Payload: args only" toggle changes whether function arguments are nested
 * under `args` or sent at the top level. Handle both so the endpoint works either way.
 */
export function extractArgs(body) {
  if (body && typeof body === 'object' && body.args && typeof body.args === 'object') {
    return body.args;
  }
  return body || {};
}
