import React, { useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import api from '../../api';

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location services are not available in this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      }),
      () => reject(new Error('Location access is required to upload a road photo.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export default function UploadPhotoButton({ userId = null, onUploaded, className = '' }) {
  const [uploading, setUploading] = useState(false);

  const pickPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,.jpg,.jpeg,.png';
    input.capture = 'environment';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const location = await getCurrentLocation();
        await api.uploadPhoto(file, location, userId);
        onUploaded?.();
      } catch (e) {
        alert(e.message || 'Failed to upload photo.');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  return (
    <button
      type="button"
      onClick={pickPhoto}
      disabled={uploading}
      className={`flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
      {uploading ? 'Uploading...' : 'Upload photo'}
    </button>
  );
}
