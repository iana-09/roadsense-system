import { API_BASE_URL } from './config';

export function getStoredSession() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getAccessToken() {
  return getStoredSession()?.access_token || '';
}

export function authHeaders(headers = {}) {
  const token = getAccessToken();
  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchCurrentUser() {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Session is invalid or expired.');
  return res.json();
}
