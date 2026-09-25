/**
 * MapPages.jsx
 * Fixed: map no longer overflows the dashboard layout.
 * The container uses the dashboard's remaining flex height,
 * so it stays inside the content pane.
 */

import React from 'react';
import { ShieldCheck, MapPin, Eye } from 'lucide-react';
import RoadSenseMap from './RoadSenseMap';

// ── Shared banner ─────────────────────────────────────────────────────────────

function InfoBanner({ icon, title, body, accent, extra }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 16px', borderRadius: 16, marginBottom: 12,
      background: `${accent}12`, border: `1px solid ${accent}30`,
      flexShrink: 0,   // ← don't let the banner compress the map
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${accent}22`, color: accent,
      }}>
        {React.cloneElement(icon, { size: 16 })}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: accent }}>{title}</p>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: `${accent}cc`, lineHeight: 1.5 }}>{body}</p>
        {extra}
      </div>
    </div>
  );
}

const mapPageStyle = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  minHeight: 0,
};

const mapShellStyle = {
  width: '100%',
  flex: 1,
  minHeight: 0,
  borderRadius: 20,
  overflow: 'hidden',
  position: 'relative',
};

// ── Admin Map ─────────────────────────────────────────────────────────────────

export function AdminMapContent({ focusDetection = null, onViewDetection }) {
  return (
    <div style={mapPageStyle}>
      <InfoBanner
        icon={<ShieldCheck />}
        accent="#34c759"
        title="Admin Map — Full Access"
        body="All detections shown including unverified (pulsing pins). Click any pin to verify, reject, or mark as fixed."
      />
      <div style={mapShellStyle}>
        <RoadSenseMap
          isGuest={false}
          defaultDark={true}
          focusDetection={focusDetection}
          onViewDetection={onViewDetection}
          style={{ width: '100%', height: '100%', minHeight: 'unset' }}
        />
      </div>
    </div>
  );
}

// ── LGU Map ───────────────────────────────────────────────────────────────────

export function LGUMapContent({ onViewDetection }) {
  return (
    <div style={mapPageStyle}>
      <InfoBanner
        icon={<MapPin />}
        accent="#007aff"
        title="LGU Map — Jurisdiction View"
        body="Pulsing pins are awaiting your verification. Click to verify or flag as false positive. Verified detections appear on the public map."
      />
      <div style={mapShellStyle}>
        <RoadSenseMap
          isGuest={false}
          defaultDark={true}
          onViewDetection={onViewDetection}
          style={{ width: '100%', height: '100%', minHeight: 'unset' }}
        />
      </div>
    </div>
  );
}

// ── Guest Map ─────────────────────────────────────────────────────────────────

export function GuestMapContent() {
  return (
    <div style={mapPageStyle}>
      <InfoBanner
        icon={<Eye />}
        accent="#ff9f0a"
        title="Public Road Hazard Map — Read Only"
        body="All hazards shown have been verified by a local government officer."
        extra={
          <a href="/login" style={{
            display: 'inline-block', marginTop: 4, fontSize: 12,
            color: '#007aff', fontWeight: 600, textDecoration: 'none',
          }}>
            Sign in for full access →
          </a>
        }
      />
      <div style={mapShellStyle}>
        <RoadSenseMap
          isGuest={true}
          defaultDark={false}
          style={{ width: '100%', height: '100%', minHeight: 'unset' }}
        />
      </div>
    </div>
  );
}
