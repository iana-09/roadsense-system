import React, { useEffect, useRef, useState } from 'react';
import api from '../../api';

const DEFAULT_SCOPES = ['jobs', 'detections', 'lgu_requests', 'users'];

function titleForItem(item) {
  return item.video_filename || item.class_name || item.email || item.full_name || item.job_id || item.detection_id || item.id || 'Result';
}

function detailForItem(item) {
  return item.status || item.role || [item.city, item.barangay].filter(Boolean).join(', ') || item.job_id || item.user_id || '';
}

export default function SearchBox({ scopes = DEFAULT_SCOPES }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const scopesKey = scopes.join('|');

  useEffect(() => {
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults({});
      setError('');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    const timer = setTimeout(async () => {
      try {
        const scopeList = scopesKey.split('|').filter(Boolean);
        const responses = await Promise.allSettled(scopeList.map((scope) => api.searchRecords(term, scope, 8)));
        if (cancelled) return;

        const merged = {};
        let failedCount = 0;
        responses.forEach((response) => {
          if (response.status === 'rejected') {
            failedCount += 1;
            return;
          }
          Object.entries(response.value.results || {}).forEach(([group, items]) => {
            if (Array.isArray(items) && items.length) merged[group] = items;
          });
        });

        setResults(merged);
        setError(failedCount === scopeList.length ? 'Search failed.' : '');
        setOpen(true);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Search failed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, scopesKey]);

  const groups = Object.entries(results).filter(([, items]) => Array.isArray(items) && items.length > 0);
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={rootRef} className="relative w-full sm:w-auto">
      <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => setQuery(event.target.value)}
        className="w-full rounded-lg border border-slate-600 bg-slate-700 py-2 pl-10 pr-4 text-slate-200 placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500 sm:w-64"
      />

      {showDropdown && (
        <div className="absolute right-0 top-12 z-50 max-h-96 w-full min-w-0 overflow-auto rounded-xl border border-slate-600 bg-slate-800 shadow-2xl shadow-black/40 sm:w-[30rem]">
          <div className="border-b border-slate-700 px-4 py-3">
            <p className="text-sm font-semibold text-white">Search results</p>
            <p className="text-xs text-slate-400">Showing matches for "{query.trim()}"</p>
          </div>

          {loading && <div className="px-4 py-4 text-sm text-slate-300">Searching...</div>}
          {error && <div className="px-4 py-4 text-sm text-red-300">{error}</div>}
          {!loading && !error && groups.length === 0 && (
            <div className="px-4 py-4 text-sm text-slate-400">No matches found.</div>
          )}

          {!loading && !error && groups.map(([group, items]) => (
            <div key={group} className="border-b border-slate-700/70 last:border-b-0">
              <div className="bg-slate-900/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-teal-300">
                {group.replace('_', ' ')}
              </div>
              {items.map((item, index) => (
                <div key={`${group}-${index}`} className="px-4 py-3 hover:bg-slate-700/60">
                  <p className="truncate text-sm font-medium text-slate-100">{titleForItem(item)}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{detailForItem(item)}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
