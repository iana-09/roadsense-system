/**
 * components/lgu/LGUConfirmDialog.jsx
 * Confirmation dialog before approve / reject / revoke / reopen.
 */

import React from 'react';

const CONFIG = {
  approve: {
    title:    'Approve LGU Request?',
    desc:     'This will allow the LGU to complete their account setup and access the system.',
    btnLabel: 'Yes, Approve',
    btnClass: 'bg-teal-600 hover:bg-teal-700',
  },
  reject: {
    title:    'Reject LGU Request?',
    desc:     'The LGU will not be able to complete registration. You can re-open this request later.',
    btnLabel: 'Yes, Reject',
    btnClass: 'bg-red-600 hover:bg-red-700',
  },
  revoke: {
    title:    'Revoke LGU Approval?',
    desc:     'This will set the request back to pending. The LGU will no longer be whitelisted until re-approved.',
    btnLabel: 'Yes, Revoke',
    btnClass: 'bg-amber-600 hover:bg-amber-700',
  },
  reopen: {
    title:    'Re-open LGU Request?',
    desc:     'This will set the request back to pending so it can be reviewed again.',
    btnLabel: 'Yes, Re-open',
    btnClass: 'bg-slate-600 hover:bg-slate-500',
  },
};

export default function LGUConfirmDialog({ dialog, onConfirm, onCancel }) {
  if (!dialog) return null;

  const cfg = CONFIG[dialog.action];
  if (!cfg) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative z-10 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">

        <h3 className="text-lg font-bold text-white mb-1">{cfg.title}</h3>
        <p className="text-sm text-gray-400 mb-4">{cfg.desc}</p>

        {/* LGU info summary */}
        <div className="bg-slate-700/60 border border-slate-600/40 rounded-xl p-3 mb-5 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider w-16">Email</span>
            <span className="text-sm text-white font-medium truncate">{dialog.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider w-16">Location</span>
            <span className="text-sm text-slate-300">Brgy. {dialog.barangay}, {dialog.city}</span>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-sm font-semibold rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(dialog.id, dialog.action)}
            className={`px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors ${cfg.btnClass}`}>
            {cfg.btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}