import React, { useEffect, useState } from 'react';
import { ImageIcon, X } from 'lucide-react';
import { authHeaders } from '../../auth';

export function AuthenticatedImage({ src, alt, className = '', style, onError }) {
  const requiresAuth = src?.includes('/api/detections/');
  const [loadedImage, setLoadedImage] = useState(null);

  useEffect(() => {
    if (!src || !requiresAuth) return undefined;

    let active = true;
    let createdUrl = null;
    fetch(src, { headers: authHeaders() })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setLoadedImage({ src, url: createdUrl });
      })
      .catch(() => onError?.());

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src, requiresAuth, onError]);

  const objectUrl = loadedImage?.src === src ? loadedImage.url : null;
  if (requiresAuth && !objectUrl) {
    return <ImageIcon className="h-5 w-5 text-slate-500" />;
  }

  return <img src={objectUrl || src} alt={alt} className={className} style={style} onError={onError} />;
}

export function DetectionDeleteReview({ detections = [] }) {
  if (!detections.length) return null;

  return (
    <div className="min-h-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Review selected detection{detections.length === 1 ? '' : 's'}
      </p>
      <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
        {detections.map(detection => {
          const type = detection.class_name?.replace(/_/g, ' ') || 'Unknown hazard';
          const confidence = Number(detection.confidence);
          const hasCoordinates = detection.latitude != null && detection.longitude != null;

          return (
            <div
              key={detection.detection_id}
              className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 rounded-lg border border-slate-700 bg-slate-900/70 p-2.5"
            >
              <div className="flex h-20 w-24 items-center justify-center overflow-hidden rounded-md border border-slate-700 bg-slate-950">
                {detection.image_url ? (
                  <AuthenticatedImage
                    key={detection.image_url}
                    src={detection.image_url}
                    alt={`${type} selected for deletion`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-6 w-6 text-slate-500" />
                )}
              </div>
              <div className="min-w-0 self-center">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold capitalize text-white">{type}</p>
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-300">
                    {detection.severity || 'Unknown severity'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {Number.isFinite(confidence) ? `${(confidence * 100).toFixed(1)}% confidence` : 'Confidence unavailable'}
                </p>
                <p className="mt-1 truncate font-mono text-[11px] text-slate-500">
                  {hasCoordinates
                    ? `${Number(detection.latitude).toFixed(4)}, ${Number(detection.longitude).toFixed(4)}`
                    : 'Location unavailable'}
                </p>
                {detection.city && <p className="mt-1 truncate text-[11px] text-slate-500">{detection.city}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DetectionFrameModal({ detection, onClose }) {
  useEffect(() => {
    if (!detection) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detection, onClose]);

  if (!detection) return null;
  const frameUrl = detection.frame_url || detection.image_url;
  const hasOriginalFrame = Boolean(detection.frame_url);

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Original detection frame"
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <div>
            <p className="font-semibold text-white">
              {hasOriginalFrame ? 'Original detection frame' : 'Detection image'}
            </p>
            <p className="text-xs capitalize text-slate-400">
              {detection.class_name?.replace(/_/g, ' ')}{detection.city ? `, ${detection.city}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex min-h-72 items-center justify-center bg-black">
          {frameUrl ? (
            <AuthenticatedImage
              key={frameUrl}
              src={frameUrl}
              alt={hasOriginalFrame ? 'Full detection frame with bounding box' : 'Detected hazard'}
              className="max-h-[78vh] w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 py-20 text-slate-500">
              <ImageIcon className="h-8 w-8" />
              <span>No detection image is available.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
