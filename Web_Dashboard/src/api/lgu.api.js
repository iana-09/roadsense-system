/**
 * api/lgu.api.js
 * All LGU-related API calls — no fetch() in components.
 */

import { API_BASE_URL as BASE_URL } from '../config';
import { authHeaders } from '../auth';

export const getLGURequests = async (status = null) => {
  const qs = status ? `?status=${status}` : '';
  const res = await fetch(`${BASE_URL}/api/lgu/requests${qs}`, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }
  return res.json(); // { total, requests[] }
};

export const updateLGURequest = async (id, action, adminName = 'Admin') => {
  const res = await fetch(`${BASE_URL}/api/lgu/requests/${id}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ action, admin: adminName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Action failed.');
  }
  return res.json(); // { success, status, action }
};

export const checkLGUStatus = async (email) => {
  const res = await fetch(`${BASE_URL}/api/lgu/check/${encodeURIComponent(email)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Not found.');
  }
  return res.json();
};

export const resumeLGURegistration = async (email) => {
  const res = await fetch(`${BASE_URL}/api/lgu/resume/${encodeURIComponent(email)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Cannot resume.');
  }
  return res.json();
};

export const getLGUUsers = async () => {
  const res = await fetch(`${BASE_URL}/api/lgu/users`, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }
  return res.json(); // { total, users[] }
};


export const getMobileUsers = async () => {
  const res = await fetch(`${BASE_URL}/api/lgu/mobile-users`, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }
  return res.json(); // { total, users[] }
};
export const requestDeleteLGUUser = async (userId, adminName = 'Admin') => {
  const res = await fetch(`${BASE_URL}/api/lgu/users/${userId}/request-delete`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ admin: adminName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to send deletion request.');
  }
  return res.json();
};

export const deleteLGUUser = async (userId, adminName = 'Admin') => { // This is the final step after approval of deletion request
  const res = await fetch(`${BASE_URL}/api/lgu/users/${userId}`, {
    method: 'DELETE',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ admin: adminName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to delete user.');
  }
  return res.json();
};
