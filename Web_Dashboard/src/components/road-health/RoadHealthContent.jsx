import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle, Download, Eye, EyeOff, HeartPulse, ImageIcon,
  Loader2, LocateFixed, MapPin, Minus, Navigation2, Plus, RefreshCw,
  Search, Trash2, X,
} from 'lucide-react';
import api from '../../api';
import { AuthenticatedImage, DetectionFrameModal } from '../shared/DetectionImage';
import { CARTO_ATTRIBUTION, CARTO_TILE_URL } from '../map/basemap';

const PH_CENTER = [12.8797, 121.7740];
const ROUTE_MATCH_METERS = 20;
const ROAD_RADIUS_KM = 1.5;
const MAP_COLORS = {
  major: '#FF453A',
  minor: '#FF9F0A',
  road_surface: '#30D158',
  accent: '#0A84FF',
};

function hazardType(detection) {
  const value = String(detection?.class_name || '').toLowerCase();
  if (value.includes('major')) return 'major';
  if (value.includes('minor') || value.includes('pothole')) return 'minor';
  return 'road_surface';
}

function hazardStyle(detection) {
  const type = hazardType(detection);
  return {
    type,
    color: MAP_COLORS[type],
    label: type === 'major' ? 'Major' : type === 'minor' ? 'Minor' : 'Road Surface',
  };
}

function makeDetectionIcon(L, detection, canManage) {
  const style = hazardStyle(detection);
  const shouldPulse = canManage && String(detection?.status || '').toLowerCase() === 'unverified';
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `
      <div style="position:relative;width:28px;height:28px;display:grid;place-items:center;">
        ${shouldPulse ? `<span class="road-health-marker-pulse" style="border-color:${style.color};"></span>` : ''}
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="9" cy="9" r="7" fill="${style.color}" stroke="white" stroke-width="2.5"/>
          <circle cx="9" cy="9" r="2" fill="white"/>
        </svg>
      </div>
    `,
  });
}

function makePinIcon(L, color = MAP_COLORS.accent, label = '') {
  return L.divIcon({
    className: '',
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    html: `
      <div class="road-health-pin">
        <svg width="34" height="42" viewBox="0 0 34 42" aria-hidden="true">
          <path d="M17 1C8.7 1 2 7.5 2 15.5 2 26 17 41 17 41s15-15 15-25.5C32 7.5 25.3 1 17 1Z"
            fill="${color}" stroke="white" stroke-width="2"/>
          <circle cx="17" cy="15.5" r="5.5" fill="white"/>
        </svg>
        ${label ? `<span style="position:absolute;left:50%;top:-8px;transform:translateX(-50%);padding:2px 6px;border-radius:6px;background:#071226;color:white;font-size:9px;font-weight:800;white-space:nowrap;border:1px solid rgba(255,255,255,.18)">${label}</span>` : ''}
      </div>
    `,
  });
}

const TYPE_GROUPS = [
  ['pothole_minor', 'Pothole Minor'],
  ['pothole_major', 'Pothole Major'],
  ['crack', 'Cracks'],
  ['road_patching', 'Road Patching'],
];

const SEVERITY_GROUPS = [
  ['high', 'High'],
  ['medium', 'Medium'],
  ['low', 'Low'],
];

const STATUS_GROUPS = [
  ['verified', 'Verified'],
  ['unverified', 'Unverified'],
  ['false_positive', 'False Positive'],
  ['fixed', 'Fixed'],
];

function placeLabel(place) {
  return place?.title || place?.display_name?.split(',').slice(0, 2).join(', ') || '';
}

function toLocalMeters(latitude, longitude, originLatitude) {
  const radians = Math.PI / 180;
  return {
    x: longitude * 111320 * Math.cos(originLatitude * radians),
    y: latitude * 110540,
  };
}

function pointToSegmentMeters(point, start, end) {
  const originLatitude = (point.latitude + start[1] + end[1]) / 3;
  const p = toLocalMeters(point.latitude, point.longitude, originLatitude);
  const a = toLocalMeters(start[1], start[0], originLatitude);
  const b = toLocalMeters(end[1], end[0], originLatitude);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (!dx && !dy) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanceToRouteMeters(detection, coordinates) {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < coordinates.length; index += 1) {
    minimum = Math.min(
      minimum,
      pointToSegmentMeters(detection, coordinates[index - 1], coordinates[index]),
    );
  }
  return minimum;
}

