import crypto from 'crypto';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Verifies Retell's X-Retell-Signature header.
 *
 * Per Retell's docs (docs.retellai.com/features/secure-webhook), the header is formatted
 * as `v=<timestamp_ms>,d=<hex_digest>`, where digest = HMAC-SHA256(key = Retell API key,
 * message = rawRequestBody + timestamp). This same scheme secures both webhook deliveries
 * and custom function calls.
 *
 * Logs a specific reason on failure (never the full secret/body) so mismatches are
 * diagnosable from Vercel's function logs instead of a bare 401.
 */
export function verifyRetellSignature(rawBody, signatureHeader, apiKey) {
  if (!signatureHeader) {
    console.error('[retell-verify] no X-Retell-Signature header was present on the request at all.');
    return false;
  }
  if (!apiKey) {
    console.error('[retell-verify] RETELL_API_KEY is empty/undefined in this running deployment.');
    return false;
  }
  if (!rawBody) {
    console.error('[retell-verify] request body was empty.');
    return false;
  }

  const match = /^v=(\d+),d=(.+)$/.exec(signatureHeader.trim());
  if (!match) {
    console.error('[retell-verify] signature header did not match the expected "v=...,d=..." format:', signatureHeader);
    return false;
  }
  const [, timestampStr, digestHex] = match;

  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp)) {
    console.error('[retell-verify] timestamp in signature was not a number:', timestampStr);
    return false;
  }
  const skewMs = Math.abs(Date.now() - timestamp);
  if (skewMs > FIVE_MINUTES_MS) {
    console.error(`[retell-verify] timestamp is ${Math.round(skewMs / 1000)}s away from server time — outside the 5 minute window. Check for clock skew.`);
    return false;
  }

  const expected = crypto.createHmac('sha256', apiKey).update(rawBody + timestampStr).digest('hex');

  let expectedBuf, digestBuf;
  try {
    expectedBuf = Buffer.from(expected, 'hex');
    digestBuf = Buffer.from(digestHex, 'hex');
  } catch (e) {
    console.error('[retell-verify] could not parse digest as hex:', digestHex);
    return false;
  }
  if (expectedBuf.length !== digestBuf.length) {
    console.error('[retell-verify] digest length mismatch — expected', expectedBuf.length, 'got', digestBuf.length);
    return false;
  }

  const matches = crypto.timingSafeEqual(expectedBuf, digestBuf);
  if (!matches) {
    const keyPreview = apiKey.length > 10 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '(too short to preview)';
    console.error(
      '[retell-verify] signature did not match. This means RETELL_API_KEY in this deployment is not the exact same key Retell used to sign the request.',
      { keyPreview, keyLength: apiKey.length, bodyLength: rawBody.length, timestamp: timestampStr }
    );
  }
  return matches;
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
