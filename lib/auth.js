import crypto from 'crypto';

const COOKIE_NAME = 'hc_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is not set. Add a long random string as an env var, then redeploy.');
  }
  return secret;
}

function sign(value) {
  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(value);
  return hmac.digest('hex');
}

/** Builds a Set-Cookie header value carrying the signed-in driver's name. */
export function buildSessionCookie(driverName) {
  const payload = Buffer.from(JSON.stringify({ name: driverName, iat: Date.now() })).toString('base64url');
  const signature = sign(payload);
  const value = `${payload}.${signature}`;
  const attrs = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE_SECONDS}`,
  ];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  return attrs.join('; ');
}

export function buildLogoutCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    out[key] = val;
  });
  return out;
}

/** Reads and verifies the session cookie from a request. Returns { name } or null. */
export function getSession(req) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const raw = cookies[COOKIE_NAME];
    if (!raw) return null;
    const [payload, signature] = raw.split('.');
    if (!payload || !signature) return null;
    const expected = sign(payload);
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded || typeof decoded.name !== 'string') return null;
    return decoded;
  } catch (e) {
    return null;
  }
}

export { COOKIE_NAME };
