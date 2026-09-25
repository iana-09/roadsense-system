/**
 * pages/guest-dashboard.jsx  — Guest Dashboard
 * Clean refactor: logic in hooks, UI in components, no raw fetch() here.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Home, Map, Upload, BookOpen, AlertCircle, AlertTriangle, Info, LogIn, RefreshCw, ImageIcon, HeartPulse, Trophy, Medal, Crown, Sparkles } from 'lucide-react';

// Shared components
import { LoadingCard, ErrorCard } from '../components/shared/Cards';
import { guestShapeStyles }       from '../components/shared/dashboardStyles';
import SearchBox                  from '../components/shared/SearchBox';
import UploadVideoButton          from '../components/shared/UploadVideoButton';
import { AuthenticatedImage, DetectionFrameModal } from '../components/shared/DetectionImage';

// Map
import { GuestMapContent } from '../components/map/MapPages';
import RoadHealthContent from '../components/road-health/RoadHealthContent';

// Hooks
import { useDashboardStats, useDetections, useJobs } from '../hooks/useDashboardData';
import api from '../api';

function getGuestSessionId() {
  const existing = sessionStorage.getItem('roadsense_guest_id');
  if (existing) return existing;
  const id = `guest_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36).slice(-6)}`;
  sessionStorage.setItem('roadsense_guest_id', id);
  return id;
}

const PAGE_SIZE = 10;

function usePagination(items, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    page: currentPage,
    totalPages,
    pageItems: items.slice(start, start + pageSize),
    start,
    setPage,
  };
}

function PaginationControls({ page, totalPages, totalItems, start, pageSize = PAGE_SIZE, onPageChange }) {
  if (totalItems <= pageSize) return null;
  const end = Math.min(start + pageSize, totalItems);
  return (
    <div className="flex flex-col gap-3 border-t border-slate-700/60 pt-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
      <span>Showing {start + 1}-{end} of {totalItems}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="min-w-16 text-center text-xs text-slate-400">Page {page} / {totalPages}</span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ── Guest Dashboard ───────────────────────────────────────────────────────────
function GuestDashboardContent() {
  const { stats, loading, error, reload: reloadStats } = useDashboardStats();
  const { detections, loading: dLoading, reload: reloadDetections } = useDetections(500);
  const [selectedFrame, setSelectedFrame] = useState(null);

  const load = () => { reloadStats(); reloadDetections(); };

  if (loading || dLoading) return <LoadingCard />;
  if (error) return <ErrorCard message={`Failed to load public data: ${error}`} onRetry={load} />;

  const severityBg = (s) => ({
    critical: 'bg-red-500/20 text-red-400',
    high:     'bg-orange-500/20 text-orange-400',
    medium:   'bg-yellow-500/20 text-yellow-400',
    low:      'bg-green-500/20 text-green-400',
  }[s] || 'bg-slate-500/20 text-slate-400');
  const verifiedDetections = detections
    .filter(d => (d.status || '').toLowerCase() === 'verified')
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return (
    <div className="space-y-6">
      {/* Guest notice */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-300">Guest Access — Read Only</p>
          <p className="text-xs text-amber-400/80 mt-0.5">You can view public hazard data. Reports and full analytics require an account.</p>
        </div>
        <a href="/login" className="flex-shrink-0 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors">Sign In</a>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Detections', value: stats.total_detections    ?? 0, sub: 'All time',   color: 'text-white',      iconBg: 'bg-teal-500/20',   iconColor: 'text-teal-400',   path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Potholes',         value: stats.by_class?.potholes  ?? 0, sub: 'Nationwide', color: 'text-red-400',    iconBg: 'bg-red-500/20',    iconColor: 'text-red-400',    path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
          { label: 'Road Cracks',      value: stats.by_class?.cracks    ?? 0, sub: 'Detected',   color: 'text-orange-400', iconBg: 'bg-orange-500/20', iconColor: 'text-orange-400', path: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
          { label: 'Jobs Processed',   value: stats.completed           ?? 0, sub: 'Videos done', color: 'text-cyan-400',  iconBg: 'bg-cyan-500/20',   iconColor: 'text-cyan-400',   path: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0' },
        ].map(item => (
          <div key={item.label} className="content-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-gray-400">{item.label}</h2>
                <p className={`text-3xl font-bold mt-2 ${item.color}`}>{item.value}</p>
                <p className="text-xs text-gray-500 mt-1">{item.sub}</p>
              </div>
              <div className={`w-12 h-12 ${item.iconBg} rounded-lg flex items-center justify-center`}>
                <svg className={`w-6 h-6 ${item.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.path} />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent detections public feed */}
      <div className="content-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Detections</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 bg-teal-500/20 text-teal-400 rounded-full font-medium">Public Feed</span>
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-gray-300 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
        {verifiedDetections.length === 0
          ? <p className="text-center text-gray-500 py-6">No verified detections yet.</p>
          : (
            <div className="space-y-3">
              {verifiedDetections.map(d => (
                <div key={d.detection_id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                  <div className="flex min-w-0 items-center gap-3">
                    {d.image_url ? (
                      <button
                        type="button"
                        onClick={() => setSelectedFrame(d)}
                        className="block h-14 w-20 shrink-0 overflow-hidden rounded-md border border-slate-600 bg-slate-900"
                        title="View detection image"
                      >
                        <AuthenticatedImage
                          key={d.image_url}
                          src={d.image_url}
                          alt={`${d.class_name?.replace(/_/g, ' ') || 'Detected hazard'} crop`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className={`flex h-14 w-20 shrink-0 items-center justify-center rounded-md border border-slate-600 ${severityBg(d.severity)}`}>
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white capitalize">{d.class_name?.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-400">{d.latitude?.toFixed(4)}°N, {d.longitude?.toFixed(4)}°E</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">{new Date(d.created_at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* Locked analytics */}
      <div className="content-card relative overflow-hidden">
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/70 backdrop-blur-sm rounded-xl">
          <div className="text-center px-6">
            <svg className="w-10 h-10 text-slate-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-white font-semibold mb-1">Analytics Locked</p>
            <p className="text-slate-400 text-sm mb-4">Sign in or request an LGU account to view detailed analytics.</p>
            <a href="/login" className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors">
              <LogIn className="w-4 h-4" /> Sign In
            </a>
          </div>
        </div>
        <h2 className="text-lg font-semibold text-white mb-4">Hazard Distribution</h2>
        <div className="space-y-4 opacity-30 pointer-events-none select-none">
          {[
            { label: 'Potholes',    color: 'bg-red-500',    width: '40%' },
            { label: 'Cracks',      color: 'bg-orange-500', width: '29%' },
            { label: 'Speed Bumps', color: 'bg-yellow-500', width: '22%' },
            { label: 'Flooding',    color: 'bg-blue-500',   width: '9%'  },
          ].map(item => (
            <div key={item.label}>
              <div className="flex justify-between mb-2"><span className="text-sm text-gray-400">{item.label}</span></div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className={`${item.color} h-2 rounded-full`} style={{ width: item.width }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <DetectionFrameModal detection={selectedFrame} onClose={() => setSelectedFrame(null)} />
    </div>
  );
}

// ── Guest Uploads ─────────────────────────────────────────────────────────────
function ContributorRankingsContent() {
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data = await api.getContributorLeaderboard();
      setContributors(data.contributors || []);
    } catch (e) {
      setError(e.message || 'Failed to load the contributor rankings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  if (loading) return <LoadingCard />;
  if (error) return <ErrorCard message={error} onRetry={load} />;

  const topThree = contributors.slice(0, 3);
  const leaderStyles = [
    { label: 'Community champion', card: 'border-amber-300/40 bg-gradient-to-br from-amber-400/20 to-amber-950/25', badge: 'bg-amber-300 text-amber-950', icon: Crown, iconColor: 'text-amber-300' },
    { label: 'Second place', card: 'border-slate-300/25 bg-gradient-to-br from-slate-300/15 to-slate-900', badge: 'bg-slate-300 text-slate-900', icon: Medal, iconColor: 'text-slate-200' },
    { label: 'Third place', card: 'border-orange-400/25 bg-gradient-to-br from-orange-500/15 to-slate-900', badge: 'bg-orange-400 text-orange-950', icon: Medal, iconColor: 'text-orange-300' },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/15 via-slate-900 to-teal-950/40 p-5 shadow-xl sm:p-7">
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div><p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-200"><Trophy className="h-3.5 w-3.5" /> Community leaderboard</p><h2 className="text-2xl font-bold text-white">RoadSense Contributors</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Celebrating contributors who chose to be recognized. Anonymous contributions are never included in these rankings.</p></div>
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
        </div>
        {topThree.length === 0 ? <p className="py-16 text-center text-slate-400">No named contributions have been made yet.</p> : (
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {topThree.map((person, index) => {
              const style = leaderStyles[index];
              const Icon = style.icon;
              return (
                <article key={`${person.rank}-${person.name}`} className={`group relative overflow-hidden rounded-2xl border p-5 transition duration-300 hover:-translate-y-1.5 hover:border-teal-300/50 hover:shadow-2xl hover:shadow-teal-950/40 ${style.card}`}>
                  <Sparkles className="absolute -right-4 -top-4 h-20 w-20 text-white/5 transition duration-500 group-hover:rotate-12 group-hover:scale-110 group-hover:text-white/10" />
                  <div className="relative flex items-start justify-between">
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black shadow-lg ${style.badge}`}>{person.rank}</span>
                    <Icon className={`h-7 w-7 transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-6 ${style.iconColor}`} />
                  </div>
                  <p className="relative mt-6 text-xs font-bold uppercase tracking-widest text-slate-400">{style.label}</p>
                  <h3 className="relative mt-1 truncate text-xl font-bold text-white transition-colors group-hover:text-teal-200">{person.name}</h3>
                  <p className="relative mt-4 text-sm text-slate-300"><span className="text-3xl font-black text-white">{person.contribution_count}</span> named contribution{person.contribution_count === 1 ? '' : 's'}</p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="content-card">
        <div className="mb-4"><h2 className="text-lg font-semibold text-white">Contributor ladder</h2><p className="mt-1 text-sm text-slate-400">Ranked by total named photo, video, and dashcam contributions.</p></div>
        {contributors.length === 0 ? <p className="py-8 text-center text-gray-500">The ladder will appear after the first named contribution.</p> : <div className="overflow-x-auto rounded-xl border border-slate-700/60"><table className="custom-table min-w-[560px]"><thead><tr><th>Rank</th><th>Contributor</th><th>Contributions</th></tr></thead><tbody>{contributors.map(person => <tr key={`${person.rank}-${person.name}`} className="group transition duration-200 hover:bg-teal-500/10"><td><span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-black transition duration-200 group-hover:scale-110 ${person.rank === 1 ? 'bg-amber-400 text-amber-950' : person.rank === 2 ? 'bg-slate-300 text-slate-900' : person.rank === 3 ? 'bg-orange-400 text-orange-950' : 'bg-slate-700 text-slate-200'}`}>{person.rank}</span></td><td className="font-semibold text-white transition-colors group-hover:text-teal-200">{person.name}</td><td><span className="inline-flex rounded-full bg-teal-500/10 px-3 py-1 font-bold text-teal-300 transition group-hover:bg-teal-400 group-hover:text-slate-950">{person.contribution_count}</span></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}

function GuestUploadsContent() {
  const guestId = useMemo(() => getGuestSessionId(), []);
  const { jobs,  loading,  error,  reload: reloadJobs  } = useJobs(200, { user_id: guestId });
  const { reload: reloadStats } = useDashboardStats();
  const load = () => { reloadJobs(); reloadStats(); };
  const sessionProcessing = jobs.filter(job => job.status === 'processing').length;
  const {
    page,
    totalPages,
    pageItems: pagedJobs,
    start,
    setPage,
  } = usePagination(jobs);

  const statusDisplay = {
    completed:  { text: '✓ Processed',  color: 'text-green-400'  },
    processing: { text: '⏳ Processing', color: 'text-yellow-400' },
    pending:    { text: '⏸ Pending',    color: 'text-slate-400'  },
    failed:     { text: '✗ Failed',     color: 'text-red-400'    },
  };

  if (loading) return <LoadingCard />;
  if (error)   return <ErrorCard message={`Failed to load: ${error}`} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-300">Guest uploads shown here are only from this browser session. Closing the tab or browser clears this local history.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: 'Total Videos',     value: jobs.length,        color: 'text-teal-400',    sub: 'This session'      },
          { label: 'Processing Queue', value: sessionProcessing,  color: 'text-yellow-400',  sub: 'This session'      },
          { label: 'Data Quality',     value: '96.2%',                 color: 'text-emerald-400', sub: 'GPS accuracy'       },
        ].map(item => (
          <div key={item.label} className="content-card">
            <h3 className="text-sm font-medium text-gray-400">{item.label}</h3>
            <p className={`text-3xl font-bold mt-2 ${item.color}`}>{item.value}</p>
            <p className="text-xs text-gray-500 mt-1">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="content-card">
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-lg font-semibold text-white">Recent Video Submissions</h2>
          <div className="flex flex-wrap items-center gap-2">
            <UploadVideoButton userId={guestId} onUploaded={load} />
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-gray-300 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
        {jobs.length === 0
          ? <p className="text-center text-gray-500 py-8">No submissions yet.</p>
          : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border border-slate-700/60">
                <table className="custom-table min-w-[640px]">
                  <thead><tr><th>Timestamp</th><th>Contributor</th><th>Status</th></tr></thead>
                  <tbody>
                    {pagedJobs.map(job => {
                      const s = statusDisplay[job.status] || statusDisplay.pending;
                      return (
                        <tr key={job.job_id}>
                          <td>{new Date(job.created_at).toLocaleString()}</td>
                          <td className="text-slate-500 italic">Anonymous</td>
                          <td><span className={s.color}>{s.text}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={page}
                totalPages={totalPages}
                totalItems={jobs.length}
                start={start}
                onPageChange={setPage}
              />
            </div>
          )
        }
      </div>
    </div>
  );
}

// ── About ─────────────────────────────────────────────────────────────────────
const AboutContent = () => (
  <div className="space-y-6">
    <div className="content-card">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
        <div className="flex-shrink-0 flex flex-col items-center gap-3">
          <div className="w-36 h-36 rounded-2xl overflow-hidden bg-slate-900 border border-slate-700/50 flex items-center justify-center">
            <img src="./images/nova_logo.png" alt="Nova Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-xs text-slate-500 font-medium tracking-wider uppercase">Developed by</span>
        </div>
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-2xl font-bold text-white mb-1">Nova</h2>
          <p className="text-teal-400 text-sm font-medium mb-4">Technology & Innovation Company</p>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            RoadSense is a smart road distress detection platform powered by YOLOv8 and DeepSORT,
            built to help local government units monitor and maintain safer roads across the Philippines.
          </p>
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            {['YOLOv8', 'DeepSORT', 'PostGIS', 'React', 'Computer Vision'].map(tag => (
              <span key={tag} className="px-3 py-1 bg-teal-500/10 border border-teal-500/25 text-teal-300 text-xs rounded-full font-medium">{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
    <div className="content-card">
      <h3 className="text-lg font-semibold text-white mb-4">Want full access?</h3>
      <p className="text-slate-300 text-sm mb-4">If you are a local government unit, you can request an account to manage road data for your jurisdiction.</p>
      <div className="flex gap-3">
        <a href="/login"  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors">Sign In</a>
        <a href="/signup" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-sm font-semibold rounded-lg transition-colors">Request LGU Account</a>
      </div>
    </div>
    <div className="text-center py-4">
      <p className="text-slate-500 text-xs">© 2026 Nova. All rights reserved.</p>
    </div>
  </div>
);

// ── Page registry ─────────────────────────────────────────────────────────────
const pageRegistry = {
  Dashboard: { title: 'Public Overview',       description: 'You are browsing as a guest. Data shown is read-only.',                   component: GuestDashboardContent, isMap: false },
  MapView:   { title: 'Public GIS Hazard Map', description: 'Read-only view of verified road hazards.',                               component: GuestMapContent,       isMap: true  },
  RoadHealth:{ title: 'Road Health',           description: 'Analyze verified hazards along a route or specific road.',               component: RoadHealthContent,     isMap: false },
  Uploads:   { title: 'Crowdsourced Data',     description: 'Public view of video submissions. Contributor identities are anonymized.', component: GuestUploadsContent,   isMap: false },
  Rankings:  { title: 'Contributor Rankings',  description: 'Celebrating contributors who chose public recognition.',                   component: ContributorRankingsContent, isMap: false },
  About:     { title: 'About',                 description: 'Learn more about the team and technology behind RoadSense.',              component: AboutContent,          isMap: false },
};

const navItems = [
  { page: 'Dashboard', icon: <Home className="w-5 h-5" />,     label: 'Dashboard'  },
  { page: 'MapView',   icon: <Map className="w-5 h-5" />,      label: 'Map View'   },
  { page: 'RoadHealth',icon: <HeartPulse className="w-5 h-5" />, label: 'Road Health' },
  { page: 'Uploads',   icon: <Upload className="w-5 h-5" />,   label: 'Uploads'    },
  { page: 'Rankings',  icon: <Trophy className="w-5 h-5" />,   label: 'Rankings'   },
  { page: 'About',     icon: <BookOpen className="w-5 h-5" />, label: 'About Nova' },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ activePage, setActivePage, isCollapsed, setIsCollapsed }) {
  return (
    <aside className={`glass-effect w-full ${isCollapsed ? 'lg:w-24' : 'lg:w-72'} flex-shrink-0 flex flex-col min-h-0 z-10 transition-all duration-300`}>
      <div className="h-20 lg:h-24 flex items-center justify-center border-b border-white/10 relative">
        {!isCollapsed
          ? <div className="flex items-center gap-3">
              <img src="/roadsense.png" alt="RoadSense" className="w-12 h-12 rounded-full object-cover" />
              <div>
                <span className="text-xl font-bold text-white block">RoadSense</span>
                <span className="text-xs text-slate-400 font-medium">Guest View</span>
              </div>
            </div>
          : <img src="/roadsense.png" alt="RoadSense" className="w-12 h-12 rounded-full object-cover" />
        }
        <button onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute right-4 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg transition-colors hover:bg-teal-700 lg:-right-4 lg:flex">
          <svg className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <nav className="flex min-h-0 gap-2 overflow-x-auto p-3 lg:block lg:flex-grow lg:overflow-y-auto lg:p-5 lg:space-y-2">
        {navItems.map(item => (
          <a key={item.page} href="#"
            className={`nav-link flex flex-shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-gray-300 transition-all hover:bg-white/5 ${isCollapsed ? 'lg:justify-center' : 'lg:gap-4'} lg:px-4 lg:py-3 lg:hover:translate-x-1 ${activePage === item.page ? 'active' : ''}`}
            onClick={e => { e.preventDefault(); setActivePage(item.page); }}
            title={isCollapsed ? item.label : ''}>
            <span className={isCollapsed ? 'text-xl' : 'text-lg'}>{item.icon}</span>
            <span className={`text-sm font-medium lg:text-base ${isCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
          </a>
        ))}

        {/* Locked: Reports */}
        <div title="Reports — sign in required"
          className={`hidden items-center ${isCollapsed ? 'lg:justify-center' : 'gap-4'} rounded-lg px-4 py-3 text-gray-600 select-none lg:flex`}>
          <svg className={isCollapsed ? 'w-6 h-6' : 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <span className="text-base font-medium">Reports</span>
              <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          )}
        </div>
      </nav>

      {/* Sign in CTA */}
      <div className="hidden border-t border-white/10 p-5 lg:block">
        {!isCollapsed
          ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center text-slate-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-300 text-base">Guest</p>
                  <p className="text-sm text-gray-500">Read-only access</p>
                </div>
              </div>
              <a href="/login"
                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-teal-600/20 border border-teal-500/40 hover:bg-teal-600/40 text-teal-400 hover:text-teal-300 text-sm font-semibold rounded-lg transition-all">
                <LogIn className="w-4 h-4" /> Sign In
              </a>
            </div>
          )
          : (
            <div className="flex justify-center">
              <a href="/login"
                className="w-12 h-12 rounded-full bg-teal-600/20 border border-teal-500/40 flex items-center justify-center text-teal-400 hover:bg-teal-600/40 transition-colors"
                title="Sign In">
                <LogIn className="w-5 h-5" />
              </a>
            </div>
          )
        }
      </div>
    </aside>
  );
}

