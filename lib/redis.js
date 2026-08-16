import Redis from 'ioredis';

// Lazily create the client so a missing/invalid env var surfaces as a normal
// error inside a route's try/catch, instead of crashing at module import time.
// Reused across warm serverless invocations via this module-level singleton.
let _redis = null;

export function getRedis() {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      'REDIS_URL is not set. In Vercel → Storage → your Redis database → click "Connect to Project", then redeploy.'
    );
  }
  _redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    // rediss:// URLs (TLS) are handled automatically by ioredis based on the URL scheme.
  });
  _redis.on('error', (err) => {
    console.error('Redis client error:', err.message);
  });
  return _redis;
}

// Kept for any code that imports `redis` directly — resolves lazily via a Proxy
// so property access (redis.get(...), redis.set(...), etc.) still triggers getRedis().
export const redis = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getRedis();
      const value = client[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    },
  }
);
