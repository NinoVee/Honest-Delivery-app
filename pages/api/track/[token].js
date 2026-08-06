import { getOrder, getOrderIdByToken } from '../../../lib/orders';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }
  const { token } = req.query;
  try {
    const id = await getOrderIdByToken(String(token).toUpperCase());
    if (!id) return res.status(404).json({ error: 'No delivery found for that tracking code' });
    const order = await getOrder(id);
    if (!order) return res.status(404).json({ error: 'No delivery found for that tracking code' });
    return res.status(200).json({ order });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Lookup failed' });
  }
}