// ── Main Content ──────────────────────────────────────────────────────────────
function MainContent({ activePage }) {
  const page = pageRegistry[activePage] || pageRegistry.Dashboard;
  const PageComponent = page.component;
  const isMap = page.isMap;

  return (
    <main className="flex min-w-0 flex-grow flex-col overflow-hidden">
      <div className="flex flex-shrink-0 flex-col gap-4 border-b border-slate-700 bg-slate-800 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">{page.title}</h1>
          <p className="text-gray-400 text-sm mt-1">{page.description}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBox scopes={['jobs', 'detections']} />
          <a href="/login" className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors">
            <LogIn className="w-4 h-4" /> Sign In
          </a>
        </div>
      </div>
      {isMap ? (
        <div className="min-h-0 flex-grow overflow-hidden p-3 sm:p-4">
          <PageComponent />
        </div>
      ) : (
        <div className="flex-grow overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto mt-2 w-full max-w-7xl"><PageComponent /></div>
        </div>
      )}
    </main>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function GuestDashboard() {
  const [activePage,  setActivePage]  = useState('Dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      <style>{guestShapeStyles}</style>
      <div className="relative flex h-screen w-full flex-col overflow-hidden bg-slate-900 text-gray-200 lg:flex-row">
        <div className="shape-1" /><div className="shape-2" />
        <Sidebar activePage={activePage} setActivePage={setActivePage} isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
        <MainContent activePage={activePage} />
      </div>
    </>
  );
}
