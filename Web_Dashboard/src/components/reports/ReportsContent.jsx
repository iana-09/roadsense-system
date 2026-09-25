/**
 * components/reports/ReportsContent.jsx
 * Real data reports page — used by Admin and LGU dashboards.
 *
 * Props:
 *   isLGU {boolean} — hides the Export button and per-job table for LGU view
 *
 * Requires new API endpoints:
 *   GET /api/reports/summary
 *   GET /api/reports/jobs
 * Add these to api.js (see bottom of this file for the two new api.js functions).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Download, FileText, CheckCircle, AlertTriangle, Activity } from 'lucide-react';
import { LoadingCard, ErrorCard } from '../shared/Cards';
import api from '../../api';

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="content-card text-center">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function BarRow({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-sm text-gray-400 capitalize">{label.replace('_', ' ')}</span>
        <span className="text-sm font-semibold text-white">
          {count} <span className="text-gray-500 font-normal">({pct}%)</span>
        </span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReportsContent({ isLGU = false }) {
  const [summary,         setSummary]         = useState(null);
  const [jobs,            setJobs]            = useState([]);
  const [loadingSummary,  setLoadingSummary]  = useState(true);
  const [loadingJobs,     setLoadingJobs]     = useState(true);
  const [error,           setError]           = useState(null);
  const [exporting,       setExporting]       = useState(false);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data = await api.getReportsSummary();
      setSummary(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    if (isLGU) { setLoadingJobs(false); return; }
    setLoadingJobs(true);
    try {
      const data = await api.getReportsJobs(20);
      setJobs(data.jobs || []);
    } catch (e) {
      // Non-fatal — jobs table is bonus info
      console.warn('Reports jobs fetch failed:', e.message);
    } finally {
      setLoadingJobs(false);
    }
  }, [isLGU]);

  const reload = useCallback(() => { loadSummary(); loadJobs(); }, [loadSummary, loadJobs]);

  useEffect(() => { reload(); }, [reload]);

  // ── Export CSV ──────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!summary) return;
    setExporting(true);
    try {
      const det = summary.detections;
      const rows = [
        ['RoadSense Detection Report', '', ''],
        ['Generated', new Date().toLocaleString(), ''],
        ['', '', ''],
        ['=== DETECTION SUMMARY ===', '', ''],
        ['Total Detections',  det.total,              ''],
        ['Verified',          det.by_status.verified, ''],
        ['Unverified',        det.by_status.unverified,''],
        ['False Positives',   det.by_status.false_positive,''],
        ['Fixed',             det.by_status.fixed,    ''],
        ['Avg Confidence',    `${det.avg_confidence}%`,''],
        ['Verification Rate', `${det.verification_rate}%`,''],
        ['', '', ''],
        ['=== BY CLASS ===', '', ''],
        ['Pothole Minor',  det.by_class.pothole_minor, ''],
        ['Pothole Major',  det.by_class.pothole_major, ''],
        ['Cracks',         det.by_class.cracks,        ''],
        ['Road Patching',  det.by_class.road_patching, ''],
        ['', '', ''],
        ['=== BY SEVERITY ===', '', ''],
        ['Low',    det.by_severity.low,    ''],
        ['Medium', det.by_severity.medium, ''],
        ['High',   det.by_severity.high,   ''],
        ['', '', ''],
        ['=== JOBS ===', '', ''],
        ['Total Jobs', summary.jobs.total, ''],
        ['Completed',  summary.jobs.completed,''],
        ['Failed',     summary.jobs.failed,   ''],
      ];

      if (jobs.length > 0) {
        rows.push(['', '', '']);
        rows.push(['=== PER-JOB BREAKDOWN ===', '', '']);
        rows.push(['Job ID', 'Video', 'Detections', 'Verified', 'Avg Confidence', 'Completed At']);
        jobs.forEach(j => rows.push([
          j.job_id.slice(0, 8),
          j.video_filename,
          j.total_detections,
          j.verified,
          `${j.avg_confidence}%`,
          j.completed_at ? new Date(j.completed_at).toLocaleString() : '—',
        ]));
      }

      const csv = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `roadsense-report-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  // ── States ──────────────────────────────────────────────────────────────────
  if (loadingSummary) return <LoadingCard />;
  if (error) return <ErrorCard message={`Failed to load report data: ${error}`} onRetry={reload} />;
  if (!summary) return null;

  const det  = summary.detections;
  const jbs  = summary.jobs;
  const totalClass = det.total || 1;
  const totalSev   = det.total || 1;
  const totalStat  = det.total || 1;

  return (
    <div className="space-y-6">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-teal-400" />
          <p className="text-sm text-gray-400">
            Live data pulled from the database —
            <span className="text-teal-400 ml-1">{det.total} total detections</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={reload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-gray-300 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          {!isLGU && (
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60">
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          )}
        </div>
      </div>

      {/* Top stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Total Detections"    value={det.total}                       color="text-white"       sub="All time" />
        <StatTile label="Avg Confidence"      value={`${det.avg_confidence}%`}        color="text-teal-400"    sub="Model accuracy" />
        <StatTile label="Verification Rate"   value={`${det.verification_rate}%`}     color="text-cyan-400"    sub="Verified / Total" />
        <StatTile label="Jobs Completed"      value={jbs.completed}                   color="text-emerald-400" sub={`of ${jbs.total} total`} />
      </div>

      {/* Detection breakdown row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* By class */}
        <div className="content-card">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" /> By Type
          </h3>
          <div className="space-y-3">
            <BarRow label="Pothole Minor" count={det.by_class.pothole_minor} total={totalClass} color="bg-orange-500" />
            <BarRow label="Pothole Major" count={det.by_class.pothole_major} total={totalClass} color="bg-red-500"    />
            <BarRow label="Cracks"        count={det.by_class.cracks}        total={totalClass} color="bg-yellow-500" />
            <BarRow label="Road Patching" count={det.by_class.road_patching} total={totalClass} color="bg-blue-500"   />
          </div>
        </div>

        {/* By severity */}
        <div className="content-card">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" /> By Severity
          </h3>
          <div className="space-y-3">
            <BarRow label="High"   count={det.by_severity.high}   total={totalSev} color="bg-red-500"    />
            <BarRow label="Medium" count={det.by_severity.medium} total={totalSev} color="bg-yellow-500" />
            <BarRow label="Low"    count={det.by_severity.low}    total={totalSev} color="bg-green-500"  />
          </div>
        </div>

        {/* By status */}
        <div className="content-card">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-cyan-400" /> By Status
          </h3>
          <div className="space-y-3">
            <BarRow label="Verified"       count={det.by_status.verified}       total={totalStat} color="bg-teal-500"   />
            <BarRow label="Unverified"     count={det.by_status.unverified}      total={totalStat} color="bg-yellow-500" />
            <BarRow label="False Positive" count={det.by_status.false_positive}  total={totalStat} color="bg-slate-500"  />
            <BarRow label="Fixed"          count={det.by_status.fixed}           total={totalStat} color="bg-green-500"  />
          </div>
        </div>
      </div>

      {/* Per-job table — admin only */}
      {!isLGU && (
        <div className="content-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Per-Job Breakdown</h3>
            {loadingJobs && (
              <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {jobs.length === 0
            ? <p className="text-center text-gray-500 py-6">No completed jobs yet.</p>
            : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Video</th>
                    <th>Detections</th>
                    <th>Verified</th>
                    <th>Avg Confidence</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.job_id}>
                      <td className="font-mono text-xs text-gray-500">{j.job_id.slice(0, 8)}…</td>
                      <td className="max-w-[180px] truncate text-xs">{j.video_filename}</td>
                      <td className="text-teal-400 font-semibold">{j.total_detections}</td>
                      <td className="text-cyan-400">{j.verified}</td>
                      <td>{j.avg_confidence}%</td>
                      <td className="text-xs text-gray-500">
                        {j.completed_at ? new Date(j.completed_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      )}

      {/* Job summary tiles */}
      <div className="grid grid-cols-3 gap-4">
        <StatTile label="Total Jobs"     value={jbs.total}     color="text-white"       sub="All submissions"   />
        <StatTile label="Jobs Completed" value={jbs.completed} color="text-emerald-400" sub="Successfully done" />
        <StatTile label="Jobs Failed"    value={jbs.failed}    color="text-red-400"     sub="Needs attention"   />
      </div>
    </div>
  );
}