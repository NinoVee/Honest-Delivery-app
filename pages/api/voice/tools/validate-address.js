import { getRawBody } from '../../../../lib/rawBody';
import { verifyAndParse, extractArgs } from '../../../../lib/webhookVerification';
import { geocodeAddress } from '../../../../lib/geo';

export const config = { api: { bodyParser: false } };

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
  const address = args.address;
  if (!address) {
    return res.status(200).json({ validated: false, ambiguous: false, message: 'No address was provided.' });
  }

  try {
    const result = await geocodeAddress(address);
    return res.status(200).json({
      validated: result.validated,
      ambiguous: result.ambiguous,
      confidence: result.confidence,
      normalized_address: result.normalizedAddress,
      latitude: result.lat,
      longitude: result.lon,
      message: result.validated
        ? `Address matched: ${result.normalizedAddress}`
        : result.ambiguous
        ? 'Multiple possible matches found — ask the caller to repeat or spell the address.'
        : 'Could not find this address — ask the caller to repeat or spell it.',
    });
  } catch (e) {
    console.error('validate-address error:', e);
    return res.status(200).json({
      validated: false,
      ambiguous: false,
      message: 'Address lookup service is temporarily unavailable — ask the caller to repeat the address, and transfer to a human if it still cannot be validated.',
    });
  }
}
