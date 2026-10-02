import { initData } from './tg';

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/app${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
      'ngrok-skip-browser-warning': '1',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Xatolik (${res.status})`);
  return data;
}

export const api = {
  me: () => request('/me'),
  updateMe: (body) => request('/me', { method: 'PATCH', body }),
  config: () => request('/config'),
  products: () => request('/products'),
  orders: (activeOnly) => request(`/orders${activeOnly ? '?active=1' : ''}`),
  createOrder: (body) => request('/orders', { method: 'POST', body }),
  payment: (id) => request(`/payments/${id}`),
  confirmTestPayment: (id) => request(`/payments/${id}/confirm-test`, { method: 'POST' }),
};