function haversineKm(first, second) {
  const radians = Math.PI / 180;
  const dLat = (second.latitude - first.latitude) * radians;
  const dLng = (second.longitude - first.longitude) * radians;
  const lat1 = first.latitude * radians;
  const lat2 = second.latitude * radians;
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(value));
}

function percentage(count, total) {
  return total ? Math.round((count / total) * 100) : 0;
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function SuggestionInput({ label, value, onValueChange, selected, onSelect, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  const update = event => {
    const nextValue = event.target.value;
    onValueChange(nextValue);
    onSelect(null);
    window.clearTimeout(timerRef.current);
    if (nextValue.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    timerRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.getLocationSuggestions(nextValue, 6);
        setSuggestions(response.suggestions || []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  return (
    <label className="relative block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={value}
          onChange={update}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-9 text-sm text-white outline-none transition focus:border-teal-500"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-teal-400" />}
      </div>
      {!selected && suggestions.length > 0 && (
        <div className="absolute z-[1200] mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          {suggestions.map(place => (
            <button
              key={`${place.latitude}-${place.longitude}-${place.display_name}`}
              type="button"
              onClick={() => {
                onValueChange(placeLabel(place));
                onSelect(place);
                setSuggestions([]);
              }}
              className="flex w-full items-start gap-2 border-b border-slate-800 px-3 py-2.5 text-left last:border-0 hover:bg-slate-800"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-white">{placeLabel(place)}</span>
                <span className="block truncate text-xs text-slate-500">{place.subtitle || place.display_name}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

function BreakdownCard({ title, groups, detections, keyName }) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
      <h3 className="mb-3 font-semibold text-white">{title}</h3>
      <div className="space-y-3">
        {groups.map(([key, label]) => {
          const count = detections.filter(item => item[keyName] === key).length;
          const percent = percentage(count, detections.length);
          return (
            <div key={key}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-slate-300">{label}</span>
                <span className="font-semibold text-white">{count} ({percent}%)</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-teal-500" style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RoadHealthContent({ canManage = false }) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const analysisLayersRef = useRef([]);
  const detectionLayersRef = useRef([]);
  const clusterRef = useRef(null);
  const [detections, setDetections] = useState([]);
  const [matched, setMatched] = useState([]);
  const [mode, setMode] = useState('route');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [road, setRoad] = useState('');
  const [fromPlace, setFromPlace] = useState(null);
  const [toPlace, setToPlace] = useState(null);
  const [roadPlace, setRoadPlace] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [bulkAction, setBulkAction] = useState(null);
  const [message, setMessage] = useState('');
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [selectedMapDetection, setSelectedMapDetection] = useState(null);
  const [clusterSelection, setClusterSelection] = useState(null);
  const [showDetections, setShowDetections] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const loadDetections = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await api.getDetections({ limit: 500 });
      setDetections(response.detections || []);
    } catch (error) {
      setMessage(error.message || 'Could not load detections.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDetections();
  }, [loadDetections]);

  useEffect(() => {
    let cancelled = false;
    async function initializeMap() {
      if (!mapElementRef.current || mapRef.current) return;
      const leafletModule = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !mapElementRef.current) return;
      const L = leafletModule.default || leafletModule;
      leafletRef.current = L;
      window.L = L;
      await import('leaflet.markercluster');
      const map = L.map(mapElementRef.current, { center: PH_CENTER, zoom: 6, zoomControl: false, attributionControl: false });
      L.tileLayer(CARTO_TILE_URL, {
        attribution: CARTO_ATTRIBUTION,
        className: 'road-health-map-tile',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    }
    initializeMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  const renderAnalysis = useCallback((nextAnalysis, nextMatched) => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    analysisLayersRef.current.forEach(layer => map.removeLayer(layer));
    detectionLayersRef.current.forEach(layer => map.removeLayer(layer));
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }
    analysisLayersRef.current = [];
    detectionLayersRef.current = [];

    if (nextAnalysis?.pinFrom) {
      const fromMarker = L.marker(
        [nextAnalysis.pinFrom.latitude, nextAnalysis.pinFrom.longitude],
        { icon: makePinIcon(L, '#30D158', 'FROM'), zIndexOffset: 1100 },
      ).addTo(map);
      analysisLayersRef.current.push(fromMarker);
    }
    if (nextAnalysis?.pinTo) {
      const toMarker = L.marker(
        [nextAnalysis.pinTo.latitude, nextAnalysis.pinTo.longitude],
        { icon: makePinIcon(L, MAP_COLORS.accent, 'TO'), zIndexOffset: 1100 },
      ).addTo(map);
      analysisLayersRef.current.push(toMarker);
    }

    if (nextAnalysis?.geometry) {
      const routeLayer = L.geoJSON(nextAnalysis.geometry, {
        style: { color: MAP_COLORS.accent, weight: 6, opacity: 0.92 },
      }).addTo(map);
      analysisLayersRef.current.push(routeLayer);
      map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
    } else if (nextAnalysis?.center) {
      const circle = L.circle(
        [nextAnalysis.center.latitude, nextAnalysis.center.longitude],
        {
          radius: ROAD_RADIUS_KM * 1000,
          color: MAP_COLORS.accent,
          fillColor: MAP_COLORS.accent,
          fillOpacity: 0.1,
          weight: 2,
        },
      ).addTo(map);
      analysisLayersRef.current.push(circle);
      map.fitBounds(circle.getBounds(), { padding: [40, 40] });
    }

    const visibleDetections = nextAnalysis ? nextMatched : [];
    if (!showDetections || !visibleDetections.length) return;
    const markers = visibleDetections.map(detection => {
      const marker = L.marker(
        [detection.latitude, detection.longitude],
        { icon: makeDetectionIcon(L, detection, canManage) },
      );
      marker.__detection = detection;
      marker.bindTooltip(
        `${detection.class_name?.replace(/_/g, ' ')} - ${detection.severity}`,
        { direction: 'top' },
      );
      marker.on('click', event => {
        L.DomEvent.stopPropagation(event);
        setClusterSelection(null);
        setSelectedMapDetection(detection);
      });
      detectionLayersRef.current.push(marker);
      return marker;
    });

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 55,
      zoomToBoundsOnClick: false,
      iconCreateFunction: group => {
        const childDetections = group.getAllChildMarkers()
          .map(marker => marker.__detection)
          .filter(Boolean);
        const colors = [...new Set(childDetections.map(item => hazardStyle(item).color))];
        const dots = colors.slice(0, 4).map(color =>
          `<span style="width:8px;height:8px;border-radius:50%;background:${color};border:1px solid rgba(255,255,255,.75)"></span>`,
        ).join('');
        return L.divIcon({
          className: '',
          iconSize: [Math.max(72, Math.min(116, 58 + colors.length * 8)), 36],
          html: `<div style="height:36px;min-width:72px;padding:0 10px;background:rgba(18,31,50,.94);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:5px;font-weight:800;font-size:12px;box-shadow:0 5px 18px rgba(0,0,0,.35);border:1px solid rgba(172,196,226,.14)"><span style="display:flex;gap:3px">${dots}</span><span>${group.getChildCount()}</span></div>`,
        });
      },
    });
    cluster.on('clusterclick', event => {
      const childDetections = event.layer.getAllChildMarkers()
        .map(marker => marker.__detection)
        .filter(Boolean);
      setSelectedMapDetection(null);
      setClusterSelection({
        detections: childDetections,
        bounds: event.layer.getBounds(),
      });
    });
    markers.forEach(marker => cluster.addLayer(marker));
    map.addLayer(cluster);
    clusterRef.current = cluster;
  }, [canManage, showDetections]);

  useEffect(() => {
    if (mapReady) renderAnalysis(analysis, matched);
  }, [analysis, detections, mapReady, matched, renderAnalysis, showDetections]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'pin') return undefined;
    const container = map.getContainer();
    container.style.cursor = 'crosshair';
    const handlePin = async event => {
      const point = {
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      };
      setSelectedMapDetection(null);
      setClusterSelection(null);

      const currentFrom = analysis?.pinMode ? analysis.pinFrom : null;
      const currentTo = analysis?.pinMode ? analysis.pinTo : null;
      if (!currentFrom || currentTo) {
        setMatched([]);
        setAnalysis({
          pinMode: true,
          pinFrom: point,
          label: `From pin (${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)})`,
        });
        setMessage('From pin placed. Click the map again to set the To location.');
        return;
      }

      const pendingAnalysis = {
        pinMode: true,
        pinFrom: currentFrom,
        pinTo: point,
        label: 'Pinned route',
      };
      setAnalysis(pendingAnalysis);
      setMatched([]);
      setAnalyzing(true);
      setMessage('Calculating the route between the two pins...');
      try {
        const coordinates = `${currentFrom.longitude},${currentFrom.latitude};${point.longitude},${point.latitude}`;
        const routeResponse = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
        );
        const routePayload = await routeResponse.json();
        const route = routePayload.routes?.[0];
        if (!route) throw new Error('No drivable route was found between the pins.');

        const nextMatched = detections.filter(detection =>
          distanceToRouteMeters(detection, route.geometry.coordinates) <= ROUTE_MATCH_METERS);
        setAnalysis({
          ...pendingAnalysis,
          geometry: route.geometry,
          label: `Pinned route (${currentFrom.latitude.toFixed(4)}, ${currentFrom.longitude.toFixed(4)} to ${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)})`,
          distanceKm: route.distance / 1000,
          durationMinutes: Math.round(route.duration / 60),
        });
        setMatched(nextMatched);
        setMessage(`${nextMatched.length} detections found along the pinned route.`);
      } catch (error) {
        setMessage(error.message || 'Could not calculate the pinned route.');
      } finally {
        setAnalyzing(false);
      }
    };
    map.on('click', handlePin);
    return () => {
      container.style.cursor = '';
      map.off('click', handlePin);
    };
  }, [analysis, detections, mapReady, mode]);

  const resolvePlace = async (value, selected) => {
    if (selected) return selected;
    const response = await api.getLocationSuggestions(value, 1);
    return response.suggestions?.[0] || null;
  };

  const analyzeRoad = async () => {
    setAnalyzing(true);
    setMessage('');
    setSelectedMapDetection(null);
    setClusterSelection(null);
    try {
      let nextAnalysis;
      let nextMatched;
      if (mode === 'route') {
        const [resolvedFrom, resolvedTo] = await Promise.all([
          resolvePlace(from, fromPlace),
          resolvePlace(to, toPlace),
        ]);
        if (!resolvedFrom || !resolvedTo) throw new Error('Select valid From and To locations.');
        setFromPlace(resolvedFrom);
        setToPlace(resolvedTo);

        const coordinates = `${resolvedFrom.longitude},${resolvedFrom.latitude};${resolvedTo.longitude},${resolvedTo.latitude}`;
        const routeResponse = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
        );
        const routePayload = await routeResponse.json();
        const route = routePayload.routes?.[0];
        if (!route) throw new Error('No drivable route was found.');
        nextMatched = detections.filter(detection =>
          distanceToRouteMeters(detection, route.geometry.coordinates) <= ROUTE_MATCH_METERS);
        nextAnalysis = {
          label: `${placeLabel(resolvedFrom)} to ${placeLabel(resolvedTo)}`,
          geometry: route.geometry,
          distanceKm: route.distance / 1000,
          durationMinutes: Math.round(route.duration / 60),
        };
      } else {
        const resolvedRoad = await resolvePlace(road, roadPlace);
        if (!resolvedRoad) throw new Error('Select a valid road or location.');
        setRoadPlace(resolvedRoad);
        nextMatched = detections.filter(detection =>
          haversineKm(detection, resolvedRoad) <= ROAD_RADIUS_KM);
        nextAnalysis = {
          label: placeLabel(resolvedRoad),
          center: resolvedRoad,
          distanceKm: null,
          durationMinutes: null,
        };
      }

      setAnalysis(nextAnalysis);
      setMatched(nextMatched);
      renderAnalysis(nextAnalysis, nextMatched);
    } catch (error) {
      setMessage(error.message || 'Road analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const healthScore = useMemo(() => {
    if (!matched.length) return 100;
    const penalty = matched.reduce((sum, detection) => {
      if (detection.status === 'fixed') return sum;
      if (detection.severity === 'high') return sum + 70;
      if (detection.severity === 'medium') return sum + 40;
      return sum + 15;
    }, 0);
    return Math.max(0, Math.round(100 - penalty / matched.length));
  }, [matched]);

  const healthLabel = healthScore >= 80 ? 'Good'
    : healthScore >= 60 ? 'Fair'
      : healthScore >= 40 ? 'Poor' : 'Critical';

  const downloadCsv = () => {
    if (!analysis) return;
    const rows = [
      ['Road Health Report'],
      ['Road / Route', analysis.label],
      ['Health Score', `${healthScore}/100 (${healthLabel})`],
      ['Total Detections', matched.length],
      [],
      ['Statistics'],
      ['Category', 'Value', 'Count', 'Percentage'],
      ...TYPE_GROUPS.map(([key, label]) => {
        const count = matched.filter(item => item.class_name === key).length;
        return ['Type', label, count, `${percentage(count, matched.length)}%`];
      }),
      ...SEVERITY_GROUPS.map(([key, label]) => {
        const count = matched.filter(item => item.severity === key).length;
        return ['Severity', label, count, `${percentage(count, matched.length)}%`];
      }),
      ...STATUS_GROUPS.map(([key, label]) => {
        const count = matched.filter(item => item.status === key).length;
        return ['Status', label, count, `${percentage(count, matched.length)}%`];
      }),
      [],
      ['Detections'],
      ['Detection ID', 'Type', 'Severity', 'Status', 'Confidence', 'Latitude', 'Longitude', 'City', 'Detected At'],
      ...matched.map(item => [
        item.detection_id,
        item.class_name,
        item.severity,
        item.status,
        `${(item.confidence * 100).toFixed(1)}%`,
        item.latitude,
        item.longitude,
        item.city || '',
        item.created_at || '',
      ]),
    ];
    const content = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `road-health-${analysis.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const runBulkAction = async action => {
    if (!matched.length) return;
    const verb = action === 'delete' ? 'delete' : 'mark as fixed';
    if (!window.confirm(`Are you sure you want to ${verb} all ${matched.length} detections in this road analysis?`)) return;
    setBulkAction(action);
    setMessage('');
    try {
      await api.bulkDetectionAction(matched.map(item => item.detection_id), action);
      if (action === 'delete') {
        setDetections(previous => previous.filter(item => !matched.some(match => match.detection_id === item.detection_id)));
        setMatched([]);
        renderAnalysis(analysis, []);
      } else {
        const ids = new Set(matched.map(item => item.detection_id));
        const update = item => ids.has(item.detection_id) ? { ...item, status: 'fixed' } : item;
        setDetections(previous => previous.map(update));
        setMatched(previous => previous.map(update));
      }
      setMessage(`${matched.length} detections were ${action === 'delete' ? 'deleted' : 'marked as fixed'}.`);
    } catch (error) {
      setMessage(error.message || 'Bulk action failed.');
    } finally {
      setBulkAction(null);
    }
  };

  const displayedMapDetections = analysis ? matched : [];
  const mapCounts = displayedMapDetections.reduce((counts, detection) => {
    counts[hazardType(detection)] += 1;
    return counts;
  }, { major: 0, minor: 0, road_surface: 0 });

  const locateUser = () => {
    if (!navigator.geolocation) {
      setMessage('Location access is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => mapRef.current?.flyTo(
        [position.coords.latitude, position.coords.longitude],
        16,
        { duration: 1.2 },
      ),
      () => setMessage('Could not access your current location.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-6">
      <style>{`
        .road-health-map .leaflet-container { background: #1c1c1e; }
        .road-health-map .road-health-map-tile {
          filter: brightness(.78) contrast(1.02) saturate(1.18) hue-rotate(-12deg);
        }
        .road-health-map .leaflet-tile-pane::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 400;
          pointer-events: none;
          background: rgba(7, 18, 38, .08);
        }
        .road-health-marker-pulse {
          position: absolute;
          width: 28px;
          height: 28px;
          border: 2px solid;
          border-radius: 999px;
          animation: road-health-pulse 1.8s ease-out infinite;
        }
        .road-health-pin { filter: drop-shadow(0 5px 8px rgba(0,0,0,.45)); }
        @keyframes road-health-pulse {
          0% { transform: scale(.45); opacity: .95; }
          100% { transform: scale(1.55); opacity: 0; }
        }
      `}</style>
      <div className="road-health-map relative overflow-hidden rounded-2xl border border-slate-700/70 bg-[#1c1c1e] shadow-2xl">
        <div ref={mapElementRef} className="h-[420px] w-full" />

        <div className="pointer-events-none absolute left-1/2 top-4 z-[1000] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-[#071226]/90 px-4 py-2 text-xs font-semibold text-slate-200 shadow-xl backdrop-blur">
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#FF453A]" />{mapCounts.major} Major</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#FF9F0A]" />{mapCounts.minor} Minor</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#30D158]" />{mapCounts.road_surface} Surface</span>
          <span className="border-l border-white/15 pl-3 text-white">{displayedMapDetections.length} Total</span>
        </div>

        <div className="pointer-events-none absolute right-4 top-4 z-[1000] grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#071226]/90 shadow-xl backdrop-blur">
          <Navigation2 className="h-5 w-5 text-[#0A84FF]" />
          <span className="absolute bottom-1 text-[8px] font-bold text-slate-300">N</span>
        </div>

        {mode === 'pin' && (
          <div className="pointer-events-none absolute left-1/2 top-16 z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#0A84FF]/40 bg-[#071226]/90 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin text-[#0A84FF]" /> : <MapPin className="h-4 w-4 text-[#0A84FF]" />}
            {analyzing
              ? 'Calculating pinned route...'
              : !analysis?.pinFrom || analysis?.pinTo
                ? 'Click the map to set the From pin'
                : 'From pin set. Click the map to set the To pin'}
          </div>
        )}

        <div className="absolute bottom-20 right-4 z-[1000] overflow-hidden rounded-xl border border-white/10 bg-[#071226]/92 shadow-xl backdrop-blur">
          <button type="button" title={showDetections ? 'Hide detections' : 'Show detections'} onClick={() => setShowDetections(value => !value)} className="grid h-10 w-10 place-items-center text-slate-200 hover:bg-white/10">
            {showDetections ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button type="button" title="Zoom in" onClick={() => mapRef.current?.zoomIn()} className="grid h-10 w-10 place-items-center border-t border-white/10 text-slate-200 hover:bg-white/10">
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" title="Zoom out" onClick={() => mapRef.current?.zoomOut()} className="grid h-10 w-10 place-items-center border-t border-white/10 text-slate-200 hover:bg-white/10">
            <Minus className="h-4 w-4" />
          </button>
          <button type="button" title="Use current location" onClick={locateUser} className="grid h-10 w-10 place-items-center border-t border-white/10 text-[#0A84FF] hover:bg-white/10">
            <LocateFixed className="h-4 w-4" />
          </button>
        </div>

        <button type="button" title="Refresh detections" onClick={loadDetections} className="absolute bottom-4 right-4 z-[1000] grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-[#071226]/92 text-slate-200 shadow-xl backdrop-blur hover:bg-[#101D30]">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] rounded-lg border border-white/10 bg-[#071226]/88 px-3 py-2 text-[11px] font-semibold text-slate-300 shadow-xl backdrop-blur">
          {canManage ? 'Live detection indicators' : 'Verified road detections'}
        </div>

        {loading && (
          <div className="pointer-events-none absolute inset-0 z-[900] grid place-items-center bg-[#071226]/35">
            <div className="flex items-center gap-2 rounded-xl bg-[#071226]/90 px-4 py-3 text-sm font-semibold text-white shadow-xl">
              <Loader2 className="h-4 w-4 animate-spin text-[#0A84FF]" /> Loading detections
            </div>
          </div>
        )}

        {clusterSelection && (
          <div className="absolute bottom-4 left-1/2 z-[1100] w-[min(340px,calc(100%-120px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-[#101D30]/95 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-white">{clusterSelection.detections.length} detections here</p>
                <p className="text-[11px] text-slate-400">Select a detection or zoom into the cluster</p>
              </div>
              <button type="button" onClick={() => setClusterSelection(null)} className="grid h-7 w-7 place-items-center rounded-full bg-black/35 text-slate-300 hover:bg-black/55 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto p-2">
              {clusterSelection.detections.map(detection => {
                const style = hazardStyle(detection);
                return (
                  <button
                    type="button"
                    key={detection.detection_id}
                    onClick={() => {
                      setClusterSelection(null);
                      setSelectedMapDetection(detection);
                      mapRef.current?.flyTo([detection.latitude, detection.longitude], 18, { duration: 0.8 });
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/5"
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full border-2 border-white" style={{ background: style.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold capitalize text-white">{detection.class_name?.replace(/_/g, ' ')}</span>
                      <span className="block truncate text-[11px] text-slate-400">{detection.location || detection.city || detection.severity}</span>
                    </span>
                    <span className="text-[10px] font-bold uppercase" style={{ color: style.color }}>{detection.severity}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                mapRef.current?.fitBounds(clusterSelection.bounds, { padding: [50, 50] });
                setClusterSelection(null);
              }}
              className="w-full border-t border-white/10 bg-[#0A84FF]/10 px-4 py-2.5 text-xs font-bold text-[#5EAEFF] hover:bg-[#0A84FF]/20"
            >
              Zoom into cluster
            </button>
          </div>
        )}

        {selectedMapDetection && (
          <div className="absolute bottom-4 left-1/2 z-[1100] w-[min(320px,calc(100%-120px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-[#101D30]/95 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `${hazardStyle(selectedMapDetection).color}20` }}>
                <MapPin className="h-5 w-5" style={{ color: hazardStyle(selectedMapDetection).color }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold capitalize text-white">{selectedMapDetection.class_name?.replace(/_/g, ' ')}</p>
                <p className="text-[11px] font-semibold capitalize" style={{ color: hazardStyle(selectedMapDetection).color }}>{selectedMapDetection.severity} severity</p>
              </div>
              <button type="button" onClick={() => setSelectedMapDetection(null)} className="grid h-7 w-7 place-items-center rounded-full bg-black/35 text-slate-300 hover:bg-black/55 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-2">
              <div className="flex justify-between border-b border-white/10 py-2 text-xs">
                <span className="uppercase tracking-wide text-slate-500">Confidence</span>
                <span className="font-semibold text-white">{Math.round((selectedMapDetection.confidence || 0) * 100)}%</span>
              </div>
              <button
                type="button"
                onClick={() => mapRef.current?.flyTo([selectedMapDetection.latitude, selectedMapDetection.longitude], 18, { duration: 0.8 })}
                className="flex w-full justify-between border-b border-white/10 py-2 text-xs"
              >
                <span className="uppercase tracking-wide text-slate-500">Coordinates</span>
                <span className="font-mono font-semibold text-[#5EAEFF]">{selectedMapDetection.latitude?.toFixed(4)}, {selectedMapDetection.longitude?.toFixed(4)}</span>
              </button>
              <div className="flex justify-between border-b border-white/10 py-2 text-xs">
                <span className="uppercase tracking-wide text-slate-500">Detected</span>
                <span className="font-semibold text-white">{selectedMapDetection.created_at ? new Date(selectedMapDetection.created_at).toLocaleDateString('en-PH') : 'Unknown'}</span>
              </div>
              <button type="button" onClick={() => setSelectedFrame(selectedMapDetection)} className="my-3 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#071226]">
                {selectedMapDetection.image_url ? (
                  <AuthenticatedImage src={selectedMapDetection.image_url} alt="Detected road hazard" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-2 text-xs font-semibold text-slate-500"><ImageIcon className="h-5 w-5" />No detection image</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="content-card">
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('route');
              setAnalysis(null);
              setMatched([]);
              setSelectedMapDetection(null);
              setClusterSelection(null);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'route' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            From and To
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('road');
              setAnalysis(null);
              setMatched([]);
              setSelectedMapDetection(null);
              setClusterSelection(null);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'road' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            Specific Road
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('pin');
              setAnalysis(null);
              setMatched([]);
              setSelectedMapDetection(null);
              setClusterSelection(null);
              setMessage('Click a location on the map to analyze nearby detections.');
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'pin' ? 'bg-[#0A84FF] text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            <MapPin className="h-4 w-4" /> Pin Location
          </button>
        </div>

        <div className={`grid gap-4 ${mode === 'route' ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {mode === 'route' ? (
            <>
              <SuggestionInput label="From" value={from} onValueChange={setFrom} selected={fromPlace} onSelect={setFromPlace} placeholder="Start location" />
              <SuggestionInput label="To" value={to} onValueChange={setTo} selected={toPlace} onSelect={setToPlace} placeholder="Destination" />
            </>
          ) : mode === 'road' ? (
            <SuggestionInput label="Road or location" value={road} onValueChange={setRoad} selected={roadPlace} onSelect={setRoadPlace} placeholder="Example: Commonwealth Avenue, Quezon City" />
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-[#0A84FF]/25 bg-[#0A84FF]/10 p-4 text-sm text-slate-300">
              <MapPin className="h-5 w-5 shrink-0 text-[#0A84FF]" />
              <span>
                {!analysis?.pinFrom || analysis?.pinTo
                  ? 'Click the map to place the From pin, then click again to place the To pin.'
                  : 'From pin placed. Click the map again to choose the To location and calculate the route.'}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {mode !== 'pin' && (
            <button
              type="button"
              onClick={analyzeRoad}
              disabled={analyzing || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation2 className="h-4 w-4" />}
              Analyze Road
            </button>
          )}
          <button type="button" onClick={loadDetections} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800">
            <RefreshCw className="h-4 w-4" /> Refresh Data
          </button>
          <span className="text-xs text-slate-500">
            {mode === 'route'
              ? 'Includes only detections matched to the road centerline used by the route.'
              : mode === 'road'
                ? `Includes detections within ${ROAD_RADIUS_KM} km of the selected road.`
                : 'Includes only detections matched to the road centerline between both pins.'}
          </span>
        </div>
        {message && <div className="mt-4 rounded-lg border border-teal-500/25 bg-teal-500/10 px-3 py-2 text-sm text-teal-200">{message}</div>}
      </div>

      {analysis && (analysis.geometry || analysis.center) && (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-5 lg:col-span-1">
              <HeartPulse className="mb-3 h-7 w-7 text-teal-400" />
              <p className="text-sm text-slate-400">Road Health</p>
              <p className="mt-1 text-4xl font-bold text-white">{healthScore}</p>
              <p className="mt-1 font-semibold text-teal-300">{healthLabel}</p>
              <p className="mt-3 text-xs text-slate-400">{analysis.label}</p>
              {analysis.distanceKm != null && (
                <p className="mt-1 text-xs text-slate-500">
                  {analysis.distanceKm.toFixed(1)} km, about {analysis.durationMinutes} minutes
                </p>
              )}
            </div>
            <BreakdownCard title="By Type" groups={TYPE_GROUPS} detections={matched} keyName="class_name" />
            <BreakdownCard title="By Severity" groups={SEVERITY_GROUPS} detections={matched} keyName="severity" />
            <BreakdownCard title="By Status" groups={STATUS_GROUPS} detections={matched} keyName="status" />
          </div>

          <div className="content-card">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Road Detections ({matched.length})</h2>
                <p className="text-sm text-slate-500">{analysis.label}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={downloadCsv} className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600">
                  <Download className="h-4 w-4" /> Export CSV
                </button>
                {canManage && (
                  <>
                    <button type="button" onClick={() => runBulkAction('fixed')} disabled={!matched.length || bulkAction} className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300 disabled:opacity-50">
                      {bulkAction === 'fixed' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Mark Road Fixed
                    </button>
                    <button type="button" onClick={() => runBulkAction('delete')} disabled={!matched.length || bulkAction} className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 disabled:opacity-50">
                      {bulkAction === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete Detections
                    </button>
                  </>
                )}
              </div>
            </div>

            {matched.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-slate-500">
                <AlertTriangle className="h-8 w-8" />
                <p>No detections were found on this road selection.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-700/60">
                <table className="custom-table min-w-[1000px]">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Type</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Confidence</th>
                      <th>Location</th>
                      <th>City</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matched.map(detection => (
                      <tr key={detection.detection_id}>
                        <td>
                          {detection.image_url ? (
                            <button type="button" onClick={() => setSelectedFrame(detection)} className="flex h-14 w-24 items-center justify-center overflow-hidden rounded-md border border-slate-700 bg-slate-950">
                              <AuthenticatedImage key={detection.image_url} src={detection.image_url} alt="Detection crop" className="h-full w-full object-cover" />
                            </button>
                          ) : (
                            <div className="flex h-14 w-24 items-center justify-center rounded-md bg-slate-900 text-slate-600"><ImageIcon className="h-5 w-5" /></div>
                          )}
                        </td>
                        <td className="capitalize">{detection.class_name?.replace(/_/g, ' ')}</td>
                        <td className="capitalize">{detection.severity}</td>
                        <td className="capitalize">{detection.status?.replace(/_/g, ' ')}</td>
                        <td>{(detection.confidence * 100).toFixed(1)}%</td>
                        <td className="font-mono text-xs">{detection.latitude?.toFixed(5)}, {detection.longitude?.toFixed(5)}</td>
                        <td>{detection.city || 'Unknown'}</td>
                        <td className="text-xs">{new Date(detection.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <DetectionFrameModal detection={selectedFrame} onClose={() => setSelectedFrame(null)} />
    </div>
  );
}
