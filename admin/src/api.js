const TOKEN_KEY = 'adminToken';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function request(path, { method = 'GET', body, form } = {}) {
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
  upload: (file) => {
    const form = new FormData();
    form.append('image', file);
    return request('/upload', { method: 'POST', form });
  },
};

export const streamUrl = () => `/api/admin/stream?token=${encodeURIComponent(getToken() || '')}`;
