import { initData } from './tg';

/** @param {string} path @param {{ method?: string, body?: any, form?: FormData }} [options] */
async function request(path, { method = 'GET', body, form } = {}) {
  /** @type {Record<string, string>} */
  const headers = {
    'X-Telegram-Init-Data': initData,
    'ngrok-skip-browser-warning': '1',
  };
  // Fayl (FormData) yuborilganda Content-Type ni brauzer o'zi qo'yadi
  if (!form) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api/app${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = /** @type {Error & { status?: number, code?: string }} */ (new Error(data.error || `Xatolik (${res.status})`));
    err.status = res.status;
    err.code = data.code; // masalan PHONE_REQUIRED
    throw err;
  }
  return data;
}

export const api = {
  me: () => request('/me'),
  updateMe: (body) => request('/me', { method: 'PATCH', body }),
  verifyContact: (response) => request('/auth/contact', { method: 'POST', body: { response } }),
  requestContactInChat: () => request('/auth/contact-request', { method: 'POST' }),
  config: () => request('/config'),
  products: () => request('/products'),
  orders: (activeOnly) => request(`/orders${activeOnly ? '?active=1' : ''}`),
  createOrder: (body) => request('/orders', { method: 'POST', body }),
  payment: (id) => request(`/payments/${id}`),
  confirmTestPayment: (id) => request(`/payments/${id}/confirm-test`, { method: 'POST' }),
  // Karta orqali to'lov: to'lov cheki (rasm)
  uploadReceipt: (id, blob) => {
    const form = new FormData();
    form.append('image', blob, blob.type === 'image/png' ? 'chek.png' : 'chek.jpg');
    return request(`/payments/${id}/receipt`, { method: 'POST', form });
  },
};
