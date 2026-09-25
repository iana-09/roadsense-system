/**
 * api/auth.api.js
 * All auth-related API calls.
 */

import { API_BASE_URL as BASE_URL } from '../config';
import { authHeaders } from '../auth';

export const updateProfile = async (_userId, fullName, email) => {
  const res = await fetch(`${BASE_URL}/api/auth/update-profile`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ full_name: fullName, email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Update failed.');
  return data;
};
