import { listOrders, saveOrder, addOrderToIndex, setTrackingToken, genCode } from '../../../lib/orders';
import { getSession } from '../../../lib/auth';
import { sendOrderCreatedEmail } from '../../../lib/email';

export default async function handler(req, res) {
  if (!getSession(req)) {
    return res.status(401).json({ error: 'Not signed in.' });
  }

  if (req.method === 'GET') {
    try {
      const orders = await listOrders();
      return res.status(200).json({ orders });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: `Failed to list orders: ${e.message}` });
    }
  }

  if (req.method === 'POST') {
    try {
      const { facility, driverName, contactName, contactEmail, address, items } = req.body || {};
      if (!facility || !address || !contactEmail) {
        return res.status(400).json({ error: 'facility, address, and contactEmail are required' });
      }
      const id = genCode('ORD', 6);
      const trackingCode = genCode('TRK', 8);
      const now = new Date().toISOString();
      const order = {
        id,
        trackingCode,
        facility,
        driverName: driverName || '',
        contactName: contactName || '',
        contactEmail,
        address,
        items: items || '',
        status: 'pending',
        createdAt: now,
        history: [],
        pod: null,
        emailLog: [],
      };
      await saveOrder(order);
      await addOrderToIndex(id);
      await setTrackingToken(trackingCode, id);

      // Send the "order scheduled / here's your tracking number" email right away.
      // A failure here shouldn't fail order creation — the order still exists and the
      // dispatcher can see in the driver console that this first email didn't go out.
      const emailResult = { sent: false, error: null };
      try {
        await sendOrderCreatedEmail(order);
        emailResult.sent = true;
      } catch (e) {
        console.error('Order-created email failed:', e.message);
        emailResult.error = e.message;
      }
      order.emailLog.push({
        type: 'order_created',
        to: order.contactEmail,
        subject: `Honest Care Medical Delivery — Order ${order.id} scheduled (tracking #${order.trackingCode})`,
        sentAt: now,
        success: emailResult.sent,
        error: emailResult.error,
      });
      await saveOrder(order);

      return res.status(201).json({ order, email: emailResult });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: `Failed to create order: ${e.message}` });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end();
}
