import { redis } from './redis';

const INDEX_KEY = 'orders:index';

function orderKey(id) {
  return `order:${id}`;
}

function trackKey(token) {
  return `track:${token}`;
}

export function genCode(prefix, len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${s}`;
}

export async function listOrderIds() {
  const ids = await redis.lrange(INDEX_KEY, 0, -1);
  return ids || [];
}

export async function addOrderToIndex(id) {
  await redis.lpush(INDEX_KEY, id);
}

export async function getOrder(id) {
  const data = await redis.get(orderKey(id));
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

export async function saveOrder(order) {
  await redis.set(orderKey(order.id), JSON.stringify(order));
}

export async function setTrackingToken(token, id) {
  await redis.set(trackKey(token), id);
}

export async function getOrderIdByToken(token) {
  return redis.get(trackKey(token));
}

export async function listOrders() {
  const ids = await listOrderIds();
  const orders = await Promise.all(ids.map(getOrder));
  return orders.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
