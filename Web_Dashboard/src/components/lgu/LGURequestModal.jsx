/**
 * components/lgu/LGURequestModal.jsx
 * Detail view modal for a single LGU request.
 */

import React from 'react';
import { UserPlus } from 'lucide-react';

export default function LGURequestModal({ request: r, onClose, onAction }) {
  if (!r) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-cyan-500/20 border border-cyan-500/30 rounded-lg flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">LGU Request Details</h3>
              <p className="text-[11px] text-slate-400">Full information for this request</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-600 transition-all text-sm">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Status badge */}
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            r.status === 'pending'  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
            r.status === 'approved' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'      :
                                      'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>{r.status.toUpperCase()}</span>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Email',            value: r.email,    full: true },
              { label: 'Region',           value: r.region || '—' },
              { label: 'City / Municipality', value: r.city  },
              { label: 'Barangay',         value: r.barangay  },
              { label: 'Submitted',        value: new Date(r.created_at).toLocaleString() },
              { label: 'Reviewed',         value: r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : '—' },
              { label: 'Reviewed By',      value: r.reviewed_by || '—' },
            ].map(item => (
              <div key={item.label}
                className={`bg-slate-700/50 border border-slate-600/40 rounded-xl p-3 ${item.full ? 'col-span-2' : ''}`}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{item.label}</p>
                <p className="text-sm text-white font-medium break-all">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Request ID */}
          <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Request ID</p>
            <p className="text-xs font-mono text-slate-400">{r.id}</p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-700 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-sm font-semibold rounded-lg transition-colors">
            Close
          </button>

          {r.status === 'pending' && (<>
            <button
              onClick={() => { onClose(); onAction(r, 'reject'); }}
              className="px-4 py-2 bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/40 text-sm font-semibold rounded-lg transition-all">
              ✗ Reject
            </button>
            <button
              onClick={() => { onClose(); onAction(r, 'approve'); }}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors">
              ✓ Approve
            </button>
          </>)}

          {r.status === 'approved' && (
            <button
              onClick={() => { onClose(); onAction(r, 'revoke'); }}
              className="px-4 py-2 bg-amber-600/20 border border-amber-500/40 text-amber-400 hover:bg-amber-600/40 text-sm font-semibold rounded-lg transition-all">
              ↩ Revoke Approval
            </button>
          )}

          {r.status === 'rejected' && (
            <button
              onClick={() => { onClose(); onAction(r, 'reopen'); }}
              className="px-4 py-2 bg-slate-600/40 border border-slate-500/40 text-slate-300 hover:bg-slate-600/60 text-sm font-semibold rounded-lg transition-all">
              ↺ Re-open
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
