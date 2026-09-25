/**
 * RoadSense API Client
 * Connects Web Dashboard to Web Server running on port 8000
 */

import { API_BASE_URL as BASE_URL } from './config';
import { authHeaders } from './auth';

export const MAX_VIDEO_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_VIDEO_SIZE_LABEL = '2 GB';
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

export function payloadTooLargeMessage(size = null) {
  if (size && Number.isFinite(size)) {
    return `This video is ${formatFileSize(size)}. RoadSense only accepts videos up to ${MAX_VIDEO_SIZE_LABEL}. Please choose a shorter video or lower the resolution before uploading.`;
  }
  return `RoadSense only accepts videos up to ${MAX_VIDEO_SIZE_LABEL}. Please choose a shorter video or lower the resolution before uploading.`;
}

export function createPayloadTooLargeError(size = null) {
  const err = new Error(payloadTooLargeMessage(size));
  err.code = 'PAYLOAD_TOO_LARGE';
  return err;
}

export function isPayloadTooLargeError(err) {
  const msg = (err?.message || String(err || '')).toLowerCase();
  return err?.code === 'PAYLOAD_TOO_LARGE'
    || msg.includes('payload too large')
    || msg.includes('file too large')
    || msg.includes('too large')
    || msg.includes('exceeds')
    || msg.includes('413');
}

export function assertVideoFileWithinLimit(file) {
  if (file?.size && file.size > MAX_VIDEO_SIZE_BYTES) {
    throw createPayloadTooLargeError(file.size);
  }
}

async function readErrorDetail(res, fallback) {
  const err = await res.json().catch(() => ({ detail: res.statusText }));
  return err.detail || err.message || fallback;
}

async function throwUploadError(res, fallback) {
  const detail = await readErrorDetail(res, fallback);
  if (res.status === 413 || isPayloadTooLargeError({ message: detail })) {
    throw createPayloadTooLargeError();
  }
  throw new Error(detail || fallback);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function request(path, options = {}) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: authHeaders({ 'Content-Type': 'application/json', ...options.headers }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`[API] ${path}:`, err.message);
    throw err;
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────

export const getHealth = () => request('/');

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginUser = async (username, password, role = '') => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Login failed: HTTP ${res.status}`);
  }
  return res.json();
};

export const signup = async (userData) => {
  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Signup failed: HTTP ${res.status}`);
  }
  return res.json();
};

export const createAdminAccount = async (userData) => {
  const res = await fetch(`${BASE_URL}/api/auth/admin/signup`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Admin signup failed: HTTP ${res.status}`);
  }
  return res.json();
};

export const createSAEAccount = async (userData) => {
  const res = await fetch(`${BASE_URL}/api/auth/sae/signup`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `SAE signup failed: HTTP ${res.status}`);
  }
  return res.json();
};

export const getLoginLogs = (kind = 'all', limit = 100) =>
  request(`/api/auth/login-logs?kind=${encodeURIComponent(kind)}&limit=${encodeURIComponent(limit)}`);

export const getSecurityEvents = (role, category = 'all', limit = 200) =>
  request(`/api/auth/security-events?role=${encodeURIComponent(role)}&category=${encodeURIComponent(category)}&limit=${encodeURIComponent(limit)}`);

export const logoutUser = () => request('/api/auth/logout', { method: 'POST' });

export const sendVerificationCode = async (email) => {
  const res = await fetch(`${BASE_URL}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Failed to send code: HTTP ${res.status}`);
  }
  return res.json();
};

export const verifyCode = async (email, code) => {
  const res = await fetch(`${BASE_URL}/api/auth/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Verification failed: HTTP ${res.status}`);
  }
  return res.json();
};

export const submitLGURequest = async (email, regionCode, cityCode, barangayCode) => {
  const res = await fetch(`${BASE_URL}/api/lgu/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      region_code: regionCode,
      city_code: cityCode,
      barangay_code: barangayCode,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: HTTP ${res.status}`);
  }
  return res.json();
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export const getDashboardStats = () => request('/api/dashboard/stats');

export const getSystemHealth = () => request('/api/dashboard/system-health');

export const getGpuPreviewUrl = (jobId) =>
  `${BASE_URL}/api/dashboard/gpu-preview/${encodeURIComponent(jobId)}`;

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const getJobs = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status)  params.append('status',  filters.status);
  if (filters.user_id) params.append('user_id', filters.user_id);
  if (filters.limit)   params.append('limit',   filters.limit);
  const qs = params.toString();
  return request(`/api/jobs${qs ? `?${qs}` : ''}`);
};

export const getJob = (jobId) => request(`/api/jobs/${jobId}`);

export const getContributors = (limit = 200) =>
  request(`/api/admin/contributors?limit=${encodeURIComponent(limit)}`);

export const getContributorLeaderboard = (limit = 50) =>
  request(`/api/contributors/leaderboard?limit=${encodeURIComponent(limit)}`);

export const processJob = (jobId) =>
  request(`/api/jobs/${jobId}/process`, { method: 'POST' });

export const stopJob = (jobId) =>
  request(`/api/jobs/${jobId}/stop`, { method: 'POST' });

export const stopAllProcessingJobs = () =>
  request('/api/jobs/stop-processing', { method: 'POST' });

export const deleteJob = (jobId) =>
  request(`/api/jobs/${jobId}`, { method: 'DELETE' });

// ─── Uploads ──────────────────────────────────────────────────────────────────

export const uploadVideo = async (file, userId = null) => {
  assertVideoFileWithinLimit(file);
  const form = new FormData();
  form.append('file', file);
  if (userId) form.append('user_id', userId);
  const res = await fetch(`${BASE_URL}/api/upload/video`, { method: 'POST', body: form });
  if (!res.ok) {
    await throwUploadError(res, `Upload failed: HTTP ${res.status}`);
  }
  return res.json();
};

export const uploadPhoto = async (file, location, userId = null) => {
  if (file?.size && file.size > MAX_PHOTO_SIZE_BYTES) {
    throw new Error('RoadSense only accepts photos up to 5 MB.');
  }

  const form = new FormData();
  form.append('file', file);
  form.append('latitude', String(location.latitude));
  form.append('longitude', String(location.longitude));
  if (Number.isFinite(location.accuracy)) {
    form.append('gps_accuracy', String(location.accuracy));
  }
  if (userId) form.append('user_id', userId);

  const res = await fetch(`${BASE_URL}/api/upload/photo`, { method: 'POST', body: form });
  if (!res.ok) {
    await throwUploadError(res, `Photo upload failed: HTTP ${res.status}`);
  }
  return res.json();
};

export const uploadDashcamVideo = async (jobId, file) => {
  assertVideoFileWithinLimit(file);
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/api/upload/dashcam-video/${jobId}`, { method: 'POST', body: form });
  if (!res.ok) {
    await throwUploadError(res, `Dashcam video upload failed: HTTP ${res.status}`);
  }
  return res.json();
};

