// Uses OpenStreetMap's free Nominatim geocoder — no API key required, which keeps this
// working out of the box. Nominatim's usage policy caps free use at ~1 request/second and
// asks for a descriptive User-Agent, both handled below. This is fine for a single dispatch
// line's call volume; for higher volume or stricter SLAs, swap this for Google Maps
// Geocoding/Directions or Mapbox (same function signatures, different fetch call inside).

const USER_AGENT = 'HonestCareMedicalDelivery/1.0 (dispatch address validation)';

export async function geocodeAddress(address) {
  if (!address || !address.trim()) {
    return { validated: false, ambiguous: false, confidence: 0, normalizedAddress: null, lat: null, lon: null };
  }
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&addressdetails=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Geocoding service returned ${res.status}`);
  }
  const results = await res.json();
  if (!results || results.length === 0) {
    return { validated: false, ambiguous: false, confidence: 0, normalizedAddress: null, lat: null, lon: null };
  }
  const top = results[0];
  const confidence = Math.min(1, Number(top.importance || 0.5));
  const ambiguous = results.length > 1 && confidence < 0.6;
  return {
    validated: !ambiguous,
    ambiguous,
    confidence,
    normalizedAddress: top.display_name,
    lat: Number(top.lat),
    lon: Number(top.lon),
  };
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Rough ETA estimate from straight-line distance and an assumed average urban courier
 * speed. This is intentionally approximate (no live traffic/routing) — good enough for a
 * phone agent to say "usually around X to Y minutes," not a delivery guarantee. For
 * production-accurate routing, replace with Google Directions or Mapbox Directions.
 */
export function estimateRoute(lat1, lon1, lat2, lon2) {
  const miles = haversineMiles(lat1, lon1, lat2, lon2);
  const AVG_SPEED_MPH = 24; // conservative urban/suburban average incl. stops
  const driveMinutes = (miles / AVG_SPEED_MPH) * 60;
  const low = Math.max(10, Math.round(driveMinutes * 0.85));
  const high = Math.round(driveMinutes * 1.35 + 10); // padding for pickup handling time
  return {
    distanceMiles: Math.round(miles * 10) / 10,
    estimatedMinutesLow: low,
    estimatedMinutesHigh: high,
  };
}
