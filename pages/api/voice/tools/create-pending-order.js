import { getRawBody } from '../../../../lib/rawBody';
import { verifyAndParse, extractArgs } from '../../../../lib/webhookVerification';
import { saveOrder, addOrderToIndex, setTrackingToken, genCode } from '../../../../lib/orders';

export const config = { api: { bodyParser: false } };

const REQUIRED_FIELDS = [
  'facility_name',
  'caller_name',
  'caller_phone',
  'pickup_facility',
  'pickup_address',
  'pickup_contact_name',
  'pickup_contact_phone',
  'delivery_facility',
  'delivery_address',
  'delivery_contact_name',
  'delivery_contact_phone',
  'service_type',
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

  if (args.caller_confirmed !== true) {
    return res.status(200).json({
      created: false,
      message: 'caller_confirmed must be true. Read the full order summary back to the caller and get an explicit yes before calling this function.',
    });
  }

  const missing = REQUIRED_FIELDS.filter((f) => !args[f]);
  if (missing.length > 0) {
    return res.status(200).json({
      created: false,
      message: `Missing required information: ${missing.join(', ')}. Collect these before submitting.`,
    });
  }

  try {
    const id = genCode('ORD', 6);
    const trackingCode = genCode('TRK', 8);
    const now = new Date().toISOString();

    // Contact/delivery email is optional on a phone call (callers often don't have it handy) —
    // the dispatcher can add it during review before approving the order.
    const order = {
      id,
      trackingCode,
      facility: args.delivery_facility, // shown as the primary facility name in the driver console
      driverName: '',
      contactName: args.delivery_contact_name,
      contactEmail: args.delivery_contact_email || '',
      address: args.delivery_address,
      items: [args.package_count, args.package_type].filter(Boolean).join(' \u00d7 ') || args.package_type || '',
      status: 'pending_review',
      createdAt: now,
      history: [{ status: 'pending_review', timestamp: now }],
      pod: null,
      emailLog: [],

      source: 'phone_agent',
      callerName: args.caller_name,
      callerPhone: args.caller_phone,
      accountNumber: args.account_number || '',

      pickupFacility: args.pickup_facility,
      pickupAddress: args.pickup_address,
      pickupContactName: args.pickup_contact_name,
      pickupContactPhone: args.pickup_contact_phone,

      serviceType: args.service_type,
      readyTime: args.ready_time || '',
      deadline: args.delivery_deadline || '',
      packageCount: args.package_count || '',
      packageType: args.package_type || '',
      tempRequirement: args.temperature_requirement || '',
      vehicleRequirement: args.vehicle_requirement || '',
      chainOfCustody: Boolean(args.chain_of_custody_required),
      specialInstructionsPickup: args.pickup_instructions || '',
      specialInstructionsDelivery: args.delivery_instructions || '',
      poNumber: args.po_number || '',
      smsOptIn: Boolean(args.sms_updates_authorized),
    };

    await saveOrder(order);
    await addOrderToIndex(id);
    await setTrackingToken(trackingCode, id);

    return res.status(200).json({
      created: true,
      order_id: id,
      reference_number: id,
      message: `Order created and awaiting dispatcher review. Read this order ID back to the caller as their reference number: ${id}`,
    });
  } catch (e) {
    console.error('create-pending-order error:', e);
    return res.status(200).json({
      created: false,
      message: 'Failed to save the order. Apologize and offer to transfer to a dispatcher.',
    });
  }
}
