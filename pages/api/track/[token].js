import { getOrder, getOrderIdByToken } from '../../../lib/orders';

// Fields intentionally withheld from the public tracking response. This route has no
// authentication — anyone with the tracking link can hit it — so contact/PII fields are
// stripped here at the API layer (not just hidden in the UI) before the response is sent.
// They remain in the database and are still included in the completion email.
const PUBLIC_FIELDS = [
  'id',
  'trackingCode',
  'facility',
  'items',
  'status',
  'createdAt',
  'history',
  'pod', // signature/photos/notes/completedAt/driverName — no contact info inside
];

function toPublicOrder(order) {
  const pod = order.pod
    ? {
        signature: order.pod.signature,
        photos: order.pod.photos,
        completedAt: order.pod.completedAt,
        driverName: order.pod.driverName,
        notes: order.pod.notes,
      }
    : null;
  const publicOrder = {};
  for (const key of PUBLIC_FIELDS) {
    publicOrder[key] = key === 'pod' ? pod : order[key];
  }
  return publicOrder;
}

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
    return res.status(200).json({ order: toPublicOrder(order) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Lookup failed' });
  }
}
