const API = process.env.REACT_APP_API_URL || 'http://localhost:5741/api';
const TOKEN_KEY = 'tokendesk_token';

let onUnauthorized = () => {};

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !path.endsWith('/login')) {
    setToken('');
    onUnauthorized();
  }
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function login(username, password) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}

export function me() {
  return request('/auth/me');
}

export function changePassword(currentPassword, password) {
  return request('/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword, password }) });
}

export function rotateApiKey() {
  return request('/auth/api-key', { method: 'POST', body: '{}' });
}

export function getWallet() {
  return request('/wallet');
}

export function submitTopup(body) {
  return request('/wallet/topups', { method: 'POST', body: JSON.stringify(body) });
}

export function getPayoutWallets() {
  return request('/payout-wallets');
}

export function createPayoutWallet(body) {
  return request('/payout-wallets', { method: 'POST', body: JSON.stringify(body) });
}

export function updatePayoutWallet(id, body) {
  return request(`/payout-wallets/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deletePayoutWallet(id) {
  return request(`/payout-wallets/${id}`, { method: 'DELETE' });
}

export function getDeposits() {
  return request('/deposits');
}