export const uploadGPS = async (jobId, file) => {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/api/upload/gps/${jobId}`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `GPS upload failed: HTTP ${res.status}`);
  }
  return res.json();
};

// ─── Detections ───────────────────────────────────────────────────────────────

export const getDetections = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.latitude)  params.append('latitude',  filters.latitude);
  if (filters.longitude) params.append('longitude', filters.longitude);
  if (filters.radius_km) params.append('radius_km', filters.radius_km);
  if (filters.limit)     params.append('limit',     filters.limit);
  const qs = params.toString();
  return request(`/api/detections${qs ? `?${qs}` : ''}`);
};

export const getDetection = (detectionId) => request(`/api/detections/${detectionId}`);

export const updateDetectionStatus = (detectionId, status) =>
  request(`/api/detections/${detectionId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const deleteDetection = (detectionId) =>
  request(`/api/detections/${detectionId}`, { method: 'DELETE' });

export const bulkDetectionAction = (detectionIds, action) =>
  request('/api/detections/bulk/action', {
    method: 'POST',
    body: JSON.stringify({ detection_ids: detectionIds, action }),
  });

export const updateDetectionLocation = (detectionId, latitude, longitude) =>
  request(`/api/detections/${detectionId}/location`, {
    method: 'PATCH',
    body: JSON.stringify({ latitude, longitude }),
  });

// ─── Profile ──────────────────────────────────────────────────────────────────

export const uploadDetectionImage = async (detectionId, file) => {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/api/detections/${detectionId}/image`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Image upload failed: HTTP ${res.status}`);
  }
  return res.json();
};

export const updateProfile = (_userId, fullName, email) =>
  request('/api/auth/update-profile', {
    method: 'PATCH',
    body: JSON.stringify({ full_name: fullName, email }),
  });

// ─── Reports ──────────────────────────────────────────────────────────────────

export const getReportsSummary = () => request('/api/reports/summary');

export const getReportsJobs = (limit = 20) =>
  request(`/api/reports/jobs?limit=${limit}`);

// â”€â”€â”€ Search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const searchRecords = (query, scope = '', limit = 10) => {
  const params = new URLSearchParams();
  params.append('q', query);
  if (scope) params.append('scope', scope);
  if (limit) params.append('limit', limit);
  return request(`/api/search?${params.toString()}`);
};

export const getLocationSuggestions = (query, limit = 5) => {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return request(`/api/locations/suggestions?${params.toString()}`);
};

// ─── Default export ───────────────────────────────────────────────────────────

const api = {
  // Health
  getHealth,

  // Auth
  loginUser,
  signup,
  createAdminAccount,
  createSAEAccount,
  getLoginLogs,
  getSecurityEvents,
  logoutUser,
  sendVerificationCode,
  verifyCode,
  updateProfile,

  // LGU
  submitLGURequest,

  // Dashboard
  getDashboardStats,
  getSystemHealth,
  getGpuPreviewUrl,

  // Jobs
  getJobs,
  getJob,
  getContributors,
  getContributorLeaderboard,
  processJob,
  stopJob,
  stopAllProcessingJobs,
  deleteJob,
  uploadVideo,
  uploadPhoto,
  uploadDashcamVideo,
  uploadGPS,
  isPayloadTooLargeError,
  payloadTooLargeMessage,
  assertVideoFileWithinLimit,

  // Detections
  getDetections,
  getDetection,
  updateDetectionStatus,
  deleteDetection,
  bulkDetectionAction,
  updateDetectionLocation,
  uploadDetectionImage,

  // Reports
  getReportsSummary,
  getReportsJobs,

  // Search
  searchRecords,
  getLocationSuggestions,
};

export default api;
