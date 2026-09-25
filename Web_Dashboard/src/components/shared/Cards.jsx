/**
 * components/shared/Cards.jsx
 * Shared loading and error card components used across all dashboards.
 */

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function LoadingCard() {
  return (
    <div className="content-card h-32 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-slate-700/80" />
        <div className="flex-1 space-y-3">
          <div className="h-3 w-1/3 rounded bg-slate-700/80" />
          <div className="h-3 w-2/3 rounded bg-slate-800" />
          <div className="h-3 w-1/2 rounded bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

export function ErrorCard({ message, onRetry }) {
  return (
    <div className="content-card flex items-center justify-between">
      <div className="flex items-center gap-3 text-red-400">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm">{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-gray-300 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  );
}
