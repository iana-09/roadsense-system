/**
 * components/lgu/LGURequestCard.jsx
 * Single row card in the LGU requests list.
 */

import React from 'react';

export default function LGURequestCard({ request: r, onAction, onViewDetail, actionLoading }) {
  const isLoading = actionLoading === r.id;

  const spinner = (color) => (
    <span className={`w-3 h-3 border border-${color}-400 border-t-transparent rounded-full animate-spin`} />
  );

  return (
    <div className="flex items-center justify-between p-4 bg-slate-700/40 border border-slate-600/30 rounded-xl gap-4 hover:border-teal-500/30 hover:bg-slate-700/60 transition-all group">

      {/* Clickable info → opens detail modal */}
      <button className="flex-1 min-w-0 text-left" onClick={() => onViewDetail(r)}>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="text-sm font-semibold text-white truncate group-hover:text-teal-300 transition-colors">
            {r.email}
          </p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
            r.status === 'pending'  ? 'bg-yellow-500/20 text-yellow-400' :
            r.status === 'approved' ? 'bg-teal-500/20 text-teal-400'    :
                                      'bg-red-500/20 text-red-400'
          }`}>{r.status}</span>
        </div>
        <p className="text-xs text-gray-400">Brgy. {r.barangay}, {r.city}{r.region ? `, ${r.region}` : ''}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">
          Submitted {new Date(r.created_at).toLocaleString()}
          {r.reviewed_at && ` · Reviewed ${new Date(r.reviewed_at).toLocaleString()}`}
          {r.reviewed_by && ` by ${r.reviewed_by}`}
        </p>
        <p className="text-[10px] text-teal-500/60 mt-1 group-hover:text-teal-400 transition-colors">
          Click to view details →
        </p>
      </button>

      {/* Action buttons */}
      <div className="flex gap-2 flex-shrink-0">
        {r.status === 'pending' && (<>
          <button
            onClick={() => onAction(r, 'approve')}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-teal-600/20 border border-teal-500/40 text-teal-400 hover:bg-teal-600/40 text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
            {isLoading ? spinner('teal') : '✓'} Approve
          </button>
          <button
            onClick={() => onAction(r, 'reject')}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/40 text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
            {isLoading ? spinner('red') : '✗'} Reject
          </button>
        </>)}

        {r.status === 'approved' && (
          <button
            onClick={() => onAction(r, 'revoke')}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-600/20 border border-amber-500/40 text-amber-400 hover:bg-amber-600/40 text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
            {isLoading ? spinner('amber') : '↩'} Revoke
          </button>
        )}

        {r.status === 'rejected' && (
          <button
            onClick={() => onAction(r, 'reopen')}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-600/40 border border-slate-500/40 text-slate-300 hover:bg-slate-600/60 text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
            {isLoading ? spinner('slate') : '↺'} Re-open
          </button>
        )}
      </div>
    </div>
  );
}
