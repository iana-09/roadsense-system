/**
 * hooks/useDashboardData.js
 * Shared data fetching hook for stats + detections + jobs.
 */

import { useState, useCallback, useEffect } from 'react';
import api from '../api';

export function useDashboardStats() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const s = await api.getDashboardStats();
      setStats(s);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { stats, loading, error, reload: load };
}

export function useDetections(limit = 100) {
  const [detections, setDetections] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.getDetections({ limit });
      setDetections(d.detections || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);
  return { detections, loading, error, reload: load };
}

export function useJobs(limit = 50, filters = {}) {
  const [jobs,    setJobs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const filtersKey = JSON.stringify(filters);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const j = await api.getJobs({ limit, ...filters });
      setJobs(j.jobs || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [limit, filtersKey]);

  useEffect(() => { load(); }, [load]);
  return { jobs, loading, error, reload: load };
}
