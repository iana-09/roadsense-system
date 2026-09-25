/**
 * components/shared/Badges.jsx
 * Reusable status badge components.
 */

import React from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

export function JobStatusBadge({ status, job = null }) {
  const pendingText = job?.awaiting_video
    ? 'Waiting for video'
    : job?.has_blob_video
      ? 'Ready to process'
      : 'Pending';

  const map = {
    completed:  { text: 'Processed',  color: 'text-green-400'  },
    processing: { text: 'Processing', color: 'text-yellow-400' },
    pending:    { text: pendingText,  color: 'text-slate-400'  },
    failed:     { text: 'Failed',     color: 'text-red-400'    },
  };
  const s = map[status] || map.pending;
  return <span className={s.color}>{s.text}</span>;
}

export function DetectionStatusBadge({ status }) {
  const map = {
    pending:        { label: 'Pending',     bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: <Clock className="w-3 h-3" /> },
    verified:       { label: 'Verified',    bg: 'bg-teal-500/20',   text: 'text-teal-400',   icon: <CheckCircle className="w-3 h-3" /> },
    false_positive: { label: 'False +',     bg: 'bg-slate-500/20',  text: 'text-slate-400',  icon: <XCircle className="w-3 h-3" /> },
    fixed:          { label: 'Fixed',       bg: 'bg-green-500/20',  text: 'text-green-400',  icon: <CheckCircle className="w-3 h-3" /> },
    unverified:     { label: 'Unverified',  bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: <Clock className="w-3 h-3" /> },
  };
  const s = map[status] || map.unverified;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.icon}{s.label}
    </span>
  );
}
