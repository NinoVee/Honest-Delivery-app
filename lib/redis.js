import { Redis } from '@upstash/redis';

// Lazily create the client so a missing/invalid env var surfaces as a normal
// error inside a route's try/catch, instead of crashing at module import time.
let _redis = null;

export function getRedis() {
  if (_redis) return _redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set. Add them in Vercel → Project → Settings → Environment Variables, then redeploy.'
    );
  }
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
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
