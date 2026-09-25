/**
 * components/lgu/LGUUsersTab.jsx
 * Shows all LGU users who have accounts, with delete option.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { RefreshCw, UserX, Mail, MapPin, User } from 'lucide-react';
import { getLGUUsers, requestDeleteLGUUser, deleteLGUUser } from '../../api/lgu.api';

export default function LGUUsersTab({ user: adminUser }) {
  const [users,         setUsers]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [toast,         setToast]         = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting,      setDeleting]      = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getLGUUsers();
      setUsers(data.users || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRequestDelete = async (u) => {
    setDeleting(u.user_id);
    try {
      await requestDeleteLGUUser(u.user_id, adminUser?.full_name || 'Admin');
      showToast(`Deletion request email sent to ${u.email} ✓`);
      setConfirmDelete(null);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleDelete = async (u) => {
    setDeleting(u.user_id);
    try {
      await deleteLGUUser(u.user_id, adminUser?.full_name || 'Admin');
      showToast(`Account ${u.email} deleted.`);
      setConfirmDelete(null);
      load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return (
    <div className="content-card flex items-center justify-center h-32">
      <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="content-card text-red-400 text-sm">{error}</div>
  );

  return (
    <div className="space-y-4">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold
          ${toast.type === 'error' ? 'bg-red-600/95 text-white' : 'bg-teal-600/95 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Delete confirm dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-10 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-white mb-1">Delete LGU Account?</h3>
            <p className="text-sm text-gray-400 mb-4">
              Choose how to proceed with <strong className="text-white">{confirmDelete.email}</strong>.
            </p>

            <div className="bg-slate-700/60 border border-slate-600/40 rounded-xl p-3 mb-5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider w-16">Email</span>
                <span className="text-sm text-white font-medium">{confirmDelete.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider w-16">Location</span>
                <span className="text-sm text-slate-300">Brgy. {confirmDelete.barangay}, {confirmDelete.city}</span>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-sm font-semibold rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={() => handleRequestDelete(confirmDelete)}
                disabled={deleting === confirmDelete.user_id}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600/20 border border-amber-500/40 text-amber-400 hover:bg-amber-600/40 text-sm font-semibold rounded-lg transition-all disabled:opacity-50">
                <Mail className="w-3.5 h-3.5" />
                Send Deletion Email
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting === confirmDelete.user_id}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                <UserX className="w-3.5 h-3.5" />
                Delete Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="content-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">LGU Accounts</h2>
            <p className="text-xs text-gray-400 mt-0.5">{users.length} registered LGU user{users.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-gray-300 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {users.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No LGU accounts yet.</p>
        ) : (
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.user_id}
                className="flex items-center justify-between p-4 bg-slate-700/40 border border-slate-600/30 rounded-xl gap-4">
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {u.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-sm font-semibold text-white truncate">{u.full_name}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400 flex-shrink-0">
                      LGU Officer
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span>Brgy. {u.barangay}, {u.city}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Registered {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => setConfirmDelete(u)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/40 text-xs font-semibold rounded-lg transition-all flex-shrink-0">
                  <UserX className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}