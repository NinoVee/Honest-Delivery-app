import { redis } from './redis';

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d]/g, '');
}

function clientKey(phone) {
  return `client:${normalizePhone(phone)}`;
}

/** Looks up a verified client/account by caller phone number. Returns null if unknown. */
export async function getClientByPhone(phone) {
  const norm = normalizePhone(phone);
  if (!norm) return null;
  const data = await redis.get(clientKey(norm));
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

/** Adds or updates a verified client/account. Used by the protected admin API. */
export async function upsertClient(client) {
  const norm = normalizePhone(client.phone);
  if (!norm) throw new Error('phone is required');
  const record = {
    phone: norm,
    facilityName: client.facilityName || '',
    accountNumber: client.accountNumber || '',
    authorizedContact: client.authorizedContact !== false,
    createdAt: client.createdAt || new Date().toISOString(),
  };
  await redis.set(clientKey(norm), JSON.stringify(record));
  await redis.sadd('clients:index', norm);
  return record;
}

export async function deleteClient(phone) {
  const norm = normalizePhone(phone);
  if (!norm) return;
  await redis.del(clientKey(norm));
  await redis.srem('clients:index', norm);
}

export async function listClients() {
  const phones = await redis.smembers('clients:index');
  if (!phones || phones.length === 0) return [];
  const clients = await Promise.all(phones.map((p) => getClientByPhone(p)));
  return clients.filter(Boolean);
}
