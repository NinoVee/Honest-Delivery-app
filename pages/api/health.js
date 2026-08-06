import { getRedis } from '../../lib/redis';

export default async function handler(req, res) {
  const result = {
    envVars: {
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? 'set' : 'MISSING',
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? 'set' : 'MISSING',
      RESEND_API_KEY: process.env.RESEND_API_KEY ? 'set' : 'MISSING',
      EMAIL_FROM: process.env.EMAIL_FROM || '(not set — defaults to onboarding@resend.dev)',
    },
    redis: { ok: false, detail: null },
  };

  try {
    const redis = getRedis();
    const key = '__health_check__';
    await redis.set(key, 'ok');
    const value = await redis.get(key);
    result.redis.ok = value === 'ok';
    result.redis.detail = result.redis.ok ? 'Read/write to Redis succeeded.' : 'Wrote but read-back did not match.';
  } catch (e) {
    result.redis.ok = false;
    result.redis.detail = e.message;
  }

  const status = result.redis.ok ? 200 : 500;
  return res.status(status).json(result);
}
