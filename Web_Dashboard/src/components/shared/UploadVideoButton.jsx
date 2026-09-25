import React, { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import api from '../../api';

export default function UploadVideoButton({ userId = null, onUploaded, className = '' }) {
  const [uploading, setUploading] = useState(false);

  const pickVideo = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/quicktime,video/x-msvideo,.mp4,.mov,.avi';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        await api.uploadVideo(file, userId);
        onUploaded?.();
      } catch (e) {
        if (api.isPayloadTooLargeError?.(e)) {
          alert(`Payload Too Large\n\n${e.message}`);
        } else {
          alert(e.message || 'Failed to upload video.');
        }
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  return (
    <button
      type="button"
      onClick={pickVideo}
      disabled={uploading}
      className={`flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
      {uploading ? 'Uploading...' : 'Upload video'}
    </button>
  );
}
