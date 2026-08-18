import { getRawBody } from '../../../lib/rawBody';
import { verifyAndParse } from '../../../lib/webhookVerification';
import { redis } from '../../../lib/redis';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = verifyAndParse(rawBody, req);
  } catch (e) {
    return res.status(e.statusCode || 401).json({ error: e.message });
  }

  // Note: on Vercel's serverless functions, work after res.json() isn't guaranteed to
  // finish — the function can be frozen once the response is sent. So we await the
  // (small, fast) logging write before responding, rather than firing it in the background.
  try {
    const call = event.call || {};
    const record = {
      eventType: event.event, // 'call_started' | 'call_ended' | 'call_analyzed'
      callId: call.call_id || null,
      fromNumber: call.from_number || null,
      toNumber: call.to_number || null,
      startedAt: call.start_timestamp || null,
      endedAt: call.end_timestamp || null,
      disconnectionReason: call.disconnection_reason || null,
      callSuccessful: call.call_analysis ? call.call_analysis.call_successful : null,
      summary: call.call_analysis ? call.call_analysis.call_summary : null,
      loggedAt: new Date().toISOString(),
    };
    await redis.lpush('call-log', JSON.stringify(record));
    await redis.ltrim('call-log', 0, 499); // keep the most recent 500 calls
  } catch (e) {
    console.error('Failed to log call event (non-fatal):', e);
  }

  return res.status(200).json({ received: true });
}
