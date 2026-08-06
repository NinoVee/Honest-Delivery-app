import { getOrder } from '../../../../lib/orders';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }
  const { id } = req.query;
  try {
    const order = await getOrder(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.status(200).json({ order });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to load order' });
  }
}
