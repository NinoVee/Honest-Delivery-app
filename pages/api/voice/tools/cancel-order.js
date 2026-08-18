import { getRawBody } from '../../../../lib/rawBody';
import { verifyAndParse, extractArgs } from '../../../../lib/webhookVerification';
import { getOrder, saveOrder } from '../../../../lib/orders';

export const config = { api: { bodyParser: false } };

// Straightforward cancellations only — per the agent prompt, anything more than a plain
// cancellation on an order that's already pending/in review should go to a human instead.
const CANCELLABLE_STATUSES = ['pending_review', 'pending'];

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
  const orderId = args.order_id || args.reference_number;

  if (!orderId) {
    return res.status(200).json({ cancelled: false, message: 'order_id is required.' });
  }

  try {
    const order = await getOrder(orderId);
    if (!order) {
      return res.status(200).json({ cancelled: false, message: 'No order found with that ID.' });
    }

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return res.status(200).json({
        cancelled: false,
        message: `This order is already ${order.status.replace('_', ' ')} and can't be cancelled automatically. Transfer to a dispatcher.`,
      });
    }

    order.status = 'cancelled';
    order.history = order.history || [];
    order.history.push({ status: 'cancelled', timestamp: new Date().toISOString() });
    await saveOrder(order);

    return res.status(200).json({ cancelled: true, order_id: order.id, message: 'Order cancelled.' });
  } catch (e) {
    console.error('cancel-order error:', e);
    return res.status(200).json({ cancelled: false, message: 'Cancellation failed. Offer to transfer to a dispatcher.' });
  }
}
