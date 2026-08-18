import { getRawBody } from '../../../../lib/rawBody';
import { verifyAndParse, extractArgs } from '../../../../lib/webhookVerification';
import { redis } from '../../../../lib/redis';

export const config = { api: { bodyParser: false } };

const VALID_REASONS = [
  'caller_requested',
  'confused_or_distressed',
  'pricing_dispute',
  'restricted_materials',
  'address_not_validated',
  'account_not_verified',
  'unsupported_service',
  'conflicting_instructions',
  'missing_or_damaged_package',
  'urgent_no_driver_info',
  'repeated_misunderstanding',
  'other',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  let body;
  try {
    const rawBody = await getRawBody(req);
    body = verifyAndParse(rawBody, req);
  } catch (e) {
    return res.status(e.statusCode || 401).json({ error: e.message });
  }

  const args = extractArgs(body);
  const reason = VALID_REASONS.includes(args.reason) ? args.reason : 'other';

  // Logged for dispatcher follow-up/audit. This function only records the request —
  // the actual live call transfer is handled by Retell's own "Transfer Call" action,
  // which should be configured on this function in the Retell dashboard alongside this
  // webhook (see the setup notes in docs/retell-function-config.json).
  try {
    const event = {
      reason,
      context: args.context || args.notes || '',
      callId: args.call_id || null,
      callerPhone: args.caller_phone || null,
      timestamp: new Date().toISOString(),
    };
    await redis.lpush('transfer-log', JSON.stringify(event));
    await redis.ltrim('transfer-log', 0, 199); // keep the most recent 200
  } catch (e) {
    console.error('Failed to log transfer event (non-fatal):', e);
  }

  return res.status(200).json({
    transfer_requested: true,
    reason,
    message: 'Transfer to a human dispatcher has been logged. Let the caller know you are transferring them now.',
  });
}
