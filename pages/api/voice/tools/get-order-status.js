import { getRawBody } from '../../../../lib/rawBody';
import { verifyAndParse, extractArgs } from '../../../../lib/webhookVerification';
import { getOrder, getOrderIdByToken, listOrders } from '../../../../lib/orders';

export const config = { api: { bodyParser: false } };

// Only ever return this limited set to the phone agent — matches the system prompt's
// "you may share" list exactly. Full address/contact/email stay out of the voice channel.
function toVoiceSummary(order) {
  return {
    order_id: order.id,
    reference_number: order.id,
    status: order.status,
    driver_first_name: order.driverName ? order.driverName.split(' ')[0] : null,
    pickup_confirmed: ['in_transit', 'onsite', 'completed'].includes(order.status),
    delivery_confirmed: order.status === 'completed',
    proof_of_delivery_captured: Boolean(order.pod),
    completed_at: order.pod ? order.pod.completedAt : null,
  };
}

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

  try {
    let order = null;

    if (args.order_id || args.reference_number) {
      order = await getOrder(args.order_id || args.reference_number);
    } else if (args.tracking_code) {
      const id = await getOrderIdByToken(String(args.tracking_code).toUpperCase());
      if (id) order = await getOrder(id);
    }

    if (!order && (args.caller_phone || args.pickup_facility || args.delivery_facility)) {
      const all = await listOrders();
      order = all.find((o) => {
        const phoneMatch = args.caller_phone && o.callerPhone === args.caller_phone;
        const pickupMatch =
          args.pickup_facility && o.pickupFacility && o.pickupFacility.toLowerCase().includes(String(args.pickup_facility).toLowerCase());
        const deliveryMatch =
          args.delivery_facility && o.facility && o.facility.toLowerCase().includes(String(args.delivery_facility).toLowerCase());
        return phoneMatch || pickupMatch || deliveryMatch;
      });
    }

    if (!order) {
      return res.status(200).json({ found: false, message: 'No matching order was found with the information given.' });
    }

    return res.status(200).json({ found: true, ...toVoiceSummary(order) });
  } catch (e) {
    console.error('get-order-status error:', e);
    return res.status(200).json({ found: false, message: 'Order lookup failed. Offer to transfer to a dispatcher.' });
  }
}
