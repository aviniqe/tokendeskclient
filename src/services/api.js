const API = process.env.REACT_APP_API_URL || 'http://localhost:5741/api';

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function getConfig() {
  return request('/config');
}

export function createDeposit() {
  return request('/deposits', { method: 'POST', body: '{}' });
}

export function getDeposit(id) {
  return request(`/deposits/${id}`);
}
