import { listOrders, saveOrder, addOrderToIndex, setTrackingToken, genCode } from '../../../lib/orders';

export default async function handler(req, res) {
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
        createdAt: new Date().toISOString(),
        history: [],
        pod: null,
        emailLog: [],
      };
      await saveOrder(order);
      await addOrderToIndex(id);
      await setTrackingToken(trackingCode, id);
      return res.status(201).json({ order });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: `Failed to create order: ${e.message}` });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end();
}
