/**
 * pages/dashboard.jsx  — Admin Dashboard
 * Fix: MapView now fills the content area without overflowing.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Home, Map, FileText, Upload, User, Users, UserPlus, LogOut, AlertCircle, BookOpen, RefreshCw, Shield, CheckCircle, XCircle, Loader2, Smartphone, PlayCircle, X, Cpu, Server, Activity, Square, ImageIcon, MapPin, Trash2, RotateCcw, HeartPulse, ClipboardCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { LoadingCard, ErrorCard }  from '../components/shared/Cards';
import { JobStatusBadge }          from '../components/shared/Badges';
import { dashboardStyles }         from '../components/shared/dashboardStyles';
import SearchBox                   from '../components/shared/SearchBox';
import UploadVideoButton           from '../components/shared/UploadVideoButton';
import UploadPhotoButton           from '../components/shared/UploadPhotoButton';
import { AuthenticatedImage, DetectionDeleteReview, DetectionFrameModal } from '../components/shared/DetectionImage';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent,
  AlertDialogHeader, AlertDialogFooter, AlertDialogTitle,
  AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '../components/shared/AlertDialog';

import LGURequestCard    from '../components/lgu/LGURequestCard';
import LGURequestModal   from '../components/lgu/LGURequestModal';
import LGUConfirmDialog  from '../components/lgu/LGUConfirmDialog';
import LGUUsersTab       from '../components/lgu/LGUUsersTab';
import { getMobileUsers } from '../api/lgu.api';

import { AdminMapContent } from '../components/map/MapPages';
import ReportsContent from '../components/reports/ReportsContent';
import RoadHealthContent from '../components/road-health/RoadHealthContent';

import { useLGURequests }                            from '../hooks/useLGURequest';
import { useDashboardStats, useDetections, useJobs } from '../hooks/useDashboardData';

import api from '../api';

const PW_RULES = [
  { id: 'len', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'upper', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'number', label: 'One number', test: (v) => /[0-9]/.test(v) },
  { id: 'special', label: 'One special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function validatePassword(password) {
  const failed = PW_RULES.filter((rule) => !rule.test(password));
  return { valid: failed.length === 0, failed };
}

const PAGE_SIZE = 10;

function usePagination(items, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
      <span>
        Showing {start + 1}-{end} of {totalItems}
      </span>
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

function FilterTabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
            active === tab.id
              ? 'border-teal-400/70 bg-teal-500/15 text-teal-200'
              : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-500 hover:text-slate-200'
          }`}
        >
          {tab.label}
          <span className="ml-1 text-slate-500">({tab.count})</span>
        </button>
      ))}
    </div>
  );
}

function normalizedStatus(status) {
  return (status || 'unverified').toLowerCase();
}

function detectionClassGroup(detection) {
  const name = (detection.class_name || '').toLowerCase().replace(/[_-]/g, ' ');
  const severity = (detection.severity || '').toLowerCase();

  if (name.includes('pothole')) {
    if (severity.includes('major') || severity.includes('high') || severity.includes('severe')) return 'pothole_major';
    return 'pothole_minor';
  }
  if (name.includes('crack')) return 'crack';
  if (name.includes('patch')) return 'road_patch';
  return 'other';
}

function BlobVideoLink({ job, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (job.video_url) {
    const isPhoto = job.media_type === 'photo';
    return (
      <>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300"
        >
          {isPhoto ? <ImageIcon className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />} Preview
        </button>

        {previewOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 px-6 py-8">
            <div className="w-full max-w-5xl overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-white">{job.video_filename || `${isPhoto ? 'Photo' : 'Video'} preview`}</h3>
                  <p className="truncate text-xs text-slate-500">{job.job_id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
                  aria-label={`Close ${isPhoto ? 'photo' : 'video'} preview`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="bg-black">
                {isPhoto
                  ? <img src={job.video_url} alt={job.video_filename || 'Road upload'} className="h-[70vh] w-full bg-black object-contain" />
                  : (
                    <video
                      src={job.video_url}
                      controls
                      playsInline
                      preload="metadata"
                      className="h-[70vh] w-full bg-black object-contain"
                    />
                  )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const pickDashcamVideo = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/quicktime,video/x-msvideo,.mp4,.mov,.avi';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        await api.uploadDashcamVideo(job.job_id, file);
        onUploaded?.();
      } catch (e) {
        if (api.isPayloadTooLargeError?.(e)) {
          alert(`Payload Too Large\n\n${e.message}`);
        } else {
          alert(e.message || 'Failed to upload dashcam video.');
        }
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  if (job.awaiting_video) {
    return (
      <button
        type="button"
        onClick={pickDashcamVideo}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 rounded-md border border-orange-500/40 bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-300 hover:bg-orange-500/20 disabled:opacity-60"
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        {uploading ? 'Uploading...' : 'Upload dashcam video'}
      </button>
    );
  }

  return (
    <span className="text-xs text-slate-500">
      No blob video
    </span>
  );
}

function UploadSourceBadge({ job }) {
  const isDashcam = job.source === 'dashcam';
  const isPhoto = job.source === 'photo';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
      isPhoto ? 'bg-cyan-500/10 text-cyan-300' : (isDashcam ? 'bg-orange-500/10 text-orange-300' : 'bg-teal-500/10 text-teal-300')
    }`}>
      {job.source_label || (isPhoto ? 'Mobile photo' : (isDashcam ? 'Dashcam session' : 'Mobile upload'))}
    </span>
  );
}

function JobProcessingStatus({ job, onProcessed }) {
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const canStart = job.status === 'pending' && job.has_blob_video && !job.awaiting_video;
  const canRetry = job.status === 'failed' && job.has_blob_video && !job.awaiting_video;
  const canStop = job.status === 'processing';
  const actionLabel = canRetry ? 'Retry' : 'Start processing';
  const workingLabel = canRetry ? 'Retrying...' : 'Starting...';

  const startProcessing = async () => {
    setStarting(true);
    try {
      await api.processJob(job.job_id);
      onProcessed?.();
    } catch (e) {
      alert(e.message || 'Failed to start GPU processing.');
    } finally {
      setStarting(false);
    }
  };

  const stopProcessing = async () => {
    setStopping(true);
    try {
      await api.stopJob(job.job_id);
      onProcessed?.();
    } catch (e) {
      alert(e.message || 'Failed to stop GPU processing.');
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <JobStatusBadge status={job.status} job={job} />
      {(canStart || canRetry) && (
        <button
          type="button"
          onClick={startProcessing}
          disabled={starting}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold disabled:opacity-60 ${
            canRetry
              ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
              : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20'
          }`}
        >
          {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {starting ? workingLabel : actionLabel}
        </button>
      )}
      {canStop && (
        <button
          type="button"
          onClick={stopProcessing}
          disabled={stopping}
          className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-60"
        >
          {stopping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
          {stopping ? 'Stopping...' : 'Stop'}
        </button>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardContent() {
  const { stats, loading, error, reload } = useDashboardStats();
  const { detections, loading: dLoading, reload: dReload } = useDetections(5);
  const [selectedFrame, setSelectedFrame] = useState(null);

  const load = useCallback(() => { reload(); dReload(); }, [reload, dReload]);

  if (loading || dLoading) return <LoadingCard />;
  if (error) return <ErrorCard message={`Failed to load stats: ${error}`} onRetry={load} />;

  const severityColor = (s) => ({
    critical: 'bg-red-500/20 text-red-400',
    high:     'bg-orange-500/20 text-orange-400',
    medium:   'bg-yellow-500/20 text-yellow-400',
    low:      'bg-green-500/20 text-green-400',
  }[s] || 'bg-slate-500/20 text-slate-400');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        {[
          { label: 'Total Detections',   value: stats.total_detections    ?? 0, sub: 'All time',      color: 'text-white',       iconBg: 'bg-teal-500/20',    iconColor: 'text-teal-400',    path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Jobs Processing',    value: stats.processing          ?? 0, sub: 'Running now',   color: 'text-yellow-400',  iconBg: 'bg-yellow-500/20',  iconColor: 'text-yellow-400',  path: 'M13 10V3L4 14h7v7l9-11h-7z' },
          { label: 'Minor Potholes',     value: stats.by_class?.pothole_minor ?? 0, sub: 'Hazards found', color: 'text-orange-400', iconBg: 'bg-orange-500/20', iconColor: 'text-orange-400', path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
          { label: 'Major Potholes',     value: stats.by_class?.pothole_major ?? 0, sub: 'Hazards found', color: 'text-red-400', iconBg: 'bg-red-500/20', iconColor: 'text-red-400', path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
          { label: 'Detection Accuracy', value: '94.3%',                        sub: 'YOLOv8 model',  color: 'text-emerald-400', iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400', path: 'M13 10V3L4 14h7v7l9-11h-7z' },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="content-card">
          <h2 className="text-lg font-semibold text-white mb-4">Job Status Breakdown</h2>
          <div className="space-y-4">
            {[
              { label: 'Completed',  count: stats.completed  ?? 0, color: 'bg-green-500'  },
              { label: 'Processing', count: stats.processing ?? 0, color: 'bg-yellow-500' },
              { label: 'Pending',    count: stats.pending    ?? 0, color: 'bg-slate-500'  },
              { label: 'Failed',     count: stats.failed     ?? 0, color: 'bg-red-500'    },
            ].map(item => {
              const pct = Math.round((item.count / (stats.total_jobs || 1)) * 100) || 0;
              return (
                <div key={item.label}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-400">{item.label}</span>
                    <span className="text-sm font-semibold text-white">{item.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="content-card">
          <h2 className="text-lg font-semibold text-white mb-4">System Performance</h2>
          <div className="space-y-4">
            {[
              { label: 'YOLOv8 Inference Time',     value: '23ms/frame', color: 'text-teal-400'    },
              { label: 'DeepSORT Tracking',          value: 'Active',     color: 'text-teal-400'    },
              { label: 'GPU Utilization (RTX 4050)', value: '67%',        color: 'text-purple-400'  },
              { label: 'Azure SQL Server',           value: 'Online',     color: 'text-emerald-400' },
              { label: 'Total Jobs',                 value: stats.total_jobs ?? 0, color: 'text-cyan-400' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-sm text-gray-400">{item.label}</span>
                <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-lg font-semibold text-white">Recent Detections</h2>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-gray-300 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        {detections.length === 0
          ? <p className="text-center text-gray-500 py-6">No detections yet.</p>
          : (
            <div className="space-y-3">
              {detections.map(d => (
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
                      <div className={`flex h-14 w-20 shrink-0 items-center justify-center rounded-md border border-slate-600 ${severityColor(d.severity)}`}>
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white capitalize">{d.class_name?.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-400">{d.latitude?.toFixed(4)}°N, {d.longitude?.toFixed(4)}°E</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-xs font-medium capitalize px-2 py-1 rounded-full ${severityColor(d.severity)}`}>{d.severity}</span>
                    <p className="text-xs text-gray-500 mt-1">{new Date(d.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
      <DetectionFrameModal detection={selectedFrame} onClose={() => setSelectedFrame(null)} />
    </div>
  );
}

// ── Uploads ───────────────────────────────────────────────────────────────────
function UploadsContent({ user }) {
  const { jobs, loading, error, reload: loadJobs } = useJobs(200);
  const { stats, reload: loadStats } = useDashboardStats();
  const [processingAll, setProcessingAll] = useState(false);
  const [stoppingAll, setStoppingAll] = useState(false);
  const load = useCallback(() => { loadJobs(); loadStats(); }, [loadJobs, loadStats]);
  const [deletingJobId, setDeletingJobId] = useState(null);
  const [uploadType, setUploadType] = useState('video');
  const visibleJobs = jobs.filter(job => uploadType === 'photo'
    ? job.media_type === 'photo'
    : job.media_type !== 'photo');

const deleteJob = async (job) => {
  if (!window.confirm(`Delete "${job.video_filename || 'this upload'}"? This removes the job, detections, reports, and stored files.`)) return;
  setDeletingJobId(job.job_id);
  try {
    await api.deleteJob(job.job_id);
    load();
  } catch (e) {
    alert(e.message || 'Failed to delete job.');
  } finally {
    setDeletingJobId(null);
  }
};
  const readyJobs = visibleJobs.filter(job => job.status === 'pending' && job.has_blob_video && !job.awaiting_video);
  const processingJobs = visibleJobs.filter(job => job.status === 'processing');
  const {
    page: uploadsPage,
    totalPages: uploadsTotalPages,
    pageItems: pagedJobs,
    start: uploadsStart,
    setPage: setUploadsPage,
  } = usePagination(visibleJobs);

  if (loading) return <LoadingCard />;
  if (error)   return <ErrorCard message={`Failed to load jobs: ${error}`} onRetry={load} />;

  const processAllReady = async () => {
    if (readyJobs.length === 0) return;

    setProcessingAll(true);
    const failures = [];
    try {
      for (const job of readyJobs) {
        try {
          await api.processJob(job.job_id);
        } catch (e) {
          failures.push({ job, message: e.message || 'Failed to start GPU processing.' });
        }
      }
      load();
      if (failures.length) {
        alert(`Started ${readyJobs.length - failures.length} job(s). ${failures.length} failed to start.`);
      }
    } finally {
      setProcessingAll(false);
    }
  };

  const stopAllProcessing = async () => {
    if (processingJobs.length === 0) return;
    if (!window.confirm(`Stop ${processingJobs.length} processing job(s)? They will return to Retry.`)) return;

    setStoppingAll(true);
    try {
      await api.stopAllProcessingJobs();
      load();
    } catch (e) {
      alert(e.message || 'Failed to stop processing jobs.');
    } finally {
      setStoppingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Videos',     value: stats?.total_jobs  ?? 0, color: 'text-teal-400',    sub: 'All uploads'      },
          { label: 'Processing Queue', value: stats?.processing  ?? 0, color: 'text-yellow-400',  sub: 'Pending analysis' },
          { label: 'Completed',        value: stats?.completed   ?? 0, color: 'text-emerald-400', sub: 'Fully processed'  },
          { label: 'Failed',           value: stats?.failed      ?? 0, color: 'text-red-400',     sub: 'Needs attention'  },
        ].map(item => (
          <div key={item.label} className="content-card">
            <h3 className="text-sm font-medium text-gray-400">{item.label}</h3>
            <p className={`text-3xl font-bold mt-2 ${item.color}`}>{item.value}</p>
            <p className="text-xs text-gray-500 mt-1">{item.sub}</p>
          </div>
        ))}
      </div>
      <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900/70 p-1">
        {[
          { value: 'video', label: `Videos (${jobs.filter(job => job.media_type !== 'photo').length})` },
          { value: 'photo', label: `Photos (${jobs.filter(job => job.media_type === 'photo').length})` },
        ].map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => setUploadType(option.value)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              uploadType === option.value ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="content-card">
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-lg font-semibold text-white">{uploadType === 'photo' ? 'Photo Submissions' : 'Video Submissions'}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {uploadType === 'photo'
              ? <UploadPhotoButton userId={user?.user_id} onUploaded={load} />
              : <UploadVideoButton userId={user?.user_id} onUploaded={load} />}
            <button
              onClick={stopAllProcessing}
              disabled={stoppingAll || processingJobs.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {stoppingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
              {stoppingAll ? 'Stopping...' : `Stop all${processingJobs.length ? ` (${processingJobs.length})` : ''}`}
            </button>
            <button
              onClick={processAllReady}
              disabled={processingAll || readyJobs.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-300 transition-colors hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
              {processingAll ? 'Processing all...' : `Process all${readyJobs.length ? ` (${readyJobs.length})` : ''}`}
            </button>
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-gray-300 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
        {visibleJobs.length === 0
          ? <p className="text-center text-gray-500 py-8">No {uploadType} uploads yet.</p>
          : (
            <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-slate-700/60">
            <table className="custom-table min-w-[1040px]">
              <thead><tr><th>Timestamp</th><th>Source</th><th>Filename</th><th>City</th><th>Blob Video</th><th>Job ID</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {pagedJobs.map(job => (
                  <tr key={job.job_id}>
                    <td>{new Date(job.created_at).toLocaleString()}</td>
                    <td><UploadSourceBadge job={job} /></td>
                    <td className="max-w-xs truncate">{job.video_filename || '—'}</td>
                    <td>
                      <p className="text-sm text-slate-200">{job.city || 'GPS pending'}</p>
                      {job.region && <p className="text-xs text-slate-500">{job.region}</p>}
                    </td>
                    <td><BlobVideoLink job={job} onUploaded={load} /></td>
                    <td className="font-mono text-xs text-gray-500">{job.job_id.slice(0, 8)}…</td>
                    <td><JobProcessingStatus job={job} onProcessed={load} /></td>
                    <td>
  <button
    onClick={() => deleteJob(job)}
    disabled={deletingJobId === job.job_id}
    className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
  >
    {deletingJobId === job.job_id
      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
      : <X className="w-3.5 h-3.5" />}
    {deletingJobId === job.job_id ? 'Deleting…' : 'Delete'}
  </button>
</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <PaginationControls
              page={uploadsPage}
              totalPages={uploadsTotalPages}
              totalItems={visibleJobs.length}
              start={uploadsStart}
              onPageChange={setUploadsPage}
            />
            </div>
          )
        }
      </div>
    </div>
  );
}

// ── Detections ────────────────────────────────────────────────────────────────
function ContributorsContent() {
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mediaType, setMediaType] = useState('video');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await api.getContributors();
      setContributions(data.contributions || []);
    } catch (e) {
      setError(e.message || 'Failed to load contributors.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  if (loading) return <LoadingCard />;
  if (error) return <ErrorCard message={error} onRetry={load} />;

  const visibleContributions = contributions.filter(item =>
    mediaType === 'photo' ? item.media_type === 'photo' : item.media_type !== 'photo'
  );

  return (
    <div className="content-card">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div><h2 className="text-lg font-semibold text-white">Contributor submissions</h2><p className="mt-1 text-sm text-slate-400">Names honor the visibility choice made for each upload.</p></div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-slate-600"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>
      <div className="mb-4 inline-flex rounded-lg border border-slate-700 bg-slate-900/70 p-1">
        {[
          { value: 'video', label: `Videos (${contributions.filter(item => item.media_type !== 'photo').length})` },
          { value: 'photo', label: `Photos (${contributions.filter(item => item.media_type === 'photo').length})` },
        ].map(option => (
          <button key={option.value} type="button" onClick={() => setMediaType(option.value)} className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${mediaType === option.value ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {option.label}
          </button>
        ))}
      </div>
      {visibleContributions.length === 0 ? <p className="py-8 text-center text-gray-500">No {mediaType} contributions yet.</p> : (
        <div className="overflow-x-auto rounded-lg border border-slate-700/60"><table className="custom-table min-w-[800px]">
          <thead><tr><th>Timestamp</th><th>Contributor</th><th>Visibility</th><th>Submission</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>{visibleContributions.map(item => <tr key={item.job_id}>
            <td>{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</td>
            <td className={item.is_anonymous ? 'italic text-slate-400' : 'font-medium text-white'}>{item.contributor_name}</td>
            <td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.is_anonymous ? 'bg-slate-700 text-slate-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{item.is_anonymous ? 'Anonymous' : 'Named'}</span></td>
            <td className="max-w-xs truncate">{item.filename || '—'}</td><td className="capitalize text-slate-300">{item.media_type}</td><td><JobStatusBadge status={item.status} /></td>
          </tr>)}</tbody>
        </table></div>
      )}
    </div>
  );
}

function StatusPill({ online }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
      online ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
    }`}>
      <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-400'}`} />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded bg-slate-700/70 ${className}`} />;
}

function GPUServerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-5 w-36" />
          <SkeletonBlock className="h-3 w-52 bg-slate-800" />
        </div>
        <SkeletonBlock className="h-8 w-24" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map(item => (
          <div key={item} className="content-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <SkeletonBlock className="h-10 w-10" />
                <div className="flex-1 space-y-3">
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonBlock className="h-3 w-40 bg-slate-800" />
                  <SkeletonBlock className="h-3 w-full bg-slate-800" />
                </div>
              </div>
              <SkeletonBlock className="h-6 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[0, 1, 2, 3].map(item => (
          <div key={item} className="content-card space-y-3">
            <SkeletonBlock className="h-3 w-24 bg-slate-800" />
            <SkeletonBlock className="h-8 w-20" />
            <SkeletonBlock className="h-3 w-32 bg-slate-800" />
          </div>
        ))}
      </div>

      <div className="content-card space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-5 w-44" />
          <SkeletonBlock className="h-3 w-32 bg-slate-800" />
        </div>
        {[0, 1, 2, 3].map(row => (
          <div key={row} className="grid grid-cols-6 gap-4 border-t border-slate-700/50 pt-3">
            <SkeletonBlock className="h-4 w-full bg-slate-800" />
            <SkeletonBlock className="h-4 w-full bg-slate-800" />
            <SkeletonBlock className="h-4 w-20 bg-slate-800" />
            <SkeletonBlock className="h-4 w-16 bg-slate-800" />
            <SkeletonBlock className="h-6 w-24 rounded-full" />
            <SkeletonBlock className="h-4 w-16 bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ServerHealthContent() {
  const { jobs, loading: jobsLoading, error: jobsError, reload: reloadJobs } = useJobs(100);
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(null);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      setHealth(await api.getSystemHealth());
    } catch (e) {
      setHealthError(e.message || 'Failed to load system health.');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  const load = useCallback(() => {
    loadHealth();
    reloadJobs();
  }, [loadHealth, reloadJobs]);

  const processingJobs = jobs.filter(job => job.status === 'processing');
  const queuedJobs = jobs.filter(job => job.status === 'pending');
  const failedJobs = jobs.filter(job => job.status === 'failed');
  const recentJobs = jobs.filter(job => ['processing', 'pending', 'failed'].includes(job.status)).slice(0, 12);

  const gpu = health?.gpu_worker;
  const gpuData = gpu?.data || {};
  const services = [
    {
      label: 'Dashboard',
      description: 'Admin frontend runtime',
      online: health ? health.dashboard?.online : !healthError,
      icon: <Activity className="h-5 w-5" />,
      detail: window.location.origin,
    },
    {
      label: 'Backend Server',
      description: health?.backend?.service || 'RoadSense API',
      online: Boolean(health?.backend?.online),
      icon: <Server className="h-5 w-5" />,
      detail: health?.backend?.database || 'Waiting for backend health',
    },
    {
      label: 'GPU Worker',
      description: gpu?.online ? (gpuData.gpu_name || gpuData.gpu || 'Video processing worker') : 'Server is down',
      online: Boolean(gpu?.online),
      icon: <Cpu className="h-5 w-5" />,
      detail: gpu?.online ? (gpu?.url || 'GPU worker URL unavailable') : 'Video processing is unavailable until the GPU worker is online.',
    },
  ];

  if (healthLoading && jobsLoading) return <GPUServerSkeleton />;

  return (
    <div className="space-y-6">
      {(healthError || jobsError) && (
        <ErrorCard message={healthError ? 'Backend server is down or unreachable.' : jobsError} onRetry={load} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Server Status</h2>
          <p className="mt-1 text-xs text-slate-400">
            Last checked {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'just now'}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-gray-300 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {services.map(service => (
          <div key={service.label} className="content-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-300">
                  {service.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white">{service.label}</h3>
                  <p className="mt-1 text-xs text-slate-400">{service.description}</p>
                  <p className="mt-2 truncate text-[11px] text-slate-500">{service.detail}</p>
                </div>
              </div>
              <StatusPill online={service.online} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Processing Now', value: processingJobs.length, color: 'text-yellow-400', sub: 'GPU active jobs' },
          { label: 'Queued', value: queuedJobs.length, color: 'text-slate-300', sub: 'Waiting to start' },
          { label: 'Failed', value: failedJobs.length, color: 'text-red-400', sub: 'Needs review' },
          {
            label: 'CUDA',
            value: gpu?.online ? (gpuData.cuda_available ? 'Ready' : 'Unavailable') : 'Down',
            color: gpu?.online && gpuData.cuda_available ? 'text-emerald-400' : 'text-red-400',
            sub: gpu?.online ? (gpuData.gpu_name || 'GPU status') : 'GPU worker server is down',
          },
        ].map(item => (
          <div key={item.label} className="content-card">
            <h3 className="text-sm font-medium text-gray-400">{item.label}</h3>
            <p className={`text-3xl font-bold mt-2 ${item.color}`}>{item.value}</p>
            <p className="text-xs text-gray-500 mt-1">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="content-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Processing Queue Snapshot</h2>
          <span className="text-xs text-slate-500">{recentJobs.length} active or attention-needed jobs</span>
        </div>

        {jobsLoading ? (
          <div className="space-y-3 py-4">
            {[0, 1, 2, 3].map(row => (
              <div key={row} className="grid grid-cols-6 gap-4 border-t border-slate-700/50 pt-3">
                <SkeletonBlock className="h-4 w-full bg-slate-800" />
                <SkeletonBlock className="h-4 w-full bg-slate-800" />
                <SkeletonBlock className="h-4 w-20 bg-slate-800" />
                <SkeletonBlock className="h-4 w-16 bg-slate-800" />
                <SkeletonBlock className="h-6 w-24 rounded-full" />
                <SkeletonBlock className="h-4 w-16 bg-slate-800" />
              </div>
            ))}
          </div>
        ) : recentJobs.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No videos are processing or waiting right now.</p>
        ) : (
          <table className="custom-table">
            <thead><tr><th>Timestamp</th><th>Filename</th><th>Source</th><th>Job ID</th><th>Status</th><th>Video</th></tr></thead>
            <tbody>
              {recentJobs.map(job => (
                <tr key={job.job_id}>
                  <td>{new Date(job.created_at).toLocaleString()}</td>
                  <td className="max-w-xs truncate">{job.video_filename || '-'}</td>
                  <td><UploadSourceBadge job={job} /></td>
                  <td className="font-mono text-xs text-gray-500">{job.job_id.slice(0, 8)}...</td>
                  <td><JobProcessingStatus job={job} onProcessed={load} /></td>
                  <td><BlobVideoLink job={job} onUploaded={load} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LivePreview({ jobId }) {
  const [version, setVersion] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setVersion(Date.now()), 2000);
    return () => clearInterval(timer);
  }, [jobId]);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-black">
      <img
        src={`${api.getGpuPreviewUrl(jobId)}?t=${version}`}
        alt="Live GPU processing preview"
        className="aspect-video w-full object-contain"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
        onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
      />
      <div className="border-t border-slate-800 px-3 py-2 text-xs text-slate-500">
        Live annotated frame refreshes while the GPU worker processes this video.
      </div>
    </div>
  );
}

function GPUProcessingContent() {
  const { jobs, loading, error, reload } = useJobs(100);
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(null);
  const [autoProcess, setAutoProcess] = useState(() => localStorage.getItem('roadsense_auto_process') === 'true');
  const [autoStarting, setAutoStarting] = useState(false);
  const [stoppingAll, setStoppingAll] = useState(false);
  const processingJobs = jobs.filter(job => job.status === 'processing');
  const queuedJobs = jobs.filter(job => job.status === 'pending');
  const failedJobs = jobs.filter(job => job.status === 'failed');
  const readyJobs = queuedJobs.filter(job => job.has_blob_video && !job.awaiting_video);
  const activeJob = processingJobs[0] || null;
  const gpuOnline = Boolean(health?.gpu_worker?.online);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      setHealth(await api.getSystemHealth());
    } catch (e) {
      setHealthError(e.message || 'GPU worker health unavailable.');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const loadAll = useCallback(() => {
    loadHealth();
    reload();
  }, [loadHealth, reload]);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  const processReadyJobs = useCallback(async () => {
    if (!gpuOnline || readyJobs.length === 0 || autoStarting) return;

    setAutoStarting(true);
    try {
      for (const job of readyJobs) {
        try {
          await api.processJob(job.job_id);
        } catch (e) {
          console.warn(`Auto processing failed for ${job.job_id}:`, e.message);
        }
      }
      reload();
    } finally {
      setAutoStarting(false);
    }
  }, [autoStarting, gpuOnline, readyJobs, reload]);

  useEffect(() => {
    localStorage.setItem('roadsense_auto_process', autoProcess ? 'true' : 'false');
    if (!autoProcess) return undefined;

    processReadyJobs();
    const timer = setInterval(() => {
      loadAll();
      processReadyJobs();
    }, 5000);
    return () => clearInterval(timer);
  }, [autoProcess, loadAll, processReadyJobs]);

  const stopAllProcessing = async () => {
    if (processingJobs.length === 0) return;
    if (!window.confirm(`Stop ${processingJobs.length} processing job(s)? They will return to Retry.`)) return;

    setStoppingAll(true);
    try {
      setAutoProcess(false);
      await api.stopAllProcessingJobs();
      loadAll();
    } catch (e) {
      alert(e.message || 'Failed to stop processing jobs.');
    } finally {
      setStoppingAll(false);
    }
  };

  if (loading && healthLoading) return <GPUServerSkeleton />;
  if (error) return <ErrorCard message={`Failed to load GPU processing jobs: ${error}`} onRetry={loadAll} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">GPU Processing Preview</h2>
          <p className="mt-1 text-xs text-slate-400">Shows the latest detection frame with bounding boxes from the GPU worker.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={stopAllProcessing}
            disabled={stoppingAll || processingJobs.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {stoppingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
            {stoppingAll ? 'Stopping...' : `Stop all${processingJobs.length ? ` (${processingJobs.length})` : ''}`}
          </button>
          {autoProcess ? (
            <button
              onClick={() => setAutoProcess(false)}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20"
            >
              <Square className="w-3.5 h-3.5" /> Stop auto
            </button>
          ) : (
            <button
              onClick={() => setAutoProcess(true)}
              disabled={!gpuOnline}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlayCircle className="w-3.5 h-3.5" /> Auto process
            </button>
          )}
          <button onClick={loadAll} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-gray-300 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${(loading || healthLoading) ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {healthError && (
        <ErrorCard message={`Failed to check GPU worker health: ${healthError}`} onRetry={loadAll} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Processing Now', value: processingJobs.length, color: 'text-yellow-400', sub: 'Currently on GPU' },
          { label: 'Queued', value: queuedJobs.length, color: 'text-slate-300', sub: 'Waiting for GPU' },
          { label: 'Failed', value: failedJobs.length, color: 'text-red-400', sub: 'Needs review' },
          { label: 'Auto Process', value: autoProcess ? 'On' : 'Off', color: autoProcess ? 'text-emerald-400' : 'text-slate-400', sub: autoStarting ? 'Starting ready jobs' : `${readyJobs.length} ready` },
        ].map(item => (
          <div key={item.label} className="content-card">
            <h3 className="text-sm font-medium text-gray-400">{item.label}</h3>
            <p className={`text-3xl font-bold mt-2 ${item.color}`}>{item.value}</p>
            <p className="text-xs text-gray-500 mt-1">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)] gap-6">
        <div className="content-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Live Detection View</h2>
            {activeJob && <JobStatusBadge status={activeJob.status} job={activeJob} />}
          </div>
          {!gpuOnline ? (
            <div className="flex aspect-video items-center justify-center rounded-lg border border-red-500/30 bg-slate-950 text-center">
              <div>
                <Cpu className="mx-auto mb-3 h-10 w-10 text-red-400" />
                <p className="text-sm font-semibold text-red-300">GPU server is down.</p>
                <p className="mt-1 text-xs text-slate-500">Cannot process any video at the moment.</p>
              </div>
            </div>
          ) : activeJob ? (
            <LivePreview jobId={activeJob.job_id} />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-center">
              <div>
                <Cpu className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                <p className="text-sm font-semibold text-slate-300">No video is being processed right now.</p>
                <p className="mt-1 text-xs text-slate-500">Auto process can start ready uploads when they arrive.</p>
              </div>
            </div>
          )}
        </div>

        <div className="content-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">GPU Jobs</h2>
            <span className="text-xs text-slate-500">{processingJobs.length + queuedJobs.length + failedJobs.length} visible</span>
          </div>
          <div className="space-y-3">
            {[...processingJobs, ...queuedJobs, ...failedJobs].slice(0, 10).map(job => (
              <div key={job.job_id} className="rounded-lg border border-slate-700/70 bg-slate-800/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{job.video_filename || 'Untitled video'}</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">{job.job_id}</p>
                  </div>
                  <JobProcessingStatus job={job} onProcessed={reload} />
                </div>
              </div>
            ))}
            {processingJobs.length + queuedJobs.length + failedJobs.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">No GPU jobs need attention.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetectionsContent({
  onOpenOnMap,
  targetDetectionId = null,
  initialStatusFilter = 'all',
  lockStatusFilter = false,
  readOnly = false,
  heading = 'All Detections',
}) {
  const { detections, loading, error, reload } = useDetections(500);
  const [statusUpdating, setStatusUpdating] = useState({});
  const [statusError, setStatusError] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [classFilter, setClassFilter] = useState('all');
  const [deletingDetectionId, setDeletingDetectionId] = useState(null);
  const [deletedDetectionIds, setDeletedDetectionIds] = useState(() => new Set());
  const [updatedDetectionStatuses, setUpdatedDetectionStatuses] = useState({});
  const [selectedDetectionIds, setSelectedDetectionIds] = useState(() => new Set());
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [highlightedDetectionId, setHighlightedDetectionId] = useState(null);
  const allDetections = useMemo(
    () => (detections || [])
      .filter(d => !deletedDetectionIds.has(d.detection_id))
      .map(d => updatedDetectionStatuses[d.detection_id]
        ? { ...d, status: updatedDetectionStatuses[d.detection_id] }
        : d),
    [detections, deletedDetectionIds, updatedDetectionStatuses],
  );
  const statusFilteredDetections = statusFilter === 'all'
    ? allDetections
    : allDetections.filter(d => normalizedStatus(d.status) === statusFilter);
  const filteredDetections = classFilter === 'all'
    ? statusFilteredDetections
    : statusFilteredDetections.filter(d => detectionClassGroup(d) === classFilter);
  const {
    page: detectionsPage,
    totalPages: detectionsTotalPages,
    pageItems: pagedDetections,
    start: detectionsStart,
    setPage: setDetectionsPage,
  } = usePagination(filteredDetections);
  const statusTabs = [
    { id: 'all', label: 'All', count: allDetections.length },
    { id: 'verified', label: 'Verified', count: allDetections.filter(d => normalizedStatus(d.status) === 'verified').length },
    { id: 'unverified', label: 'Unverified', count: allDetections.filter(d => normalizedStatus(d.status) === 'unverified').length },
    { id: 'false_positive', label: 'False Positive', count: allDetections.filter(d => normalizedStatus(d.status) === 'false_positive').length },
  ];
  const classTabs = [
    { id: 'all', label: 'All hazards', count: statusFilteredDetections.length },
    { id: 'pothole_minor', label: 'Pothole Minor', count: statusFilteredDetections.filter(d => detectionClassGroup(d) === 'pothole_minor').length },
    { id: 'pothole_major', label: 'Pothole Major', count: statusFilteredDetections.filter(d => detectionClassGroup(d) === 'pothole_major').length },
    { id: 'crack', label: 'Cracks', count: statusFilteredDetections.filter(d => detectionClassGroup(d) === 'crack').length },
    { id: 'road_patch', label: 'Road Patching', count: statusFilteredDetections.filter(d => detectionClassGroup(d) === 'road_patch').length },
    { id: 'other', label: 'Others', count: statusFilteredDetections.filter(d => detectionClassGroup(d) === 'other').length },
  ];
  const pageDetectionIds = pagedDetections.map(d => d.detection_id);
  const selectedCount = selectedDetectionIds.size;
  const allPageSelected = pageDetectionIds.length > 0 && pageDetectionIds.every(id => selectedDetectionIds.has(id));
  const selectedDetections = allDetections.filter(d => selectedDetectionIds.has(d.detection_id));

  useEffect(() => {
    if (!targetDetectionId || !allDetections.length) return undefined;
    const index = allDetections.findIndex(d => d.detection_id === targetDetectionId);
    if (index < 0) return undefined;

    setStatusFilter('all');
    setClassFilter('all');
    setDetectionsPage(Math.floor(index / PAGE_SIZE) + 1);
    setHighlightedDetectionId(targetDetectionId);

    const scrollTimer = window.setTimeout(() => {
      document.querySelector(`[data-detection-row="${targetDetectionId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    const clearTimer = window.setTimeout(() => setHighlightedDetectionId(null), 3200);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [targetDetectionId, allDetections, setDetectionsPage]);

  useEffect(() => {
    setSelectedDetectionIds(prev => {
      const validIds = new Set(allDetections.map(d => d.detection_id));
      const next = new Set([...prev].filter(id => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [allDetections]);

  if (loading) return <LoadingCard />;
  if (error)   return <ErrorCard message={`Failed to load detections: ${error}`} onRetry={reload} />;

  const openLocation = (detection) => {
    if (detection.latitude == null || detection.longitude == null) return;
    const lat = Number(detection.latitude);
    const lng = Number(detection.longitude);
    onOpenOnMap?.({
      ...detection,
      latitude: lat,
      longitude: lng,
    });
  };

  const updateStatus = async (detectionId, status) => {
    setStatusError('');
    setStatusUpdating(prev => ({ ...prev, [detectionId]: true }));
    try {
      const result = await api.updateDetectionStatus(detectionId, status);
      setUpdatedDetectionStatuses(prev => ({
        ...prev,
        [detectionId]: result.new_status || status,
      }));
    } catch (err) {
      setStatusError(err.message || 'Failed to update detection status.');
    } finally {
      setStatusUpdating(prev => ({ ...prev, [detectionId]: false }));
    }
  };

  const toggleDetectionSelection = (detectionId) => {
    setSelectedDetectionIds(prev => {
      const next = new Set(prev);
      if (next.has(detectionId)) next.delete(detectionId);
      else next.add(detectionId);
      return next;
    });
  };

  const togglePageSelection = () => {
    setSelectedDetectionIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) pageDetectionIds.forEach(id => next.delete(id));
      else pageDetectionIds.forEach(id => next.add(id));
      return next;
    });
  };

  const requestDeleteDetections = (items) => {
    if (!items.length) return;
    setDeleteDialog({ detections: items });
  };

  const confirmDeleteDetections = async () => {
    const items = deleteDialog?.detections || [];
    const detectionIds = items.map(item => item.detection_id);
    if (!detectionIds.length) return;

    setStatusError('');
    setDeletingDetectionId(detectionIds.length === 1 ? detectionIds[0] : 'bulk');
    try {
      if (detectionIds.length === 1) await api.deleteDetection(detectionIds[0]);
      else await api.bulkDetectionAction(detectionIds, 'delete');

      setDeletedDetectionIds(prev => new Set([...prev, ...detectionIds]));
      setSelectedDetectionIds(prev => {
        const next = new Set(prev);
        detectionIds.forEach(id => next.delete(id));
        return next;
      });
      setDeleteDialog(null);
    } catch (err) {
      setStatusError(err.message || 'Failed to delete detection.');
    } finally {
      setDeletingDetectionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="content-card">
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-lg font-semibold text-white">{heading} ({filteredDetections.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            {!readOnly && (
              <>
                <button
                  type="button"
                  onClick={togglePageSelection}
                  disabled={!pagedDetections.length}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Square className="h-3.5 w-3.5" /> {allPageSelected ? 'Clear Page' : 'Select Page'}
                </button>
                <button
                  type="button"
                  onClick={() => requestDeleteDetections(selectedDetections)}
                  disabled={!selectedCount || deletingDetectionId === 'bulk'}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {deletingDetectionId === 'bulk' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Delete Selected{selectedCount ? ` (${selectedCount})` : ''}
                </button>
              </>
            )}
            <button onClick={reload} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-gray-300 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
        <div className="mb-5 space-y-3">
          {!lockStatusFilter && (
            <FilterTabs tabs={statusTabs} active={statusFilter} onChange={(id) => { setStatusFilter(id); setDetectionsPage(1); }} />
          )}
          <FilterTabs tabs={classTabs} active={classFilter} onChange={(id) => { setClassFilter(id); setDetectionsPage(1); }} />
        </div>
        {statusError && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {statusError}
          </div>
        )}
        {allDetections.length === 0
          ? <p className="text-center text-gray-500 py-8">No detections yet.</p>
          : filteredDetections.length === 0
          ? <p className="text-center text-gray-500 py-8">No detections match these filters.</p>
          : (
            <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-slate-700/60">
              <table className="custom-table min-w-[1510px]">
                <thead>
                  <tr>
                    {!readOnly && (
                      <th className="w-12">
                        <input
                          type="checkbox"
                          checked={allPageSelected}
                          onChange={togglePageSelection}
                          aria-label="Select all detections on this page"
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-teal-500"
                        />
                      </th>
                    )}
                    <th>Image</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Confidence</th>
                    <th>Location</th>
                    <th>City</th>
                    <th>Verified By</th>
                    <th>Account Type</th>
                    <th>Status</th>
                    <th>Date</th>
                    {!readOnly && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {pagedDetections.map(d => (
                    <tr
                      key={d.detection_id}
                      data-detection-row={d.detection_id}
                      className={`${highlightedDetectionId === d.detection_id ? 'detection-row-highlight' : ''} ${selectedDetectionIds.has(d.detection_id) ? 'bg-teal-500/5' : ''}`}
                    >
                      {!readOnly && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedDetectionIds.has(d.detection_id)}
                            onChange={() => toggleDetectionSelection(d.detection_id)}
                            aria-label={`Select ${d.class_name?.replace(/_/g, ' ') || 'detection'}`}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-teal-500"
                          />
                        </td>
                      )}
                      <td>
                        {d.image_url ? (
                          <button type="button" onClick={() => setSelectedFrame(d)} className="flex h-14 w-24 items-center justify-center overflow-hidden rounded-md border border-slate-700/80 bg-slate-950">
                            <AuthenticatedImage
                              key={d.image_url}
                              src={d.image_url}
                              alt={`${d.class_name || 'Detection'} output`}
                              className="h-14 w-24 object-cover"
                            />
                          </button>
                        ) : (
                          <div className="flex h-14 w-24 items-center justify-center rounded-md border border-slate-700/80 bg-slate-900 text-slate-500">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </td>
                      <td className="capitalize">{d.class_name?.replace(/_/g, ' ')}</td>
                      <td className="capitalize">{d.severity}</td>
                      <td>{(d.confidence * 100).toFixed(1)}%</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => openLocation(d)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-teal-500/25 bg-teal-500/10 px-2.5 py-1.5 font-mono text-xs text-teal-300 transition-colors hover:border-teal-400/60 hover:bg-teal-500/20"
                          title="Open location on RoadSense map"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          {d.latitude?.toFixed(4)}, {d.longitude?.toFixed(4)}
                        </button>
                      </td>
                      <td>{d.city || 'Unknown'}</td>
                      <td>{d.verified_by_name || (normalizedStatus(d.status) === 'verified' ? 'Unknown' : 'Not verified')}</td>
                      <td className="uppercase">{d.verified_by_role || (normalizedStatus(d.status) === 'verified' ? 'Unknown' : '-')}</td>
                      <td>
                        <div className="flex min-w-[180px] flex-col items-start gap-2">
                          <span className="text-sm font-semibold capitalize text-slate-200">{d.status?.replace(/_/g, ' ')}</span>
                          {!readOnly && <div className="grid grid-cols-2 gap-2">
                            {d.status !== 'verified' ? (
                              <button
                                type="button"
                                onClick={() => updateStatus(d.detection_id, 'verified')}
                                disabled={statusUpdating[d.detection_id]}
                                className="inline-flex min-w-20 items-center justify-center gap-1.5 rounded-md border border-teal-500/30 bg-teal-500/10 px-2.5 py-1.5 text-xs font-semibold text-teal-300 transition-colors hover:border-teal-400/60 hover:bg-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {statusUpdating[d.detection_id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                Verify
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => updateStatus(d.detection_id, 'unverified')}
                                disabled={statusUpdating[d.detection_id]}
                                className="inline-flex min-w-20 items-center justify-center gap-1.5 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1.5 text-xs font-semibold text-yellow-300 transition-colors hover:border-yellow-400/60 hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {statusUpdating[d.detection_id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                                Unverify
                              </button>
                            )}
                            {d.status !== 'false_positive' && (
                              <button
                                type="button"
                                onClick={() => updateStatus(d.detection_id, 'false_positive')}
                                disabled={statusUpdating[d.detection_id]}
                                className="inline-flex min-w-20 items-center justify-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {statusUpdating[d.detection_id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                False +
                              </button>
                            )}
                          </div>}
                        </div>
                      </td>
                      <td className="text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                      {!readOnly && <td>
                        <div className="flex min-w-24 flex-col items-start gap-2">
                          <button
                            type="button"
                            onClick={() => updateStatus(d.detection_id, 'unverified')}
                            disabled={statusUpdating[d.detection_id] || d.status === 'unverified'}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-500/40 bg-slate-500/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {statusUpdating[d.detection_id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteDetections([d])}
                            disabled={deletingDetectionId === d.detection_id}
                            className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingDetectionId === d.detection_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            Delete
                          </button>
                        </div>
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={detectionsPage}
              totalPages={detectionsTotalPages}
              totalItems={filteredDetections.length}
              start={detectionsStart}
              onPageChange={setDetectionsPage}
            />
            </div>
          )
        }
      </div>
      <DetectionFrameModal detection={selectedFrame} onClose={() => setSelectedFrame(null)} />
      <AlertDialog open={Boolean(deleteDialog)} onOpenChange={(open) => { if (!open && !deletingDetectionId) setDeleteDialog(null); }}>
        <AlertDialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete detection{(deleteDialog?.detections?.length || 0) > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deleteDialog?.detections?.length || 0} detection{(deleteDialog?.detections?.length || 0) === 1 ? '' : 's'} from the list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <DetectionDeleteReview detections={deleteDialog?.detections || []} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingDetectionId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDeleteDetections();
              }}
              disabled={Boolean(deletingDetectionId)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingDetectionId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <style>{`
        @keyframes detection-row-pulse {
          0%, 100% { background: rgba(20, 184, 166, 0.08); box-shadow: inset 4px 0 0 rgba(45, 212, 191, 0.45); }
          50% { background: rgba(20, 184, 166, 0.28); box-shadow: inset 4px 0 0 rgb(45, 212, 191); }
        }
        .detection-row-highlight { animation: detection-row-pulse 0.75s ease-in-out 4; }
      `}</style>
    </div>
  );
}

// ── LGU Requests ──────────────────────────────────────────────────────────────
function LGURequestsContent({ user }) {
  const { requests, loading, error, actionLoading, counts, load, performAction } =
    useLGURequests(user?.full_name || 'Admin');

  const [activeTab,     setActiveTab]     = useState('requests');
  const [filterStatus,  setFilterStatus]  = useState('all');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [detailRequest, setDetailRequest] = useState(null);
  const [toast,         setToast]         = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = async (id, action) => {
    const result = await performAction(id, action);
    if (result.success) {
      const labels = {
        approve: 'LGU approved ✓ — notification email sent',
        reject:  'LGU rejected — notification email sent',
        revoke:  'Approval revoked — set back to pending',
        reopen:  'Request re-opened — set back to pending',
      };
      showToast(labels[action] || 'Done');
    } else {
      showToast(result.error, 'error');
    }
  };

  const askConfirm = (r, action) =>
    setConfirmDialog({ id: r.id, action, email: r.email, region: r.region, city: r.city, barangay: r.barangay });

  const visible = requests.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q
      || r.email.toLowerCase().includes(q)
      || (r.region || '').toLowerCase().includes(q)
      || r.city.toLowerCase().includes(q)
      || r.barangay.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  if (loading) return <LoadingCard />;
  if (error)   return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold
          ${toast.type === 'error' ? 'bg-red-600/95 text-white' : 'bg-teal-600/95 text-white'}`}>
          {toast.msg}
        </div>
      )}
      <div className="flex rounded-xl bg-slate-800/70 border border-slate-700/50 p-1 gap-1">
        {[
          { id: 'requests', label: 'LGU Requests' },
          { id: 'users',    label: 'LGU Accounts' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all
              ${activeTab === tab.id
                ? 'bg-teal-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'users' ? (
        <LGUUsersTab user={user} />
      ) : (
        <>
          <LGUConfirmDialog
            dialog={confirmDialog}
            onConfirm={(id, action) => { setConfirmDialog(null); handleAction(id, action); }}
            onCancel={() => setConfirmDialog(null)}
          />
          <LGURequestModal
            request={detailRequest}
            onClose={() => setDetailRequest(null)}
            onAction={(r, action) => askConfirm(r, action)}
          />
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Pending',  val: counts.pending,  color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', key: 'pending'  },
              { label: 'Approved', val: counts.approved, color: 'text-teal-400',   bg: 'bg-teal-500/10 border-teal-500/20',     key: 'approved' },
              { label: 'Rejected', val: counts.rejected, color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       key: 'rejected' },
            ].map(s => (
              <button key={s.label}
                onClick={() => setFilterStatus(filterStatus === s.key ? 'all' : s.key)}
                className={`content-card text-center transition-all border-2 ${filterStatus === s.key ? s.bg + ' scale-[1.02]' : 'border-transparent'}`}>
                <p className="text-sm text-gray-400">{s.label}</p>
                <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.val}</p>
                <p className="text-[10px] text-gray-500 mt-1">{filterStatus === s.key ? 'Click to clear' : 'Click to filter'}</p>
              </button>
            ))}
          </div>
          <div className="content-card">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">LGU Account Requests</h2>
                {counts.pending > 0 && (
                  <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full animate-pulse">
                    {counts.pending} pending
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text" placeholder="Search email, region, city…"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 w-56"
                />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <button onClick={load}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-gray-300 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>
            </div>
            {visible.length === 0
              ? <p className="text-center text-gray-500 py-8">
                  {searchQuery || filterStatus !== 'all' ? 'No results match your filter.' : 'No LGU requests yet.'}
                </p>
              : (
                <div className="space-y-3">
                  {visible.map(r => (
                    <LGURequestCard
                      key={r.id}
                      request={r}
                      onAction={(req, action) => askConfirm(req, action)}
                      onViewDetail={setDetailRequest}
                      actionLoading={actionLoading}
                    />
                  ))}
                </div>
              )
            }
          </div>
        </>
      )}
    </div>
  );
}

// ── Profile ───────────────────────────────────────────────────────────────────
function ProfileContent({ user }) {
  const [editing,  setEditing]  = useState(false);
  const [username, setUsername] = useState(user?.full_name || '');
  const [email,    setEmail]    = useState(user?.email || '');
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const handleSave = async () => {
    if (!username.trim()) return;
    setSaving(true);
    try {
      const data = await api.updateProfile(user?.user_id, username.trim(), email.trim());
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, full_name: data.full_name, email: data.email }));
      showToast('Profile updated successfully ✓');
      setEditing(false);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold
          ${toast.type === 'error' ? 'bg-red-600/95 text-white' : 'bg-teal-600/95 text-white'}`}>
          {toast.msg}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="content-card">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-lg font-semibold text-white">Personal Information</h2>
            {!editing
              ? <button onClick={() => setEditing(true)} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg transition-colors">Edit Profile</button>
              : (
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(false); setUsername(user?.full_name || ''); setEmail(user?.email || ''); }}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-sm rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )
            }
          </div>
          <div className="space-y-4">
            {[
              { label: 'Username', val: username, setter: setUsername, type: 'text'  },
              { label: 'Email',    val: email,    setter: setEmail,    type: 'email' },
            ].map(field => (
              <div key={field.label}>
                <label className="text-sm text-gray-400 block mb-1">{field.label}</label>
                {editing
                  ? <input value={field.val} onChange={e => field.setter(e.target.value)} type={field.type}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  : <p className="text-white">{field.val || '—'}</p>
                }
              </div>
            ))}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Account Type</label>
              <p className="text-white">System Administrator</p>
            </div>
          </div>
        </div>
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
          <div className="w-36 h-36 rounded-2xl overflow-hidden bg-slate-900 border border-slate-700/50 flex items-center justify-center shadow-xl">
            <img src="./images/nova_logo.png" alt="Nova Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-xs text-slate-500 font-medium tracking-wider uppercase">Developed by</span>
        </div>
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-2xl font-bold text-white mb-1">Nova</h2>
          <p className="text-teal-400 text-sm font-medium mb-4">Technology & Innovation Company</p>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            Nova is a technology company focused on developing intelligent systems for public safety and infrastructure monitoring.
            RoadSense is our flagship product — a smart road distress detection platform powered by YOLOv8 and DeepSORT.
          </p>
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            {['YOLOv8', 'DeepSORT', 'PostGIS', 'React', 'Computer Vision'].map(tag => (
              <span key={tag} className="px-3 py-1 bg-teal-500/10 border border-teal-500/25 text-teal-300 text-xs rounded-full font-medium">{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
    <div className="text-center py-4">
      <p className="text-slate-500 text-xs">© 2026 Nova. All rights reserved.</p>
    </div>
  </div>
);

// ── Page registry ─────────────────────────────────────────────────────────────
export function AdminAccountsContent() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const pwValidation = validatePassword(form.password);
  const canSubmit =
    form.username.trim() &&
    form.email.trim() &&
    form.password &&
    form.confirmPassword &&
    pwValidation.valid &&
    form.password === form.confirmPassword;

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage(null);
  };

  const createAdmin = async (e) => {
    e.preventDefault();
    if (!pwValidation.valid) {
      setMessage({ type: 'error', text: `Password must include: ${pwValidation.failed.map((rule) => rule.label).join(', ')}.` });
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await api.createAdminAccount({
        full_name: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        role: 'admin',
      });
      setForm({ username: '', email: '', password: '', confirmPassword: '' });
      setMessage({ type: 'success', text: 'Admin account added successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to add admin account.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="content-card">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-teal-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Add Admin Account</h2>
            <p className="text-sm text-gray-400 mt-1">Only signed-in system administrators can add another admin account here.</p>
          </div>
        </div>

        <form onSubmit={createAdmin} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Username</label>
            <input value={form.username} onChange={(e) => update('username', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Admin username" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="admin@example.com" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Password</label>
            <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Enter a password" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Confirm Password</label>
            <input type="password" value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Re-enter password" />
          </div>

          <div className="md:col-span-2 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PW_RULES.map((rule) => {
                const ok = rule.test(form.password);
                return (
                  <div key={rule.id} className={`flex items-center gap-2 text-xs ${ok ? 'text-teal-300' : 'text-gray-500'}`}>
                    <CheckCircle className="w-3.5 h-3.5" />
                    {rule.label}
                  </div>
                );
              })}
            </div>

            {message && (
              <div className={`px-4 py-3 rounded-lg border text-sm ${
                message.type === 'success'
                  ? 'bg-teal-500/10 border-teal-500/25 text-teal-300'
                  : 'bg-red-500/10 border-red-500/25 text-red-300'
              }`}>
                {message.text}
              </div>
            )}

            <button type="submit" disabled={saving || !canSubmit}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Add Admin Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function MobileUsersContent() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMobileUsers();
      setUsers(data.users || []);
    } catch (e) {
      setError(e.message || 'Failed to load mobile users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingCard />;
  if (error) return <ErrorCard message={error} onRetry={load} />;

  const totalUploads = users.reduce((sum, u) => sum + (u.upload_count || 0), 0);
  const activeUsers = users.filter(u => u.last_login).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="content-card">
          <h3 className="text-sm font-medium text-gray-400">Mobile Users</h3>
          <p className="text-3xl font-bold mt-2 text-teal-400">{users.length}</p>
          <p className="text-xs text-gray-500 mt-1">Registered from the mobile app</p>
        </div>
        <div className="content-card">
          <h3 className="text-sm font-medium text-gray-400">Users With Login</h3>
          <p className="text-3xl font-bold mt-2 text-cyan-400">{activeUsers}</p>
          <p className="text-xs text-gray-500 mt-1">Accounts with a recorded last login</p>
        </div>
        <div className="content-card">
          <h3 className="text-sm font-medium text-gray-400">Mobile Uploads</h3>
          <p className="text-3xl font-bold mt-2 text-emerald-400">{totalUploads}</p>
          <p className="text-xs text-gray-500 mt-1">Jobs submitted by mobile users</p>
        </div>
      </div>

      <div className="content-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Mobile User Accounts</h2>
            <p className="text-xs text-gray-400 mt-0.5">Normal user accounts created from the RoadSense mobile app.</p>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-gray-300 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {users.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No mobile users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="custom-table">
              <thead>
                <tr><th>User</th><th>Type</th><th>Uploads</th><th>Registered</th><th>Last Login</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.anonymous_id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold">
                          {u.anonymous_id?.slice(-1) || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{u.anonymous_id || 'Anonymous User'}</p>
                          <p className="text-[10px] text-teal-400 flex items-center gap-1"><Smartphone className="w-3 h-3" /> Mobile User</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-teal-500/10 text-teal-300 text-xs font-semibold">
                        <Smartphone className="w-3 h-3" /> Mobile
                      </span>
                    </td>
                    <td>{u.upload_count ?? 0}</td>
                    <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                    <td>{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const pageRegistry = {
  Dashboard:   { title: 'System Overview',     description: 'RoadSense monitoring dashboard.',                    component: DashboardContent, isMap: false },
  MapView:     { title: 'GIS Hazard Map',      description: 'Geographic distribution of detected road hazards.', component: AdminMapContent,  isMap: true  },
  RoadHealth:  { title: 'Road Health',         description: 'Analyze detections, severity, and status along a route or road.', component: () => <RoadHealthContent canManage />, isMap: false },
  LGURequests: { title: 'LGU Requests',        description: 'Review and approve LGU account requests.',          component: null,             isMap: false },
  MobileUsers: { title: 'Mobile Users', description: 'View user accounts created from the mobile app.', component: MobileUsersContent, isMap: false },
  Contributors: { title: 'Contributors', description: 'View upload attribution while respecting each contributor’s privacy choice.', component: ContributorsContent, isMap: false },
  Reports:     { title: 'Analytics & Reports', description: 'DPWH-compliant reporting and detection analytics.', component: ReportsContent,   isMap: false },
  Uploads:     { title: 'Crowdsourced Data',   description: 'Video submissions and job status.',                  component: UploadsContent,   isMap: false },
  ServerHealth: { title: 'Server Health',       description: 'Monitor dashboard, backend, and GPU worker availability.', component: ServerHealthContent, isMap: false },
  GPUWorker:   { title: 'GPU Server',           description: 'Watch live GPU video processing with detection boxes.', component: GPUProcessingContent, isMap: false },
  Detections:  { title: 'All Detections',      description: 'Full list of detections from the database.',        component: DetectionsContent,isMap: false },
  VerifiedData:{ title: 'Verified Data',       description: 'Verified road hazard detections and reviewer account details.', component: () => <DetectionsContent initialStatusFilter="verified" lockStatusFilter readOnly heading="Verified Detections" />, isMap: false },
  Profile:     { title: 'Profile',             description: 'Manage your account settings.',                      component: null,             isMap: false },
  About:       { title: 'About',               description: 'Learn more about the team behind RoadSense.',       component: AboutContent,     isMap: false },
};

const navItems = [
  { page: 'Dashboard',   icon: <Home className="w-5 h-5" />       },
  { page: 'MapView',     icon: <Map className="w-5 h-5" />,        label: 'Map View'     },
  { page: 'RoadHealth',  icon: <HeartPulse className="w-5 h-5" />, label: 'Road Health'  },
  { page: 'LGURequests', icon: <UserPlus className="w-5 h-5" />,   label: 'LGU Requests' },
  { page: 'SAEDashboard', icon: <Shield className="w-5 h-5" />,   label: 'SAE Dashboard', route: '/sae-dashboard' },
  { page: 'MobileUsers', icon: <Users className="w-5 h-5" />, label: 'Mobile Users' },
  { page: 'Contributors', icon: <Users className="w-5 h-5" />, label: 'Contributors' },
  { page: 'Reports',     icon: <FileText className="w-5 h-5" />    },
  { page: 'Uploads',     icon: <Upload className="w-5 h-5" />      },
  { page: 'ServerHealth', icon: <Server className="w-5 h-5" />,     label: 'Server Health' },
  { page: 'GPUWorker',   icon: <Cpu className="w-5 h-5" />,         label: 'GPU Server' },
  { page: 'Detections',  icon: <AlertCircle className="w-5 h-5" /> },
  { page: 'VerifiedData', icon: <ClipboardCheck className="w-5 h-5" />, label: 'Verified Data' },
];

const accountItems = [
  { page: 'Profile',       icon: <User className="w-5 h-5" />,     label: 'Profile'        },
  { page: 'About',         icon: <BookOpen className="w-5 h-5" />, label: 'About Nova'     },
  { page: 'Logout',        icon: <LogOut className="w-5 h-5" />                             },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ activePage, setActivePage, navigate, isCollapsed, setIsCollapsed, user }) {
  const displayName  = user?.full_name || 'Admin';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <aside className={`glass-effect w-full ${isCollapsed ? 'lg:w-24' : 'lg:w-72'} flex-shrink-0 flex flex-col min-h-0 z-10 transition-all duration-300`}>
      <div className="h-20 lg:h-24 flex flex-shrink-0 items-center justify-center border-b border-white/10 relative">
        {!isCollapsed
          ? <div className="flex items-center gap-3">
              <img src="/roadsense.png" alt="RoadSense" className="w-12 h-12 rounded-full object-cover" />
              <span className="text-2xl font-bold text-white">RoadSense</span>
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
            onClick={e => {
              e.preventDefault();
              if (item.route) navigate(item.route);
              else setActivePage(item.page);
            }}
            title={isCollapsed ? (item.label || item.page) : ''}>
            <span className={isCollapsed ? 'text-xl' : 'text-lg'}>{item.icon}</span>
            <span className={`text-sm font-medium lg:text-base ${isCollapsed ? 'lg:hidden' : ''}`}>{item.label || item.page}</span>
          </a>
        ))}

        <div className="flex flex-shrink-0 gap-2 border-l border-white/10 pl-3 lg:mt-8 lg:block lg:border-l-0 lg:border-t lg:pl-0 lg:pt-8">
          {!isCollapsed && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-4">Account</p>}
          {accountItems.map(item => {
            if (item.page === 'Logout') return (
              <AlertDialog key="Logout">
                <AlertDialogTrigger asChild>
                  <button className={`nav-link flex items-center ${isCollapsed ? 'lg:justify-center' : 'gap-4'} px-4 py-3 rounded-lg text-gray-300 transition-all hover:bg-white/5 cursor-pointer w-full text-left`}>
                    <span className={isCollapsed ? 'text-xl' : 'text-lg'}>{item.icon}</span>
                    {!isCollapsed && <span className="text-base font-medium">Logout</span>}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                    <AlertDialogDescription>Are you sure you want to logout?</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={async () => { try { await api.logoutUser(); } finally { localStorage.removeItem('user'); navigate('/login', { replace: true }); } }}>Logout</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            );

            if (item.page === 'CreateAccount') return (
              <AlertDialog key="CreateAccount">
                <AlertDialogTrigger asChild>
                  <button className={`nav-link flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'} px-4 py-3 rounded-lg text-gray-300 transition-all hover:bg-white/5 cursor-pointer w-full text-left`}>
                    <span className={isCollapsed ? 'text-xl' : 'text-lg'}>{item.icon}</span>
                    {!isCollapsed && <span className="text-base font-medium">{item.label}</span>}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Create New Account?</AlertDialogTitle>
                    <AlertDialogDescription>You will be redirected to the signup page.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => navigate('/signup')}>Continue</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            );

            return (
              <a key={item.page} href="#"
                className={`nav-link flex flex-shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-gray-300 transition-all hover:bg-white/5 ${isCollapsed ? 'lg:justify-center' : 'lg:gap-4'} lg:px-4 lg:py-3 lg:hover:translate-x-1 ${activePage === item.page ? 'active' : ''}`}
                onClick={e => { e.preventDefault(); setActivePage(item.page); }}
                title={isCollapsed ? (item.label || item.page) : ''}>
                <span className={isCollapsed ? 'text-xl' : 'text-lg'}>{item.icon}</span>
                <span className={`text-sm font-medium lg:text-base ${isCollapsed ? 'lg:hidden' : ''}`}>{item.label || item.page}</span>
              </a>
            );
          })}
        </div>
      </nav>

      <div className="hidden flex-shrink-0 border-t border-white/10 p-5 lg:block">
        {!isCollapsed
          ? <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center text-white font-semibold text-lg">{avatarLetter}</div>
              <div>
                <p className="font-semibold text-white text-base">{displayName}</p>
                <p className="text-sm text-teal-400">System Administrator</p>
              </div>
            </div>
          : <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center text-white font-semibold text-lg">{avatarLetter}</div>
            </div>
        }
      </div>
    </aside>
  );
}

// ── Main Content ──────────────────────────────────────────────────────────────
function MainContent({ activePage, user, setActivePage, mapFocus, setMapFocus, detectionFocus, setDetectionFocus }) {
  const page = pageRegistry[activePage] || pageRegistry.Dashboard;
  const PageComponent = page.component;
  const isMap = page.isMap;

  return (
    <main className="flex min-w-0 flex-grow flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 flex-col gap-4 border-b border-slate-700 bg-slate-800 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">{page.title}</h1>
          <p className="text-gray-400 text-sm mt-1">{page.description}</p>
        </div>
        <SearchBox />
      </div>

      {/* Content area — map gets no padding and fills remaining height */}
      {isMap ? (
        <div className="min-h-0 flex-grow overflow-hidden p-3 sm:p-4">
          <PageComponent
            focusDetection={mapFocus}
            onViewDetection={(detection) => {
              setDetectionFocus(detection.detection_id);
              setActivePage('Detections');
            }}
          />
        </div>
      ) : (
        <div className="flex-grow overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto mt-2 w-full max-w-7xl">
            {activePage === 'Profile'     ? <ProfileContent user={user} />     :
             activePage === 'LGURequests' ? <LGURequestsContent user={user} /> :
             activePage === 'Detections'  ? <DetectionsContent user={user} targetDetectionId={detectionFocus} onOpenOnMap={(d) => { setMapFocus(d); setActivePage('MapView'); }} /> :
             PageComponent                ? <PageComponent user={user} />       : null}
          </div>
        </div>
      )}
    </main>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function DashboardLayout() {
  const [activePage,  setActivePage]  = useState('Dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mapFocus,    setMapFocus]    = useState(null);
  const [detectionFocus, setDetectionFocus] = useState(null);
  const navigate = useNavigate();

  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) || {}; }
    catch { return {}; }
  });

  return (
    <>
      <style>{dashboardStyles}</style>
      <div className="relative flex h-screen w-full flex-col overflow-hidden bg-slate-900 text-gray-200 lg:flex-row">
        <div className="shape-1" /><div className="shape-2" />
        <Sidebar activePage={activePage} setActivePage={setActivePage} navigate={navigate} isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} user={user} />
        <MainContent activePage={activePage} user={user} setActivePage={setActivePage} mapFocus={mapFocus} setMapFocus={setMapFocus} detectionFocus={detectionFocus} setDetectionFocus={setDetectionFocus} />
      </div>
    </>
  );
}
