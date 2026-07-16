import {
  ApiError, type MenuItem, type CreateOrderBody, type CreateOrderResult,
  type PublicOrder, type AdminOrder, type AdminStats, type Status,
} from '../types';

async function request<T>(url: string, init: RequestInit, pick: (body: any) => T): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError('Could not reach the bakery. Check your connection and try again.', 0);
  }
  let body: any = {};
  try { body = await res.json(); } catch { /* empty body */ }
  if (!res.ok || body?.ok === false) {
    throw new ApiError(body?.error || 'Something went wrong. Please try again.', res.status);
  }
  return pick(body);
}

const json = (data: unknown): RequestInit => ({
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});

export function getMenu(): Promise<MenuItem[]> {
  return request('/api/menu', { method: 'GET' }, (b) => b.menu as MenuItem[]);
}

export function createOrder(body: CreateOrderBody): Promise<CreateOrderResult> {
  return request('/api/orders', json(body), (b) => b as CreateOrderResult);
}

export function getOrder(ref: string, token: string): Promise<PublicOrder> {
  return request(`/api/orders/${encodeURIComponent(ref)}?token=${encodeURIComponent(token)}`,
    { method: 'GET' }, (b) => b.order as PublicOrder);
}

export function cancelOrder(ref: string, token: string): Promise<void> {
  return request(`/api/orders/${encodeURIComponent(ref)}/cancel?token=${encodeURIComponent(token)}`,
    { method: 'POST' }, () => undefined);
}

export function adminListOrders(key: string): Promise<{ orders: AdminOrder[]; stats: AdminStats }> {
  return request('/api/admin/orders', { method: 'GET', headers: { 'x-admin-key': key } },
    (b) => ({ orders: b.orders as AdminOrder[], stats: b.stats as AdminStats }));
}

export function adminSetStatus(ref: string, status: Status, key: string): Promise<void> {
  return request(`/api/admin/orders/${encodeURIComponent(ref)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
    body: JSON.stringify({ status }),
  }, () => undefined);
}
