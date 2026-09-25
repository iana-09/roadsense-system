/**
 * pages/lgu-dashboard.jsx  — LGU Dashboard
 * Clean refactor: logic in hooks, UI in components, no raw fetch() here.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Home, Map, Upload, User, BookOpen, LogOut, CheckCircle, XCircle, RefreshCw, PlayCircle, X, Loader2, ImageIcon, MapPin, Trash2, HeartPulse, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Shared components
import { LoadingCard, ErrorCard }    from '../components/shared/Cards';
import { DetectionStatusBadge }      from '../components/shared/Badges';
import { lguShapeStyles }            from '../components/shared/dashboardStyles';
import SearchBox                     from '../components/shared/SearchBox';
import UploadVideoButton             from '../components/shared/UploadVideoButton';
import UploadPhotoButton             from '../components/shared/UploadPhotoButton';
import { AuthenticatedImage, DetectionDeleteReview, DetectionFrameModal } from '../components/shared/DetectionImage';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent,
  AlertDialogHeader, AlertDialogFooter, AlertDialogTitle,
  AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '../components/shared/AlertDialog';

// Map
import { LGUMapContent } from '../components/map/MapPages';
import RoadHealthContent from '../components/road-health/RoadHealthContent';

// Hooks
import { useDashboardStats, useDetections, useJobs } from '../hooks/useDashboardData';

// API
import api from '../api';

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
      <span>Showing {start + 1}-{end} of {totalItems}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
        <span className="min-w-16 text-center text-xs text-slate-400">Page {page} / {totalPages}</span>
        <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
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
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
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
                  aria-label="Close video preview"
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
        {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
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
      isPhoto ? 'bg-violet-500/10 text-violet-300' : (isDashcam ? 'bg-orange-500/10 text-orange-300' : 'bg-cyan-500/10 text-cyan-300')
    }`}>
      {job.source_label || (isPhoto ? 'Mobile photo' : (isDashcam ? 'Dashcam session' : 'Mobile upload'))}
    </span>
  );
}

function JobProcessingStatus({ job, onProcessed }) {
  const [starting, setStarting] = useState(false);
  const canStart = job.status === 'pending' && job.has_blob_video && !job.awaiting_video;
  const canRetry = job.status === 'failed' && job.has_blob_video && !job.awaiting_video;
  const actionLabel = canRetry ? 'Retry' : 'Start processing';
  const workingLabel = canRetry ? 'Retrying...' : 'Starting...';

  const getStatusDisplay = () => {
    if (job.status === 'processing') return { text: 'Processing', color: 'text-yellow-400' };
    if (job.status === 'completed') return { text: 'Processed', color: 'text-green-400' };
    if (job.status === 'failed') return { text: 'Failed', color: 'text-red-400' };
    if (job.awaiting_video) return { text: 'Waiting for video', color: 'text-slate-400' };
    if (job.has_blob_video) return { text: 'Ready to process', color: 'text-slate-400' };
    return { text: 'Pending', color: 'text-slate-400' };
  };

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

  const s = getStatusDisplay();
  return (
    <div className="flex items-center gap-2">
      <span className={s.color}>{s.text}</span>
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
          {starting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {starting ? workingLabel : actionLabel}
        </button>
      )}
    </div>
  );
}

// ── LGU Dashboard ─────────────────────────────────────────────────────────────
function LGUDashboardContent() {
  const { stats, loading, error, reload: reloadStats } = useDashboardStats();
  const { detections, loading: dLoading, reload: reloadDetections } = useDetections(5);
  const [selectedFrame, setSelectedFrame] = useState(null);

  const load = useCallback(() => { reloadStats(); reloadDetections(); }, [reloadStats, reloadDetections]);

  if (loading || dLoading) return <LoadingCard />;
  if (error) return <ErrorCard message={`Failed to load: ${error}`} onRetry={load} />;

  const severityBg = (s) => ({
    critical: 'bg-red-500/20 text-red-400',
    high:     'bg-orange-500/20 text-orange-400',
    medium:   'bg-yellow-500/20 text-yellow-400',
    low:      'bg-green-500/20 text-green-400',
  }[s] || 'bg-slate-500/20 text-slate-400');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        {[
          { label: 'Total Detections', value: stats.total_detections    ?? 0, sub: 'All time',          color: 'text-teal-400',   iconBg: 'bg-teal-500/20',   iconColor: 'text-teal-400',   path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Unverified',       value: stats.total_detections    ?? 0, sub: 'Awaiting review',   color: 'text-yellow-400', iconBg: 'bg-yellow-500/20', iconColor: 'text-yellow-400', path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
          { label: 'Minor Potholes',   value: stats.by_class?.pothole_minor ?? 0, sub: 'Hazards found', color: 'text-orange-400', iconBg: 'bg-orange-500/20', iconColor: 'text-orange-400', path: 'M5 13l4 4L19 7' },
          { label: 'Major Potholes',   value: stats.by_class?.pothole_major ?? 0, sub: 'Hazards found', color: 'text-red-400', iconBg: 'bg-red-500/20', iconColor: 'text-red-400', path: 'M5 13l4 4L19 7' },
          { label: 'Jobs Completed',   value: stats.completed           ?? 0, sub: 'Processed videos',  color: 'text-purple-400', iconBg: 'bg-purple-500/20', iconColor: 'text-purple-400', path: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
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

      <div className="content-card">
        <div className="flex items-center justify-between mb-4">
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
                      <div className={`flex h-14 w-20 shrink-0 items-center justify-center rounded-md border border-slate-600 ${severityBg(d.severity)}`}>
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white capitalize">{d.class_name?.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-400">{d.latitude?.toFixed(4)}°N, {d.longitude?.toFixed(4)}°E</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <DetectionStatusBadge status={d.status} />
                    <span className="text-xs text-gray-500">{new Date(d.created_at).toLocaleTimeString()}</span>
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

// ── Verify ────────────────────────────────────────────────────────────────────
function VerifyContent() {
  const { detections, loading, error, reload } = useDetections(100);
  const [filter,   setFilter]   = useState('all');
  const [updating, setUpdating] = useState(null);

  const updateStatus = async (detectionId, newStatus) => {
    setUpdating(detectionId);
    try {
      await api.updateDetectionStatus(detectionId, newStatus);
      reload();
    } catch (e) {
      alert(`Failed to update: ${e.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const severityColor = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-green-400' };
  const filtered = filter === 'all' ? detections : detections.filter(d => d.status === filter);

  const getStatusDisplay = (job) => {
    if (job.status === 'processing') return { text: 'Processing', color: 'text-yellow-400' };
    if (job.status === 'completed') return { text: 'Processed', color: 'text-green-400' };
    if (job.status === 'failed') return { text: 'Failed', color: 'text-red-400' };
    if (job.awaiting_video) return { text: 'Waiting for video', color: 'text-slate-400' };
    if (job.has_blob_video) return { text: 'Ready to process', color: 'text-slate-400' };
    return { text: 'Pending', color: 'text-slate-400' };
  };

  if (loading) return <LoadingCard />;
  if (error)   return <ErrorCard message={`Failed to load: ${error}`} onRetry={reload} />;

  const counts = {
    unverified:     detections.filter(d => d.status === 'unverified').length,
    verified:       detections.filter(d => d.status === 'verified').length,
    false_positive: detections.filter(d => d.status === 'false_positive').length,
    fixed:          detections.filter(d => d.status === 'fixed').length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Unverified', val: counts.unverified,     color: 'text-yellow-400' },
          { label: 'Verified',   val: counts.verified,       color: 'text-teal-400'   },
          { label: 'False +',    val: counts.false_positive, color: 'text-slate-400'  },
          { label: 'Fixed',      val: counts.fixed,          color: 'text-green-400'  },
        ].map(s => (
          <div key={s.label} className="content-card text-center">
            <p className="text-sm text-gray-400">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="content-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Detection Records</h2>
          <div className="flex gap-2">
            <button onClick={reload} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-gray-300 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <div className="flex rounded-lg bg-slate-700/60 border border-slate-600/50 p-1 gap-1">
              {['all', 'unverified', 'verified', 'false_positive'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all
                    ${filter === f ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && <p className="text-center text-gray-500 py-8">No records for this filter.</p>}
          {filtered.map(item => (
            <div key={item.detection_id} className="flex items-center justify-between p-4 bg-slate-700/40 border border-slate-600/30 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-white capitalize">{item.class_name?.replace('_', ' ')}</p>
                  <span className={`text-xs font-medium capitalize ${severityColor[item.severity] || 'text-gray-400'}`}>· {item.severity}</span>
                  <span className="text-xs text-gray-500">· {(item.confidence * 100).toFixed(1)}% conf</span>
                </div>
                <p className="text-xs text-gray-400 font-mono">{item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{new Date(item.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <DetectionStatusBadge status={item.status} />
                {item.status === 'unverified' && (
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(item.detection_id, 'verified')}
                      disabled={updating === item.detection_id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-teal-600/20 border border-teal-500/40 text-teal-400 hover:bg-teal-600/40 text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
                      <CheckCircle className="w-3.5 h-3.5" /> Verify
                    </button>
                    <button onClick={() => updateStatus(item.detection_id, 'false_positive')}
                      disabled={updating === item.detection_id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/40 text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
                      <XCircle className="w-3.5 h-3.5" /> False +
                    </button>
                  </div>
                )}
                {item.status === 'verified' && (
                  <button onClick={() => updateStatus(item.detection_id, 'fixed')}
                    disabled={updating === item.detection_id}
                    className="px-3 py-1.5 bg-green-600/20 border border-green-500/40 text-green-400 hover:bg-green-600/40 text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
                    Mark Fixed
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Uploads ───────────────────────────────────────────────────────────────────
function LGUDetectionsTableContent({ targetDetectionId = null }) {
  const { detections, loading, error, reload } = useDetections(500);
  const [statusUpdating, setStatusUpdating] = useState({});
  const [statusError, setStatusError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
    page,
    totalPages,
    pageItems: pagedDetections,
    start,
    setPage,
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
    setPage(Math.floor(index / PAGE_SIZE) + 1);
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
  }, [targetDetectionId, allDetections, setPage]);

  useEffect(() => {
    setSelectedDetectionIds(prev => {
      const validIds = new Set(allDetections.map(d => d.detection_id));
      const next = new Set([...prev].filter(id => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [allDetections]);

  const openLocation = (detection) => {
    if (detection.latitude == null || detection.longitude == null) return;
    const lat = Number(detection.latitude);
    const lng = Number(detection.longitude);
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank', 'noopener,noreferrer');
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

  const resetFilters = () => {
    setStatusFilter('all');
    setClassFilter('all');
    setPage(1);
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

  if (loading) return <LoadingCard />;
  if (error)   return <ErrorCard message={`Failed to load detections: ${error}`} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <div className="content-card">
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-lg font-semibold text-white">All Detections ({filteredDetections.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
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
            <button onClick={resetFilters} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-gray-300 transition-colors">
              <X className="w-3.5 h-3.5" /> Reset
            </button>
            <button onClick={reload} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-gray-300 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
        <div className="mb-5 space-y-3">
          <FilterTabs tabs={statusTabs} active={statusFilter} onChange={(id) => { setStatusFilter(id); setPage(1); }} />
          <FilterTabs tabs={classTabs} active={classFilter} onChange={(id) => { setClassFilter(id); setPage(1); }} />
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
              <table className="custom-table min-w-[1310px]">
                <thead>
                  <tr>
                    <th className="w-12">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={togglePageSelection}
                        aria-label="Select all detections on this page"
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-teal-500"
                      />
                    </th>
                    <th>Image</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Confidence</th>
                    <th>Location</th>
                    <th>City</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedDetections.map(d => (
                    <tr
                      key={d.detection_id}
                      data-detection-row={d.detection_id}
                      className={`${highlightedDetectionId === d.detection_id ? 'detection-row-highlight' : ''} ${selectedDetectionIds.has(d.detection_id) ? 'bg-teal-500/5' : ''}`}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedDetectionIds.has(d.detection_id)}
                          onChange={() => toggleDetectionSelection(d.detection_id)}
                          aria-label={`Select ${d.class_name?.replace(/_/g, ' ') || 'detection'}`}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-teal-500"
                        />
                      </td>
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
                          title="Open location in Google Maps"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          {d.latitude?.toFixed(4)}, {d.longitude?.toFixed(4)}
                        </button>
                      </td>
                      <td>{d.city || 'Unknown'}</td>
                      <td>
                        <div className="flex min-w-[180px] flex-col items-start gap-2">
                          <span className="text-sm font-semibold capitalize text-slate-200">{d.status?.replace(/_/g, ' ')}</span>
                          <div className="grid grid-cols-2 gap-2">
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
                          </div>
                        </div>
                      </td>
                      <td className="text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => requestDeleteDetections([d])}
                          disabled={deletingDetectionId === d.detection_id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingDetectionId === d.detection_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={filteredDetections.length}
              start={start}
              onPageChange={setPage}
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
          0%, 100% { background: rgba(6, 182, 212, 0.08); box-shadow: inset 4px 0 0 rgba(34, 211, 238, 0.45); }
          50% { background: rgba(6, 182, 212, 0.28); box-shadow: inset 4px 0 0 rgb(34, 211, 238); }
        }
        .detection-row-highlight { animation: detection-row-pulse 0.75s ease-in-out 4; }
      `}</style>
    </div>
  );
}

function UploadsContent({ user }) {
  const { jobs,  loading,  error,  reload: reloadJobs  } = useJobs(200);
  const { stats, reload: reloadStats } = useDashboardStats();
  const [processingAll, setProcessingAll] = useState(false);
  const [uploadType, setUploadType] = useState('video');
  const load = useCallback(() => { reloadJobs(); reloadStats(); }, [reloadJobs, reloadStats]);
  const visibleJobs = jobs.filter(job => uploadType === 'photo'
    ? job.media_type === 'photo'
    : job.media_type !== 'photo');
  const {
    page,
    totalPages,
    pageItems: pagedJobs,
    start,
    setPage,
  } = usePagination(visibleJobs);

  const statusDisplay = {
    completed:  { text: '✓ Processed',  color: 'text-green-400'  },
    processing: { text: '⏳ Processing', color: 'text-yellow-400' },
    pending:    { text: '⏸ Pending',    color: 'text-slate-400'  },
    failed:     { text: '✗ Failed',     color: 'text-red-400'    },
  };

  if (loading) return <LoadingCard />;
  if (error)   return <ErrorCard message={`Failed to load: ${error}`} onRetry={load} />;

  const readyJobs = visibleJobs.filter(job => job.status === 'pending' && job.has_blob_video && !job.awaiting_video);

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: 'Jurisdiction Videos', value: jobs.length, color: 'text-teal-400', sub: user?.city || 'Approved locality' },
          { label: 'Processing Queue', value: jobs.filter(job => job.status === 'processing').length, color: 'text-yellow-400', sub: 'Pending analysis' },
          { label: 'Data Quality',     value: '95.8%',                  color: 'text-emerald-400', sub: 'GPS accuracy'       },
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
              uploadType === option.value ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="content-card">
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-lg font-semibold text-white">Recent {uploadType === 'photo' ? 'Photo' : 'Video'} Submissions</h2>
          <div className="flex flex-wrap items-center gap-2">
            {uploadType === 'photo'
              ? <UploadPhotoButton userId={user?.user_id} onUploaded={load} />
              : <UploadVideoButton userId={user?.user_id} onUploaded={load} />}
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
          ? <p className="text-center text-gray-500 py-8">No {uploadType} submissions yet.</p>
          : (
            <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-slate-700/60">
            <table className="custom-table min-w-[1040px]">
              <thead><tr><th>Timestamp</th><th>Source</th><th>Filename</th><th>City</th><th>Blob Video</th><th>Job ID</th><th>Status</th></tr></thead>
              <tbody>
                {pagedJobs.map(job => {
                  return (
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={visibleJobs.length}
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
            <h2 className="text-lg font-semibold text-white">LGU Information</h2>
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
              { label: 'Username', val: username, setter: setUsername, type: 'text',  editable: true  },
              { label: 'Email',    val: email,    setter: setEmail,    type: 'email', editable: true  },
            ].map(field => (
              <div key={field.label}>
                <label className="text-sm text-gray-400 block mb-1">{field.label}</label>
                {editing && field.editable
                  ? <input value={field.val} onChange={e => field.setter(e.target.value)} type={field.type}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  : <p className="text-white">{field.val || '—'}</p>
                }
              </div>
            ))}
            {[
              { label: 'City',         val: user?.city     || '—' },
              { label: 'Region',       val: user?.region   || '—' },
              { label: 'Barangay',     val: user?.barangay || '—' },
              { label: 'Account Type', val: 'LGU Officer'         },
            ].map(item => (
              <div key={item.label}>
                <label className="text-sm text-gray-400 block mb-1">{item.label}</label>
                <p className="text-white">{item.val}</p>
              </div>
            ))}
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
    <div className="text-center py-4">
      <p className="text-slate-500 text-xs">© 2026 Nova. All rights reserved.</p>
    </div>
  </div>
);

// ── Page registry ─────────────────────────────────────────────────────────────
const pageRegistry = {
  Dashboard: { title: 'LGU Overview',      description: 'Road hazard monitoring for your jurisdiction.',               component: LGUDashboardContent },
  MapView:   { title: 'GIS Hazard Map',    description: 'Geographic view of road hazards within your coverage area.',  component: LGUMapContent,      isMap: true },
  RoadHealth:{ title: 'Road Health',       description: 'Analyze detections, severity, and status along a route or road.', component: () => <RoadHealthContent canManage /> },
  Verify:    { title: 'Data Verification', description: 'Review and verify road hazard detections.',                   component: LGUDetectionsTableContent },
  Uploads:   { title: 'Crowdsourced Data', description: 'Video submissions from contributors.',                         component: UploadsContent       },
  Profile:   { title: 'Profile',           description: 'Manage your LGU account settings.',                           component: null                 },
  About:     { title: 'About',             description: 'Learn more about the RoadSense platform.',                    component: AboutContent         },
};

const navItems = [
  { page: 'Dashboard', icon: <Home className="w-5 h-5" />,         label: 'Dashboard'   },
  { page: 'MapView',   icon: <Map className="w-5 h-5" />,          label: 'Map View'    },
  { page: 'RoadHealth',icon: <HeartPulse className="w-5 h-5" />,   label: 'Road Health' },
  { page: 'Verify',    icon: <CheckCircle className="w-5 h-5" />,  label: 'Verify Data' },
  { page: 'Uploads',   icon: <Upload className="w-5 h-5" />,       label: 'Uploads'     },
];

const accountItems = [
  { page: 'Profile', icon: <User className="w-5 h-5" />,     label: 'Profile'    },
  { page: 'About',   icon: <BookOpen className="w-5 h-5" />, label: 'About Nova' },
  { page: 'Logout',  icon: <LogOut className="w-5 h-5" />,   label: 'Logout'     },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ activePage, setActivePage, navigate, isCollapsed, setIsCollapsed, user }) {
  const displayName  = user?.full_name || 'LGU Officer';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <aside className={`glass-effect w-full ${isCollapsed ? 'lg:w-24' : 'lg:w-72'} flex-shrink-0 flex flex-col min-h-0 z-10 transition-all duration-300`}>
      <div className="h-20 lg:h-24 flex flex-shrink-0 items-center justify-center border-b border-white/10 relative">
        {!isCollapsed
          ? <div className="flex items-center gap-3">
              <img src="/roadsense.png" alt="RoadSense" className="w-12 h-12 rounded-full object-cover" />
              <div>
                <span className="text-xl font-bold text-white block">RoadSense</span>
                <span className="text-xs text-cyan-400 font-medium">LGU Portal</span>
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
            return (
              <a key={item.page} href="#"
                className={`nav-link flex flex-shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-gray-300 transition-all hover:bg-white/5 ${isCollapsed ? 'lg:justify-center' : 'lg:gap-4'} lg:px-4 lg:py-3 lg:hover:translate-x-1 ${activePage === item.page ? 'active' : ''}`}
                onClick={e => { e.preventDefault(); setActivePage(item.page); }}
                title={isCollapsed ? item.label : ''}>
                <span className={isCollapsed ? 'text-xl' : 'text-lg'}>{item.icon}</span>
                <span className={`text-sm font-medium lg:text-base ${isCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
              </a>
            );
          })}
        </div>
      </nav>

      <div className="hidden flex-shrink-0 border-t border-white/10 p-5 lg:block">
        {!isCollapsed
          ? <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-cyan-600 flex items-center justify-center text-white font-semibold text-lg">{avatarLetter}</div>
              <div>
                <p className="font-semibold text-white text-base">{displayName}</p>
                <p className="text-sm text-cyan-400">LGU Officer</p>
              </div>
            </div>
          : <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-cyan-600 flex items-center justify-center text-white font-semibold text-lg">{avatarLetter}</div>
            </div>
        }
      </div>
    </aside>
  );
}

// ── Main Content ──────────────────────────────────────────────────────────────
function MainContent({ activePage, user, setActivePage, detectionFocus, setDetectionFocus }) {
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
        <SearchBox scopes={['jobs', 'detections']} />
      </div>
      {isMap ? (
        <div className="min-h-0 flex-grow overflow-hidden p-3 sm:p-4">
          <PageComponent
            onViewDetection={(detection) => {
              setDetectionFocus(detection.detection_id);
              setActivePage('Verify');
            }}
          />
        </div>
      ) : (
        <div className="flex-grow overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto mt-2 w-full max-w-7xl">
            {activePage === 'Profile'
              ? <ProfileContent user={user} />
              : <PageComponent user={user} targetDetectionId={activePage === 'Verify' ? detectionFocus : null} />}
          </div>
        </div>
      )}
    </main>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function LGUDashboard() {
  const [activePage,  setActivePage]  = useState('Dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [detectionFocus, setDetectionFocus] = useState(null);
  const navigate = useNavigate();

  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) || {}; }
    catch { return {}; }
  });

  return (
    <>
      <style>{lguShapeStyles}</style>
      <div className="relative flex h-screen w-full flex-col overflow-hidden bg-slate-900 text-gray-200 lg:flex-row">
        <div className="shape-1" /><div className="shape-2" />
        <Sidebar activePage={activePage} setActivePage={setActivePage} navigate={navigate} isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} user={user} />
        <MainContent activePage={activePage} user={user} setActivePage={setActivePage} detectionFocus={detectionFocus} setDetectionFocus={setDetectionFocus} />
      </div>
    </>
  );
}
