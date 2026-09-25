/**
 * hooks/useLGURequests.js
 * State + data fetching for LGU requests — keeps dashboard.jsx clean.
 */

import { useState, useCallback, useEffect } from 'react'; 
import { getLGURequests, updateLGURequest } from '../api/lgu.api';

export function useLGURequests(adminName = 'Admin') {
  const [requests,      setRequests]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // request id being actioned

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getLGURequests();
      setRequests(data.requests || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

useEffect(() => {
    load();
  }, [load]);
  
  const performAction = useCallback(async (id, action) => {
    setActionLoading(id);
    try {
      await updateLGURequest(id, action, adminName);
      await load(); // refresh list
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    } finally {
      setActionLoading(null);
    }
  }, [adminName, load]);

  // Derived counts
  const counts = {
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  return { requests, loading, error, actionLoading, counts, load, performAction };
}