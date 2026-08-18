import { getOrder, saveOrder } from '../../../../lib/orders';
import { getSession } from '../../../../lib/auth';

// 'pending' is included so a dispatcher can approve a phone-agent order
// (status pending_review -> pending) to release it into the normal driver workflow.
const ALLOWED = ['pending', 'in_transit', 'onsite'];

export default async function handler(req, res) {
  if (!getSession(req)) {
    return res.status(401).json({ error: 'Not signed in.' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }
  const { id } = req.query;
  const { status } = req.body || {};
  if (!ALLOWED.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${ALLOWED.join(', ')}` });
  }
  try {
    const order = await getOrder(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    order.status = status;
    order.history = order.history || [];
    order.history.push({ status, timestamp: new Date().toISOString() });
    await saveOrder(order);
    return res.status(200).json({ order });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to update status' });
  }
}
