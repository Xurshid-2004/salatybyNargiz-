const TOKEN_KEY = 'adminToken';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

/** @param {string} path @param {{ method?: string, body?: any, form?: FormData }} [options] */
async function request(path, { method = 'GET', body, form } = {}) {
  /** @type {Record<string, string>} */
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api/admin${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') onUnauthorized();
  if (!res.ok) throw new Error(data.error || `Xatolik (${res.status})`);
  return data;
}

export const api = {
  login: (password) => request('/login', { method: 'POST', body: { password } }),
  orders: (status) => request(`/orders${status ? `?status=${status}` : ''}`),
  updateOrder: (id, body) => request(`/orders/${id}`, { method: 'PATCH', body }),
  products: () => request('/products'),
  createProduct: (body) => request('/products', { method: 'POST', body }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PUT', body }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  // Rasm bazaga base64 ko'rinishida yoziladi
  uploadProductImage: (id, blob) => {
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg' }[blob.type] || 'webp';
    const form = new FormData();
    form.append('image', blob, `image.${ext}`);
    return request(`/products/${id}/image`, { method: 'POST', form });
  },
  // Karta orqali to'lovlar
  cardPayments: () => request('/card-payments'),
  confirmCard: (id) => request(`/card-payments/${id}/confirm`, { method: 'POST' }),
  rejectCard: (id) => request(`/card-payments/${id}/reject`, { method: 'POST' }),
  cardReceipt: async (id) => {
    const res = await fetch(`/api/admin/card-payments/${id}/receipt`, {
      headers: { Authorization: `Bearer ${getToken() || ''}` },
    });
    if (res.status === 401) onUnauthorized();
    if (!res.ok) throw new Error('Chek topilmadi');
    return res.blob();
  },
};

export const streamUrl = () => `/api/admin/stream?token=${encodeURIComponent(getToken() || '')}`;
