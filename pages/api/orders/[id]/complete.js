import { getOrder, saveOrder } from '../../../../lib/orders';
import { sendCompletionEmail } from '../../../../lib/email';
import { getSession } from '../../../../lib/auth';

// Signature + photo base64 payloads can be a few MB — raise the default 1mb body limit.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default async function handler(req, res) {
  if (!getSession(req)) {
    return res.status(401).json({ error: 'Not signed in.' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }
  const { id } = req.query;
  const { signature, photos, notes } = req.body || {};
  if (!signature) {
    return res.status(400).json({ error: 'A recipient signature is required to complete delivery' });
  }
  const session = getSession(req);

  try {
    const order = await getOrder(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const now = new Date().toISOString();
    order.status = 'completed';
    order.history = order.history || [];
    order.history.push({ status: 'completed', timestamp: now });
    order.pod = {
      signature,
      photos: Array.isArray(photos) ? photos.slice(0, 6) : [],
      completedAt: now,
      driverName: order.driverName || session?.name || 'Driver',
      notes: notes || '',
    };

    const emailResult = { sent: false, error: null };
    try {
      await sendCompletionEmail(order);
      emailResult.sent = true;
    } catch (e) {
      console.error('Email send failed:', e.message);
      emailResult.error = e.message;
    }

    order.emailLog = order.emailLog || [];
    order.emailLog.push({
      to: order.contactEmail,
      subject: `Honest Care Medical Delivery — Order ${order.id} completed`,
      sentAt: now,
      success: emailResult.sent,
      error: emailResult.error,
    });

    await saveOrder(order);
    return res.status(200).json({ order, email: emailResult });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to complete delivery' });
  }
}
