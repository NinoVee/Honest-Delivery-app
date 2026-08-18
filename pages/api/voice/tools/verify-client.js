import { getRawBody } from '../../../../lib/rawBody';
import { verifyAndParse, extractArgs } from '../../../../lib/webhookVerification';
import { getClientByPhone } from '../../../../lib/clients';

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
  const phone = args.phone_number || args.caller_phone || args.phone;

  if (!phone) {
    return res.status(200).json({
      verified: false,
      authorized_contact: false,
      message: 'No phone number was provided to verify.',
    });
  }

  try {
    const client = await getClientByPhone(phone);
    if (!client) {
      return res.status(200).json({
        verified: false,
        authorized_contact: false,
        message: 'No account found for this phone number. Offer to transfer to a dispatcher for manual verification.',
      });
    }

    // If the caller also gave a facility name or account number, require it to match
    // as a second factor rather than trusting phone number alone.
    const facilityMatch =
      !args.facility_name ||
      client.facilityName.toLowerCase().trim() === String(args.facility_name).toLowerCase().trim();
    const accountMatch =
      !args.account_number || client.accountNumber === String(args.account_number).trim();

    const verified = facilityMatch && accountMatch;

    return res.status(200).json({
      verified,
      authorized_contact: verified && client.authorizedContact,
      facility_name: verified ? client.facilityName : null,
      account_number: verified ? client.accountNumber : null,
      message: verified
        ? 'Client verified.'
        : 'Phone number is on file but the facility name or account number did not match. Do not disclose order details.',
    });
  } catch (e) {
    console.error('verify-client error:', e);
    return res.status(500).json({ verified: false, authorized_contact: false, message: 'Verification lookup failed.' });
  }
}
