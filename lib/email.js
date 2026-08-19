import { Resend } from 'resend';

function dataUrlToAttachment(dataUrl, filename) {
  if (typeof dataUrl !== 'string') return null;
  const match = /^data:(.+);base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  return { filename, content: match[2] };
}

function trackingLink(order) {
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  return base ? `${base.replace(/\/$/, '')}/track/${order.trackingCode}` : null;
}

export function buildOrderCreatedBody(order) {
  const link = trackingLink(order);
  return `Hi ${order.contactName || 'there'},

Your delivery has been scheduled with Honest Care Medical Delivery.

Order: ${order.id}
Facility: ${order.facility}
Tracking number: ${order.trackingCode}
${link ? `\nTrack your delivery any time here:\n${link}\n` : ''}
We'll send you another email the moment your delivery is completed, with proof of delivery attached. Thank you for trusting us with your delivery.

— Honest Care Medical Delivery
Delivering Care, Delivering Trust.`;
}

export function buildEmailBody(order) {
  const completedAt = new Date(order.pod.completedAt).toLocaleString();
  return `Hi ${order.contactName || 'there'},

Good news — your delivery has been completed successfully and is fully verified.

Order: ${order.id}
Facility: ${order.facility}
Completed: ${completedAt}

Proof of delivery (signature and photos) is attached to this email for your records. Thank you for trusting us with your delivery.

— Honest Care Medical Delivery
Delivering Care, Delivering Trust.`;
}

/** Sent the moment an order is created, so the contact has their tracking number right away. */
export async function sendOrderCreatedEmail(order) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set');
  }
  if (!order.contactEmail) {
    throw new Error('No contact email on this order — nothing to send to.');
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
    to: order.contactEmail,
    subject: `Honest Care Medical Delivery — Order ${order.id} scheduled (tracking #${order.trackingCode})`,
    text: buildOrderCreatedBody(order),
  });

  if (error) {
    throw new Error(typeof error === 'string' ? error : error.message || 'Resend send failed');
  }
}

export async function sendCompletionEmail(order) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set');
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const attachments = [];
  const sig = dataUrlToAttachment(order.pod.signature, `signature-${order.id}.png`);
  if (sig) attachments.push(sig);
  (order.pod.photos || []).forEach((p, i) => {
    const att = dataUrlToAttachment(p, `photo-${i + 1}-${order.id}.jpg`);
    if (att) attachments.push(att);
  });

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
    to: order.contactEmail,
    subject: `Honest Care Medical Delivery — Order ${order.id} completed`,
    text: buildEmailBody(order),
    attachments,
  });

  if (error) {
    throw new Error(typeof error === 'string' ? error : error.message || 'Resend send failed');
  }
}
