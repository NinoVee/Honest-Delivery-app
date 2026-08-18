import { getRawBody } from '../../../../lib/rawBody';
import { verifyAndParse, extractArgs } from '../../../../lib/webhookVerification';
import { geocodeAddress, estimateRoute } from '../../../../lib/geo';

export const config = { api: { bodyParser: false } };

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
  const pickupAddress = args.pickup_address;
  const deliveryAddress = args.delivery_address;

  if (!pickupAddress || !deliveryAddress) {
    return res.status(200).json({ available: false, message: 'Both pickup_address and delivery_address are required.' });
  }

  try {
    const [pickup, delivery] = await Promise.all([geocodeAddress(pickupAddress), geocodeAddress(deliveryAddress)]);

    if (pickup.lat == null || delivery.lat == null) {
      return res.status(200).json({
        available: false,
        message: 'Could not calculate a route because one of the addresses could not be located.',
      });
    }

    const route = estimateRoute(pickup.lat, pickup.lon, delivery.lat, delivery.lon);

    return res.status(200).json({
      available: true,
      distance_miles: route.distanceMiles,
      estimated_minutes_low: route.estimatedMinutesLow,
      estimated_minutes_high: route.estimatedMinutesHigh,
      message: `This is a rough estimate only, not a guarantee — roughly ${route.estimatedMinutesLow} to ${route.estimatedMinutesHigh} minutes depending on traffic and pickup handling time. A dispatcher will confirm the actual pickup time.`,
    });
  } catch (e) {
    console.error('calculate-route error:', e);
    return res.status(200).json({
      available: false,
      message: 'Route estimation is temporarily unavailable. Share only that a dispatcher will confirm timing.',
    });
  }
}
