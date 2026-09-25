/**
 * RoadSenseMap.jsx
 * Apple Maps-inspired layout: left sidebar (Search / Directions),
 * dark navy tile layer, floating compass + controls top-right.
 * Drop-in replacement — same props: isGuest, className, defaultDark
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  AlertCircle, RefreshCw, CheckCircle, XCircle,
  Eye, EyeOff, Layers, Navigation2, Minus, Plus, LocateFixed,
  Search, X, MapPin, Car, Footprints, Bike, ChevronDown,
  ArrowRight, ImageIcon,
} from 'lucide-react';
import api from '../../api';
import { authHeaders } from '../../auth';
import { DetectionFrameModal } from '../shared/DetectionImage';

// ─── Constants ────────────────────────────────────────────────────────────────

const PH_CENTER    = [12.8797, 121.7740];
const DEFAULT_ZOOM = 6;

const HAZARD_STYLE = {
  major:        { fill: '#FF453A', border: '#E63B2E', label: 'Major Potholes' },
  minor:        { fill: '#FF9F0A', border: '#F28C00', label: 'Minor Potholes' },
  road_surface: { fill: '#30D158', border: '#28C840', label: 'Cracks / Road Patching' },
};

const CLASS_LABEL = {
  pothole_minor: 'Minor Pothole',
  pothole_major: 'Major Pothole',
  crack:         'Road Crack',
  road_patching: 'Road Patching',
};

const CLASS_ICON = {
  pothole_minor: '🕳',
  pothole_major: '⚠️',
  crack:         '〰️',
  road_patching: '🔧',
};

const CLASS_COLOR = {
  pothole_minor: '#FF9F0A',
  pothole_major: '#FF453A',
  crack: '#30D158',
  road_patching: '#30D158',
};

function hazardType(detection) {
  if (detection?.class_name === 'pothole_major') return 'major';
  if (detection?.class_name === 'pothole_minor') return 'minor';
  return 'road_surface';
}

function hazardStyle(detection) {
  return HAZARD_STYLE[hazardType(detection)];
}

// Key-free tiles prevent the production CARTO "API KEY REQUIRED" watermark.
const TILE_DARK  = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_LIGHT = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

function shortPlaceName(place) {
  return place.title || place.display_name?.split(',').slice(0, 2).join(', ') || 'Selected location';
}

// ─── Apple Maps Accurate Dark Palette ─────────────────────────────────────────
const AM = {
  sidebar:    '#071226',
  panel:      'rgba(18,31,50,0.94)',
  card:       '#101D30',
  mapBg:      '#1c1c1e',

  sidebarBdr: 'rgba(172,196,226,0.14)',
  divider:    'rgba(179,202,232,0.12)',
  inputBdr:   'rgba(179,202,232,0.16)',

  input:      '#142237',

  text:       '#F3F6FB',
  sub:        '#9EAEC2',

  accent:     '#0A84FF',
  accentDim:  'rgba(10,132,255,0.18)',

  hover:      'rgba(145,178,220,0.12)',

  activeTab:  '#0A84FF',
};

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  .rsm-wrap { font-family: -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif; }
  .rsm-wrap * { box-sizing: border-box; }
  .rsm-wrap .leaflet-container { background:${AM.mapBg}; }
  .rsm-wrap .rsm-apple-tile {
    filter:
      brightness(0.78)
      contrast(1.02)
      saturate(1.18)
      hue-rotate(-12deg);
  }
  .rsm-wrap .leaflet-tile-pane {
    background:#1c1c1e;
  }
  .rsm-wrap .leaflet-tile-pane::after {
    content:"";
    position:absolute;
    inset:0;
    z-index:450;
    pointer-events:none;
    background:
      linear-gradient(
        rgba(28,28,30,0.08),
        rgba(28,28,30,0.18)
      );
    mix-blend-mode:multiply;
  }
  .rsm-wrap .leaflet-control-zoom { display:none !important; }
  .rsm-wrap .leaflet-control-attribution {
    font-size:9px !important; opacity:0.35 !important;
    background:transparent !important; color:#fff !important;
  }
  .rsm-input {
    width:100%; padding:9px 12px 9px 36px;
    background:${AM.input}; border:1px solid ${AM.inputBdr};
    border-radius:10px; outline:none; color:${AM.text};
    font-size:13px; font-weight:500;
    transition:border-color 0.15s;
  }
  .rsm-input:focus { border-color:${AM.accent}; }
  .rsm-input::placeholder { color:${AM.sub}; }
  .rsm-btn-icon {
    display:flex;align-items:center;justify-content:center;
    border:none;cursor:pointer;background:transparent;
    border-radius:10px;transition:background 0.12s;color:${AM.text};
  }
  .rsm-btn-icon:hover { background:${AM.hover}; }
  .rsm-btn-icon:active { transform:scale(0.93); }
  .rsm-sidebar-item {
    display:flex;align-items:center;gap:12px;
    padding:11px 16px;border-radius:12px;cursor:pointer;
    font-size:14px;font-weight:500;color:${AM.text};
    transition:background 0.12s;border:none;background:transparent;width:100%;text-align:left;
  }
  .rsm-sidebar-item:hover { background:${AM.hover}; }
  .rsm-sidebar-item.active { background:${AM.accentDim};color:${AM.accent}; }
  .rsm-tag-btn {
    display:flex;align-items:center;gap:6px;
    padding:7px 14px;border-radius:20px;
    border:1px solid ${AM.inputBdr};background:${AM.input};
    color:${AM.text};font-size:12px;font-weight:600;cursor:pointer;
    transition:background 0.12s;
  }
  .rsm-tag-btn:hover { background:${AM.hover}; }
  @keyframes rsm-slide-up {
    from { opacity:0; transform:translateY(10px) scale(0.97); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  @keyframes rsm-fade-in { from{opacity:0} to{opacity:1} }
  @keyframes spin { to { transform:rotate(360deg); } }
  .rsm-slide-up { animation:rsm-slide-up 0.2s cubic-bezier(.4,0,.2,1) forwards; }
  .rsm-fade-in  { animation:rsm-fade-in  0.18s ease forwards; }
  .rsm-dropdown {
    position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:200;
    background:${AM.card}; border:1px solid ${AM.inputBdr};
    border-radius:12px; overflow:hidden; max-height:260px; overflow-y:auto;
    box-shadow:0 8px 32px rgba(0,0,0,0.5);
  }
  .rsm-drop-item {
    display:flex;align-items:center;gap:10px;
    padding:10px 14px;border:none;background:transparent;
    cursor:pointer;width:100%;text-align:left;transition:background 0.1s;
    color:${AM.text};
  }
  .rsm-drop-item:hover { background:${AM.hover}; }
  .rsm-drop-label {
    padding:7px 14px 3px;font-size:10px;font-weight:700;
    color:${AM.sub};text-transform:uppercase;letter-spacing:0.08em;
  }
  .rsm-travel-tab {
    flex:1;display:flex;align-items:center;justify-content:center;
    padding:8px;border-radius:8px;cursor:pointer;
    border:none;transition:background 0.15s;
  }
`;

function injectCSS() {
  if (document.getElementById('rsm-css')) return;
  const el = document.createElement('style');
  el.id = 'rsm-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

// ─── Marker factory ───────────────────────────────────────────────────────────

function makeIcon(L, detection, isGuest) {
  const col     = hazardStyle(detection);
  const status  = detection.status;
  const pending = !isGuest && status === 'unverified';
  const pulse   = pending ? `
    <circle cx="8" cy="8" r="6" fill="${col.fill}" opacity="0.2">
      <animate attributeName="r"       from="6" to="11" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.2" to="0"  dur="1.8s" repeatCount="indefinite"/>
    </circle>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
    ${pulse}
    <filter id="ds"><feDropShadow dx="0" dy="1" stdDeviation="1.6" flood-color="rgba(0,0,0,0.45)"/></filter>
    <circle cx="8" cy="8" r="5.5"
      fill="${col.fill}" stroke="rgba(255,255,255,0.92)" stroke-width="2"
      opacity="${pending?'0.7':'1'}" filter="url(#ds)"/>
  </svg>`;
  return L.divIcon({ html: svg, className:'', iconSize:[16,16], iconAnchor:[8,8], popupAnchor:[0,-10] });
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  panel, setPanel,
  detections, onFlyTo, onFilteredDetections,
  mapInstance,
}) {
  return (
    <div style={{
      width: 260, flexShrink:0, height:'100%',
      background: AM.sidebar,
      borderRight: `1px solid ${AM.sidebarBdr}`,
      display:'flex', flexDirection:'column',
      zIndex:10,
    }}>
      {/* RoadSense logo area */}
      <div style={{padding:'18px 16px 10px',display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:30,height:30,
          display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
          <img
            src="/roadsense.png"
            alt="RoadSense"
            style={{width:22,height:22,objectFit:'contain',display:'block'}}
          />
        </div>
        <span style={{fontSize:16,fontWeight:700,color:AM.text,letterSpacing:'-0.3px'}}>
          RoadSense
        </span>
      </div>

      {/* Nav items */}
      <div style={{padding:'0 8px',display:'flex',flexDirection:'column',gap:2}}>
        <button className={`rsm-sidebar-item${panel==='search'?' active':''}`}
          onClick={()=>setPanel(p=>p==='search'?null:'search')}>
          <span style={{width:30,height:30,borderRadius:8,
            background:panel==='search'?AM.accentDim:'rgba(145,178,220,0.12)',
            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <Search size={14} color={panel==='search'?AM.accent:AM.sub}/>
          </span>
          Search
        </button>
        <button className={`rsm-sidebar-item${panel==='directions'?' active':''}`}
          onClick={()=>setPanel(p=>p==='directions'?null:'directions')}>
          <span style={{width:30,height:30,borderRadius:8,
            background:panel==='directions'?AM.accentDim:'rgba(145,178,220,0.12)',
            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <ArrowRight size={14} color={panel==='directions'?AM.accent:AM.sub}/>
          </span>
          Directions
        </button>
        <button className={`rsm-sidebar-item${panel==='layers'?' active':''}`}
          onClick={()=>setPanel(p=>p==='layers'?null:'layers')}>
          <span style={{width:30,height:30,borderRadius:8,
            background:panel==='layers'?AM.accentDim:'rgba(145,178,220,0.12)',
            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <Layers size={14} color={panel==='layers'?AM.accent:AM.sub}/>
          </span>
          Guides
        </button>
      </div>

      <div style={{height:1,background:AM.divider,margin:'10px 16px'}}/>

      {/* Panel content */}
      <div style={{flex:1,overflowY:'auto',padding:'0 8px 16px'}}>
        {panel === 'search' && (
          <SearchPanel
            detections={detections}
            onFlyTo={onFlyTo}
            onFilteredDetections={onFilteredDetections}
          />
        )}
        {panel === 'directions' && (
          <DirectionsPanel
            onFlyTo={onFlyTo}
            mapInstance={mapInstance}
          />
        )}
        {panel === 'layers' && (
          <LayersPanel detections={detections} />
        )}
        {!panel && (
          <div style={{padding:'8px 8px',color:AM.sub,fontSize:12,lineHeight:1.5}}>
            Select a tool above to explore the map.
          </div>
        )}
      </div>

      {/* Bottom branding */}
      <div style={{padding:'12px 16px',borderTop:`1px solid ${AM.divider}`}}>
        <p style={{margin:0,fontSize:10,color:AM.sub}}>
          Have a hazard to report?{' '}
          <span style={{color:AM.accent,cursor:'pointer'}}>Manage Reports ↗</span>
        </p>
      </div>
    </div>
  );
}

// ─── Search Panel ─────────────────────────────────────────────────────────────

function SearchPanel({ detections, onFlyTo, onFilteredDetections }) {
  const [query,      setQuery]      = useState('');
  const [places,     setPlaces]     = useState([]);
  const [detHits,    setDetHits]    = useState([]);
  const [searching,  setSearching]  = useState(false);
  const [open,       setOpen]       = useState(false);
  const timer = useRef(null);

  const searchDets = (q) => {
    const term = q.toLowerCase();
    const m = q.trim()
      ? detections.filter(d =>
          d.class_name?.toLowerCase().includes(term) ||
          d.severity?.toLowerCase().includes(term)   ||
          d.status?.toLowerCase().includes(term))
      : [];
    setDetHits(m);
    onFilteredDetections(m.length && q.trim() ? m : null);
  };

  const geocode = async (q) => {
    if (q.trim().length < 2) { setPlaces([]); return; }
    setSearching(true);
    try {
      const response = await api.getLocationSuggestions(q, 5);
      setPlaces(response.suggestions || []);
    } catch { setPlaces([]); }
    finally { setSearching(false); }
  };

  const onChange = (e) => {
    const q = e.target.value;
    setQuery(q); setOpen(true); searchDets(q);
    clearTimeout(timer.current);
    timer.current = setTimeout(()=>geocode(q), 400);
  };

  const clear = () => { setQuery(''); setPlaces([]); setDetHits([]); setOpen(false); onFilteredDetections(null); };

  return (
    <div style={{padding:'8px 8px 0'}}>
      {/* Search input */}
      <div style={{position:'relative'}}>
        <div style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',zIndex:1,pointerEvents:'none'}}>
          {searching
            ? <div style={{width:14,height:14,border:`2px solid ${AM.sub}`,borderTopColor:AM.accent,borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
            : <Search size={14} color={AM.sub}/>
          }
        </div>
        <input
          className="rsm-input"
          value={query} onChange={onChange}
          onFocus={()=>setOpen(true)}
          placeholder="Search places or hazards…"
        />
        {query && (
          <button onClick={clear} className="rsm-btn-icon"
            style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',width:20,height:20}}>
            <X size={12} color={AM.sub}/>
          </button>
        )}

        {open && (places.length > 0 || detHits.length > 0) && (
          <div className="rsm-dropdown rsm-fade-in">
            {detHits.length > 0 && (
              <>
                <div className="rsm-drop-label">Hazards ({detHits.length})</div>
                {detHits.slice(0,4).map((d,i) => {
                  const sev = hazardStyle(d);
                  return (
                    <button key={i} className="rsm-drop-item"
                      onClick={()=>{ onFlyTo([d.latitude,d.longitude],16); setOpen(false); }}>
                      <span style={{fontSize:15,flexShrink:0}}>{CLASS_ICON[d.class_name]||'📍'}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{margin:0,fontSize:12,fontWeight:600,color:AM.text}}>
                          {CLASS_LABEL[d.class_name]||d.class_name}
                        </p>
                        <p style={{margin:0,fontSize:11,color:sev.fill}}>{d.severity} · {d.status}</p>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
            {detHits.length > 0 && places.length > 0 && (
              <div style={{height:1,background:AM.divider,margin:'4px 14px'}}/>
            )}
            {places.length > 0 && (
              <>
                <div className="rsm-drop-label">Places</div>
                {places.map((p,i) => (
                  <button key={i} className="rsm-drop-item"
                    onClick={()=>{
                      onFlyTo([p.latitude,p.longitude],14);
                      setQuery(shortPlaceName(p));
                      setOpen(false); setPlaces([]);
                    }}>
                    <div style={{width:26,height:26,borderRadius:7,flexShrink:0,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      background:'rgba(10,132,255,0.15)'}}>
                      <MapPin size={12} color={AM.accent}/>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:0,fontSize:12,fontWeight:600,color:AM.text,
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {p.title || p.display_name.split(',')[0]}
                      </p>
                      <p style={{margin:0,fontSize:11,color:AM.sub,
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {p.subtitle || p.display_name.split(',').slice(1,3).join(',')}
                      </p>
                    </div>
                  </button>
                ))}
              </>
            )}
            <div style={{height:6}}/>
          </div>
        )}
      </div>

      {/* Quick hazard filters */}
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:10}}>
        {['critical','high','pothole','crack','unverified'].map(tag => (
          <button key={tag} className="rsm-tag-btn"
            onClick={()=>{ setQuery(tag); searchDets(tag); onFilteredDetections(null); }}>
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Directions Panel ─────────────────────────────────────────────────────────

const TRAVEL_MODES = [
  { id:'car',  Icon: Car,         label:'Drive'  },
  { id:'walk', Icon: Footprints,  label:'Walk'   },
  { id:'bike', Icon: Bike,        label:'Cycle'  },
];

function DirectionsPanel({ onFlyTo, mapInstance }) {
  const [mode,    setMode]    = useState('car');
  const [from,    setFrom]    = useState('');
  const [to,      setTo]      = useState('');
  const [fromRes, setFromRes] = useState([]);
  const [toRes,   setToRes]   = useState([]);
  const [fromPlace, setFromPlace] = useState(null);
  const [toPlace,   setToPlace]   = useState(null);
  const [fromOpen,setFromOpen]= useState(false);
  const [toOpen,  setToOpen]  = useState(false);
  const [routing, setRouting] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const routeLayerRef = useRef(null);

  const geocode = async (q, setter) => {
    if (q.trim().length < 2) { setter([]); return; }
    try {
      const response = await api.getLocationSuggestions(q, 5);
      setter(response.suggestions || []);
    } catch { setter([]); }
  };

  const fromTimer = useRef(null);
  const toTimer   = useRef(null);

  const handleFrom = (e) => {
    setFrom(e.target.value); setFromPlace(null); setFromOpen(true);
    clearTimeout(fromTimer.current);
    fromTimer.current = setTimeout(()=>geocode(e.target.value, setFromRes), 400);
  };
  const handleTo = (e) => {
    setTo(e.target.value); setToPlace(null); setToOpen(true);
    clearTimeout(toTimer.current);
    toTimer.current = setTimeout(()=>geocode(e.target.value, setToRes), 400);
  };

  // Use OSRM for routing
  const calcRoute = async () => {
    if (!from || !to) return;
    setRouting(true);
    try {
      // Geocode both if needed
      const [fRes, tRes] = await Promise.all([
        fromPlace
          ? Promise.resolve([fromPlace])
          : api.getLocationSuggestions(from, 1).then(response => response.suggestions || []),
        toPlace
          ? Promise.resolve([toPlace])
          : api.getLocationSuggestions(to, 1).then(response => response.suggestions || []),
      ]);
      if (!fRes[0] || !tRes[0]) { alert('Could not find one of the locations.'); return; }

      const osrmProfile = mode==='bike'?'bike':mode==='walk'?'foot':'car';
      const coords = `${fRes[0].longitude},${fRes[0].latitude};${tRes[0].longitude},${tRes[0].latitude}`;
      const route = await fetch(
        `https://router.project-osrm.org/route/v1/${osrmProfile}/${coords}?overview=full&geometries=geojson`
      ).then(r=>r.json());

      if (!route.routes?.[0]) { alert('No route found.'); return; }

      const map = mapInstance;
      if (!map) return;

      // Remove old route
      if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); }

      // Draw route
      const L = (await import('leaflet')).default || (await import('leaflet'));
      const line = L.geoJSON(route.routes[0].geometry, {
        style:{ color: '#147EFB', weight:5, opacity:0.85, lineCap:'round', lineJoin:'round' }
      }).addTo(map);
      routeLayerRef.current = line;

      // Add start/end markers
      const startIcon = L.divIcon({
        html:`<div style="width:14px;height:14px;border-radius:50%;background:#34c759;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
        className:'',iconSize:[14,14],iconAnchor:[7,7],
      });
      const endIcon = L.divIcon({
        html:`<div style="width:14px;height:14px;border-radius:50%;background:${AM.accent};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
        className:'',iconSize:[14,14],iconAnchor:[7,7],
      });
      L.marker([fRes[0].latitude, fRes[0].longitude], {icon:startIcon}).addTo(map);
      L.marker([tRes[0].latitude, tRes[0].longitude], {icon:endIcon}).addTo(map);

      map.fitBounds(line.getBounds(), {padding:[40,40]});

      const dist = (route.routes[0].distance/1000).toFixed(1);
      const dur  = Math.round(route.routes[0].duration/60);
      setRouteInfo({ dist, dur });
    } catch(e) { console.error(e); }
    finally { setRouting(false); }
  };

  const selectMyLocation = (setter, setPlace, setOpen) => {
    navigator.geolocation?.getCurrentPosition(p=>{
      setter(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`);
      setPlace({
        title: 'My location',
        display_name: 'My location',
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
      });
      setOpen(false);
    });
  };

  return (
    <div style={{padding:'8px 8px 0'}}>
      {/* Travel mode tabs */}
      <div style={{display:'flex',gap:6,padding:'6px',background:AM.input,borderRadius:12,marginBottom:14}}>
        {TRAVEL_MODES.map(({id,Icon,label})=>(
          <button key={id} className="rsm-travel-tab"
            onClick={()=>setMode(id)}
            style={{
              background: mode===id ? AM.accent : 'transparent',
              color: mode===id ? '#fff' : AM.sub,
            }}>
            <Icon size={16}/>
          </button>
        ))}
      </div>

      {/* From / To inputs */}
      <div style={{position:'relative',background:AM.card,borderRadius:14,overflow:'visible',
        border:`1px solid ${AM.inputBdr}`}}>

        {/* FROM */}
        <div style={{position:'relative',padding:'2px 0'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px'}}>
            <div style={{width:22,height:22,borderRadius:'50%',background:AM.accent,
              display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <span style={{fontSize:10,color:'#fff',fontWeight:800}}>+</span>
            </div>
            <input
              className="rsm-input"
              value={from} onChange={handleFrom}
              onFocus={()=>setFromOpen(true)}
              placeholder="From"
              style={{padding:'0',background:'transparent',border:'none',
                fontSize:14,height:'auto'}}
            />
            <button className="rsm-btn-icon" title="Use my location"
              onClick={()=>selectMyLocation(setFrom, setFromPlace, setFromOpen)}
              style={{width:28,height:28,flexShrink:0,color:AM.accent}}>
              <LocateFixed size={14}/>
            </button>
          </div>

          {fromOpen && fromRes.length > 0 && (
            <div className="rsm-dropdown rsm-fade-in" style={{left:8,right:8}}>
              {fromRes.map((p,i)=>(
                <button key={i} className="rsm-drop-item"
                  onClick={()=>{ setFrom(shortPlaceName(p)); setFromPlace(p); setFromRes([]); setFromOpen(false); onFlyTo([p.latitude, p.longitude], 14); }}>
                  <MapPin size={12} color={AM.accent}/>
                  <span style={{fontSize:12,color:AM.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {shortPlaceName(p)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider with drag handles */}
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'0 14px'}}>
          <div style={{width:1,height:20,background:AM.divider,marginLeft:10}}/>
          <div style={{flex:1,height:1,background:AM.divider}}/>
        </div>

        {/* TO */}
        <div style={{position:'relative',padding:'2px 0'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px'}}>
            <div style={{width:22,height:22,borderRadius:'50%',background:'rgba(10,132,255,0.2)',
              border:`2px solid ${AM.accent}`,
              display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <span style={{fontSize:10,color:AM.accent,fontWeight:800}}>+</span>
            </div>
            <input
              className="rsm-input"
              value={to} onChange={handleTo}
              onFocus={()=>setToOpen(true)}
              placeholder="To"
              style={{padding:'0',background:'transparent',border:'none',
                fontSize:14,height:'auto'}}
            />
          </div>
          {toOpen && toRes.length > 0 && (
            <div className="rsm-dropdown rsm-fade-in" style={{left:8,right:8}}>
              {toRes.map((p,i)=>(
                <button key={i} className="rsm-drop-item"
                  onClick={()=>{ setTo(shortPlaceName(p)); setToPlace(p); setToRes([]); setToOpen(false); onFlyTo([p.latitude, p.longitude], 14); }}>
                  <MapPin size={12} color={AM.accent}/>
                  <span style={{fontSize:12,color:AM.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {shortPlaceName(p)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add Stop row */}
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px 12px',
          borderTop:`1px solid ${AM.divider}`}}>
          <div style={{width:22,height:22,borderRadius:'50%',
            border:`1.5px solid ${AM.sub}`,
            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <span style={{fontSize:14,color:AM.sub,lineHeight:1}}>+</span>
          </div>
          <span style={{fontSize:13,color:AM.sub}}>Add Stop</span>
        </div>
      </div>

      {/* Options row */}
      <div style={{display:'flex',gap:8,marginTop:12}}>
        <button className="rsm-tag-btn" style={{flex:1,justifyContent:'center'}}>
          Now <ChevronDown size={12}/>
        </button>
        <button className="rsm-tag-btn" style={{flex:1,justifyContent:'center'}}>
          Avoid <ChevronDown size={12}/>
        </button>
      </div>

      {/* Get Route button */}
      <button onClick={calcRoute} disabled={routing||!from||!to}
        style={{
          width:'100%',marginTop:12,padding:'11px',borderRadius:12,
          background: (from&&to) ? AM.accent : 'rgba(10,132,255,0.25)',
          color:'#fff',fontSize:13,fontWeight:700,border:'none',cursor:(from&&to)?'pointer':'default',
          transition:'all 0.15s', display:'flex',alignItems:'center',justifyContent:'center',gap:8,
        }}>
        {routing
          ? <><div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',
              borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/> Routing…</>
          : <><Navigation2 size={14}/> Get Directions</>
        }
      </button>

      {/* Route result */}
      {routeInfo && (
        <div style={{marginTop:12,padding:'12px 14px',background:AM.input,borderRadius:12,
          border:`1px solid ${AM.inputBdr}`}} className="rsm-slide-up">
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <div>
              <p style={{margin:0,fontSize:20,fontWeight:700,color:AM.text}}>{routeInfo.dur} min</p>
              <p style={{margin:'2px 0 0',fontSize:12,color:AM.sub}}>{routeInfo.dist} km</p>
            </div>
            <div style={{textAlign:'right'}}>
              <span style={{padding:'4px 10px',borderRadius:20,background:AM.accentDim,
                color:AM.accent,fontSize:11,fontWeight:700}}>
                {TRAVEL_MODES.find(m=>m.id===mode)?.label}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Layers Panel ─────────────────────────────────────────────────────────────

function LayersPanel({ detections }) {
  const counts = detections.reduce((a,d)=>{ const key = hazardType(d); a[key]=(a[key]||0)+1; return a; },{});
  return (
    <div style={{padding:'8px 8px 0'}}>
      <p style={{margin:'0 0 10px',fontSize:11,color:AM.sub,textTransform:'uppercase',
        letterSpacing:'0.08em',fontWeight:700}}>Detection Summary</p>
      {Object.entries(HAZARD_STYLE).map(([k,v])=>(
        <div key={k} style={{display:'flex',alignItems:'center',gap:10,
          padding:'9px 12px',borderRadius:10,marginBottom:4,
          background:AM.input,border:`1px solid ${AM.inputBdr}`}}>
          <div style={{width:10,height:10,borderRadius:'50%',background:v.fill,flexShrink:0}}/>
          <span style={{fontSize:13,color:AM.text,flex:1,fontWeight:500}}>{v.label}</span>
          <span style={{fontSize:13,color:v.fill,fontWeight:700}}>{counts[k]||0}</span>
        </div>
      ))}
      <div style={{marginTop:12,padding:'12px',borderRadius:12,background:AM.input,
        border:`1px solid ${AM.inputBdr}`}}>
        <p style={{margin:0,fontSize:13,fontWeight:600,color:AM.text}}>
          {detections.length} total detections
        </p>
        <p style={{margin:'4px 0 0',fontSize:11,color:AM.sub}}>
          {detections.filter(d=>d.status==='verified').length} verified ·{' '}
          {detections.filter(d=>d.status==='unverified').length} pending
        </p>
      </div>
    </div>
  );
}

// ─── Map Controls (top-right floating) ───────────────────────────────────────

function MapControls({ onZoomIn, onZoomOut, onLocate, showDetections, onToggleDetections }) {
  return (
    <div style={{
      position:'absolute',right:16,bottom:80,zIndex:1000,
      display:'flex',flexDirection:'column',gap:2,
      background:AM.panel,borderRadius:12,overflow:'hidden',
      border:`1px solid ${AM.sidebarBdr}`,
      boxShadow:'0 10px 30px rgba(0,0,0,0.22)',
    }}>
      {[
        {
          fn:onToggleDetections,
          icon:showDetections ? <Eye size={16}/> : <EyeOff size={16}/>,
          title:showDetections ? 'Hide detections' : 'Show detections',
          active:showDetections,
        },
        { fn:onZoomIn,  icon:<Plus size={16}/>,        title:'Zoom in'     },
        { fn:onZoomOut, icon:<Minus size={16}/>,       title:'Zoom out'    },
        { fn:onLocate,  icon:<LocateFixed size={15}/>, title:'My location' },
      ].map(({fn,icon,title,active},i,arr)=>(
        <React.Fragment key={title}>
          <button onClick={fn} title={title} className="rsm-btn-icon"
            aria-pressed={title.includes('detections') ? active : undefined}
            style={{
              width:38,height:38,
              color:active ? AM.accent : AM.text,
              background:active ? AM.accentDim : undefined,
            }}>
            {icon}
          </button>
          {i<arr.length-1&&<div style={{height:1,background:AM.divider,margin:'0 8px'}}/>}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Compass ─────────────────────────────────────────────────────────────────

function Compass() {
  return (
    <div style={{
      position:'absolute',right:16,top:16,zIndex:1000,
      width:38,height:38,borderRadius:'50%',
      background:AM.panel,border:`1px solid ${AM.sidebarBdr}`,
      boxShadow:'0 10px 30px rgba(0,0,0,0.22)',
      display:'flex',alignItems:'center',justifyContent:'center',
    }}>
      <svg width="18" height="18" viewBox="0 0 18 18">
        <polygon points="9,2 11,9 9,8 7,9" fill="#ff3b30"/>
        <polygon points="9,16 7,9 9,10 11,9" fill="#888"/>
        <text x="9" y="4.5" textAnchor="middle" fontSize="4" fill="#fff" fontWeight="700">N</text>
      </svg>
    </div>
  );
}

// ─── Stats Pill ───────────────────────────────────────────────────────────────

function StatsPill({ detections }) {
  const counts = detections.reduce((a,d)=>{ const key = hazardType(d); a[key]=(a[key]||0)+1; return a; },{});
  return (
    <div style={{
      position:'absolute',top:16,left:'50%',transform:'translateX(-50%)',
      zIndex:1000,display:'flex',alignItems:'center',gap:4,
      padding:'7px 14px',borderRadius:20,
      background:AM.panel,border:`1px solid ${AM.sidebarBdr}`,
      boxShadow:'0 10px 30px rgba(0,0,0,0.22)',
      fontSize:11,fontWeight:600,whiteSpace:'nowrap',
    }}>
      {Object.entries(HAZARD_STYLE).map(([k,v])=>(
        <span key={k} style={{display:'flex',alignItems:'center',gap:4,padding:'2px 7px',
          borderRadius:10,background:`${v.fill}18`}}>
          <span style={{width:7,height:7,borderRadius:'50%',background:v.fill,display:'inline-block'}}/>
          <span style={{color:v.fill}}>{counts[k]||0}</span>
        </span>
      ))}
      <span style={{width:1,height:14,background:AM.divider,margin:'0 4px'}}/>
      <span style={{color:AM.text}}>{detections.length} total</span>
    </div>
  );
}

// ─── Detail Card ──────────────────────────────────────────────────────────────

function ClusterCard({ cluster, onClose, onSelectDetection, onZoom }) {
  const [filter, setFilter] = useState(null);
  if (!cluster?.detections?.length) return null;

  const makeGroups = (definitions, field) => Object.entries(definitions)
    .map(([key, config]) => ({
      key,
      label: config.label || config,
      color: config.fill || CLASS_COLOR[key] || AM.accent,
      detections: cluster.detections.filter((item) => item[field] === key),
    }))
    .filter((group) => group.detections.length);

  const hazardGroups = Object.entries(HAZARD_STYLE)
    .map(([key, config]) => ({
      key,
      label: config.label,
      color: config.fill,
      detections: cluster.detections.filter((item) => hazardType(item) === key),
    }))
    .filter((group) => group.detections.length);
  const classGroups = makeGroups(CLASS_LABEL, 'class_name');
  const groups = filter?.type === 'hazard' ? hazardGroups : classGroups;
  const selectedGroup = filter ? groups.find((group) => group.key === filter.key) : null;

  const groupButton = (group, type) => (
    <button
      key={group.key}
      onClick={() => setFilter({ type, key: group.key })}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
        border: `1px solid ${group.color}45`, background: `${group.color}14`, color: AM.text,
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: type === 'hazard' ? '50%' : 3, background: group.color }} />
      <span style={{ flex: 1, textAlign: 'left', fontSize: 11, fontWeight: 700 }}>{group.label}</span>
      <span style={{ color: group.color, fontSize: 12, fontWeight: 800 }}>{group.detections.length}</span>
    </button>
  );

  return (
    <div className="rsm-slide-up" style={{
      position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 1001, width: 330, maxHeight: 'min(520px, calc(100% - 48px))',
      overflow: 'hidden', background: AM.panel, border: `1px solid ${AM.sidebarBdr}`,
      borderRadius: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
    }}>
      <div style={{ padding: '13px 15px', borderBottom: `1px solid ${AM.divider}`, display: 'flex', alignItems: 'center', gap: 9 }}>
        {filter && (
          <button onClick={() => setFilter(null)} className="rsm-btn-icon" style={{ width: 26, height: 26, color: AM.sub, fontSize: 18 }}>‹</button>
        )}
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, color: AM.text, fontSize: 14, fontWeight: 800 }}>
            {selectedGroup ? selectedGroup.label : `${cluster.detections.length} nearby detections`}
          </p>
          <p style={{ margin: '2px 0 0', color: AM.sub, fontSize: 11 }}>
            {selectedGroup ? 'Select one to view its full details.' : 'Group by hazard type or road class.'}
          </p>
        </div>
        {!filter && (
          <button onClick={onZoom} style={{
            border: `1px solid ${AM.inputBdr}`, background: AM.input, color: AM.accent,
            borderRadius: 8, padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>Zoom</button>
        )}
        <button onClick={onClose} className="rsm-btn-icon" style={{ width: 26, height: 26, color: AM.sub }}><X size={14} /></button>
      </div>

      <div style={{ padding: 12, maxHeight: 410, overflowY: 'auto' }}>
        {selectedGroup ? (
          <div style={{ display: 'grid', gap: 7 }}>
            {selectedGroup.detections.map((detection) => {
              const severity = hazardStyle(detection);
              return (
                <button key={detection.detection_id} onClick={() => onSelectDetection(detection)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 11px', borderRadius: 11, cursor: 'pointer', textAlign: 'left',
                  border: `1px solid ${severity.fill}40`, background: `${severity.fill}12`, color: AM.text,
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: severity.fill }} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 750 }}>
                      {CLASS_LABEL[detection.class_name] || detection.class_name}
                    </span>
                    <span style={{ display: 'block', marginTop: 2, color: AM.sub, fontSize: 10 }}>
                      {(detection.confidence * 100).toFixed(1)}% confidence
                    </span>
                  </span>
                  <ArrowRight size={14} color={severity.fill} />
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <p style={{ margin: '0 0 7px', color: AM.sub, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Hazard Type</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {hazardGroups.map((group) => groupButton(group, 'hazard'))}
            </div>
            <p style={{ margin: '13px 0 7px', color: AM.sub, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Road class</p>
            <div style={{ display: 'grid', gap: 7 }}>
              {classGroups.map((group) => groupButton(group, 'class'))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AuthenticatedDetectionImage({ src, alt, style, onError }) {
  const requiresAuth = src?.includes('/api/detections/');
  const [objectUrl, setObjectUrl] = useState(null);

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
        setObjectUrl(createdUrl);
      })
      .catch(() => {
        if (active) onError?.();
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src, requiresAuth, onError]);

  if (requiresAuth && !objectUrl) {
    return <ImageIcon size={24} style={{ color: AM.muted }} />;
  }
  return <img src={objectUrl || src} alt={alt} style={style} onError={onError} />;
}

function DetailCard({ detection, isGuest, onStatusUpdate, updating, onClose, onLocate, onStartMove, moving, onViewDetection, onOpenImage }) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [detection?.detection_id, detection?.image_url]);

  if (!detection) return null;
  const sev = hazardStyle(detection);
  const coordinates = `${detection.latitude?.toFixed(4)}, ${detection.longitude?.toFixed(4)}`;

  const openLocation = () => {
    if (detection.latitude == null || detection.longitude == null) return;
    onLocate?.(detection);
  };

  const row = (label, value) => (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
      padding:'7px 0',borderBottom:`1px solid ${AM.divider}`}}>
      <span style={{fontSize:11,color:AM.sub,textTransform:'uppercase',letterSpacing:'0.06em'}}>{label}</span>
      <span style={{fontSize:12,color:AM.text,fontWeight:600}}>{value}</span>
    </div>
  );

  const actionBtn = (onClick, icon, label, color) => (
    <button onClick={onClick} disabled={updating===detection.detection_id}
      style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
        padding:'9px 0',borderRadius:10,border:'none',cursor:'pointer',
        background:`${color}22`,color,fontSize:12,fontWeight:700,
        transition:'all 0.15s',opacity:updating===detection.detection_id?0.5:1}}>
      {React.cloneElement(icon,{size:13})} {label}
    </button>
  );

  return (
    <div style={{
      position:'absolute',bottom:24,left:'50%',transform:'translateX(-50%)',
      zIndex:1000,width:300,
      background:AM.panel,border:`1px solid ${AM.sidebarBdr}`,
      borderRadius:20,overflow:'hidden',
      boxShadow:'0 10px 30px rgba(0,0,0,0.22)',
    }} className="rsm-slide-up">
      <div style={{padding:'14px 16px 10px',display:'flex',alignItems:'center',gap:10,
        borderBottom:`1px solid ${AM.divider}`}}>
        <div style={{width:36,height:36,borderRadius:12,display:'flex',alignItems:'center',
          justifyContent:'center',background:`${sev.fill}22`,fontSize:18,flexShrink:0}}>
          {CLASS_ICON[detection.class_name]||'📍'}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{margin:0,fontSize:14,fontWeight:700,color:AM.text}}>
            {CLASS_LABEL[detection.class_name]||detection.class_name}
          </p>
          <p style={{margin:0,fontSize:11,color:sev.fill,fontWeight:600,marginTop:2}}>
            ● {detection.severity} severity
          </p>
        </div>
        <button onClick={onClose} style={{width:24,height:24,borderRadius:'50%',border:'none',
          cursor:'pointer',background:AM.input,color:AM.sub,fontSize:13,
          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</button>
      </div>

      <div style={{padding:'4px 16px 10px'}}>
        {row('Confidence', `${(detection.confidence*100).toFixed(1)}%`)}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
          padding:'7px 0',borderBottom:`1px solid ${AM.divider}`,gap:10}}>
          <span style={{fontSize:11,color:AM.sub,textTransform:'uppercase',letterSpacing:'0.06em'}}>Coordinates</span>
          <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
            <button onClick={openLocation} title="Center this hazard on the map" style={{display:'flex',alignItems:'center',gap:5,
              padding:'5px 7px',borderRadius:8,border:`1px solid ${AM.inputBdr}`,
              background:AM.input,color:AM.text,fontFamily:'monospace',fontSize:11,
              fontWeight:700,cursor:'pointer'}}>
              <MapPin size={12} color={AM.accent}/> {coordinates}
            </button>
            {!isGuest && (
              <button
                onClick={()=>onStartMove?.(detection)}
                title="Select a better road position"
                style={{display:'flex',alignItems:'center',justifyContent:'center',
                  width:28,height:28,borderRadius:8,border:`1px solid ${AM.inputBdr}`,
                  background:moving?AM.accentDim:AM.input,color:moving?AM.accent:AM.sub,
                  cursor:'pointer'}}
              >
                <LocateFixed size={14}/>
              </button>
            )}
          </div>
        </div>
        {moving && (
          <div style={{marginTop:8,padding:'8px 10px',borderRadius:9,
            background:'rgba(10,132,255,0.14)',border:`1px solid ${AM.inputBdr}`,
            color:AM.text,fontSize:11,fontWeight:700}}>
            Click the correct spot on the road to save this detection location.
          </div>
        )}
        {row('Detected', new Date(detection.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}))}
        <div style={{marginTop:10,borderRadius:10,overflow:'hidden',border:`1px solid ${AM.inputBdr}`,
          background:AM.input,minHeight:110,display:'flex',alignItems:'center',justifyContent:'center'}}>
          {detection.image_url && !imageFailed ? (
            <button
              type="button"
              onClick={() => onOpenImage?.(detection)}
              title="View detection image"
              style={{width:'100%',height:110,padding:0,border:0,background:'transparent',cursor:'pointer'}}
            >
              <AuthenticatedDetectionImage
                key={detection.image_url}
                src={detection.image_url}
                alt={`${CLASS_LABEL[detection.class_name] || 'Detection'} crop`}
                style={{width:'100%',height:110,objectFit:'cover',display:'block'}}
                onError={() => setImageFailed(true)}
              />
            </button>
          ) : (
            <div style={{height:110,width:'100%',display:'flex',flexDirection:'column',
              alignItems:'center',justifyContent:'center',gap:8,color:AM.sub}}>
              <ImageIcon size={24}/>
              <span style={{fontSize:11,fontWeight:700}}>No output image available</span>
            </div>
          )}
        </div>
        {onViewDetection && (
          <button
            type="button"
            onClick={() => onViewDetection(detection)}
            style={{width:'100%',marginTop:8,padding:'8px 10px',borderRadius:9,
              border:`1px solid ${AM.inputBdr}`,background:AM.accentDim,
              color:AM.accent,fontSize:11,fontWeight:700,cursor:'pointer'}}
          >
            View detection row
          </button>
        )}
      </div>

      {!isGuest && detection.status==='unverified' && (
        <div style={{display:'flex',gap:8,padding:'0 16px 14px'}}>
          {actionBtn(()=>onStatusUpdate(detection.detection_id,'verified'),<CheckCircle/>,'Verify','#34c759')}
          {actionBtn(()=>onStatusUpdate(detection.detection_id,'false_positive'),<XCircle/>,'False +','#ff3b30')}
        </div>
      )}
      {!isGuest && detection.status==='verified' && (
        <div style={{padding:'0 16px 14px'}}>
          {actionBtn(()=>onStatusUpdate(detection.detection_id,'fixed'),<CheckCircle/>,'Mark as Fixed',AM.accent)}
        </div>
      )}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position:'absolute',top:16,left:'50%',transform:'translateX(-50%)',
      zIndex:2000,padding:'10px 20px',borderRadius:20,
      background: toast.type==='error'?'rgba(255,59,48,0.95)':'rgba(52,199,89,0.95)',
      color:'#fff',fontSize:13,fontWeight:700,
      boxShadow:'0 4px 20px rgba(0,0,0,0.3)',
    }} className="rsm-slide-up">
      {toast.msg}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RoadSenseMap({ isGuest = false, className = '', defaultDark = true, style = {}, focusDetection = null, onViewDetection }) {
  const mapRef         = useRef(null);
  const leafletRef     = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileRef        = useRef(null);
  const clusterRef     = useRef(null);
  const markersRef     = useRef([]);

  const [detections,   setDetections]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [clusterSelection, setClusterSelection] = useState(null);
  const [updating,     setUpdating]     = useState(null);
  const [filteredDets, setFilteredDets] = useState(null);
  const [toast,        setToast]        = useState(null);
  const [panel,        setPanel]        = useState('search');
  const [movingDet,    setMovingDet]    = useState(null);
  const [showDetections, setShowDetections] = useState(true);
  const [imageViewerDetection, setImageViewerDetection] = useState(null);

  useEffect(() => { injectCSS(); }, []);

  const showToast = (msg, type='success') => {
    setToast({msg,type});
    setTimeout(()=>setToast(null),3000);
  };

  const loadDetections = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.getDetections({ limit: 500 });
      let data = res.detections || [];
      if (isGuest) data = data.filter(d=>d.status==='verified');
      setDetections(data);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [isGuest]);

  useEffect(() => { loadDetections(); }, [loadDetections]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !movingDet) return;

    const handleClick = async (event) => {
      const latitude = event.latlng.lat;
      const longitude = event.latlng.lng;
      const detectionId = movingDet.detection_id;

      setUpdating(detectionId);
      try {
        await api.updateDetectionLocation(detectionId, latitude, longitude);
        const update = d => d.detection_id === detectionId
          ? { ...d, latitude, longitude }
          : d;
        setDetections(prev => prev.map(update));
        setFilteredDets(prev => prev ? prev.map(update) : prev);
        setSelected(prev => prev?.detection_id === detectionId ? update(prev) : prev);
        setMovingDet(null);
        showToast('Location updated');
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        setUpdating(null);
      }
    };

    map.getContainer().style.cursor = 'crosshair';
    map.on('click', handleClick);

    return () => {
      map.off('click', handleClick);
      map.getContainer().style.cursor = '';
    };
  }, [movingDet]);

  // Init Leaflet
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!mapRef.current || mapInstanceRef.current) return;
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !mapRef.current) return;

      leafletRef.current = L.default || L;
      const Lf = leafletRef.current;
      window.L = Lf;
      await import('leaflet.markercluster');

      const map = Lf.map(mapRef.current, {
        center: PH_CENTER, zoom: DEFAULT_ZOOM,
        zoomControl: false, attributionControl: true,
      });

      tileRef.current = Lf.tileLayer(TILE_DARK, {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        className: 'rsm-apple-tile',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // Render markers
  const activeDetections = filteredDets ?? detections;

  useEffect(() => {
    const map = mapInstanceRef.current;
    const Lf  = leafletRef.current;
    if (!map || !Lf) return;

    markersRef.current.forEach(m=>m.remove());
    markersRef.current = [];
    if (clusterRef.current) { map.removeLayer(clusterRef.current); clusterRef.current = null; }
    if (!showDetections || !activeDetections.length) return;

    const pins = activeDetections.map(d => {
      const icon   = makeIcon(Lf, d, isGuest);
      const marker = Lf.marker([d.latitude, d.longitude], { icon });
      marker.__detection = d;
      marker.on('click', ()=>{
        setClusterSelection(null);
        setSelected(d);
      });
      return marker;
    });
    markersRef.current.push(...pins);

    try {
      const MC = window.L?.markerClusterGroup;
      if (MC) {
        const cl = MC({
          maxClusterRadius: 55,
          zoomToBoundsOnClick: false,
          iconCreateFunction: c => {
            const n = c.getChildCount();
            const clusterDetections = c.getAllChildMarkers().map(marker => marker.__detection).filter(Boolean);
            const colors = [...new Set(clusterDetections.map(d => hazardStyle(d).fill))];
            const dots = colors.slice(0, 4).map(color =>
              `<span style="width:8px;height:8px;border-radius:50%;background:${color};border:1px solid rgba(255,255,255,.75)"></span>`
            ).join('');
            return Lf.divIcon({
              html:`<div style="height:36px;min-width:72px;padding:0 10px;background:${AM.panel};color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:5px;font-weight:800;font-size:12px;box-shadow:0 5px 18px rgba(0,0,0,.35);border:1px solid ${AM.sidebarBdr}"><span style="display:flex;gap:3px">${dots}</span><span>${n}</span></div>`,
              className:'',
              iconSize:[Math.max(72, Math.min(116, 58 + colors.length * 8)),36],
            });
          },
        });
        cl.on('clusterclick', event => {
          const clusterDetections = event.layer
            .getAllChildMarkers()
            .map(marker => marker.__detection)
            .filter(Boolean);
          setSelected(null);
          setClusterSelection({
            detections: clusterDetections,
            bounds: event.layer.getBounds(),
          });
        });
        pins.forEach(m=>cl.addLayer(m));
        map.addLayer(cl);
        clusterRef.current = cl;
      } else { pins.forEach(m=>m.addTo(map)); }
    } catch { pins.forEach(m=>m.addTo(map)); }

    if (activeDetections.length > 0) {
      try {
        const b = Lf.latLngBounds(activeDetections.map(d=>[d.latitude,d.longitude]));
        map.fitBounds(b,{padding:[60,60],maxZoom:13});
      } catch {}
    }
  }, [detections, isGuest, filteredDets, showDetections]);

  const flyTo = useCallback((latlng, zoom=14) => {
    mapInstanceRef.current?.setView(latlng, zoom, {animate:true});
  }, []);

  useEffect(() => {
    if (!focusDetection || !mapInstanceRef.current) return;

    const detection = detections.find(d => d.detection_id === focusDetection.detection_id)
      || focusDetection;
    if (detection?.latitude == null || detection?.longitude == null) return;

    setShowDetections(true);
    flyTo([detection.latitude, detection.longitude], 18);
    setSelected(detection);
  }, [focusDetection, detections, flyTo]);

  const handleStatusUpdate = async (detectionId, newStatus) => {
    setUpdating(detectionId);
    try {
      await api.updateDetectionStatus(detectionId, newStatus);
      setDetections(prev=>prev.map(d=>d.detection_id===detectionId?{...d,status:newStatus}:d));
      setSelected(prev=>prev?.detection_id===detectionId?{...prev,status:newStatus}:prev);
      showToast(newStatus==='verified'?'Verified ✓':newStatus==='false_positive'?'Marked false positive':'Fixed ✓');
    } catch(e) { showToast(e.message,'error'); }
    finally { setUpdating(null); }
  };

  const startMove = useCallback((detection) => {
    setMovingDet(detection);
    setSelected(detection);
    flyTo([detection.latitude, detection.longitude], 18);
    showToast('Click the correct road spot');
  }, [flyTo]);

  return (
    <div className={`rsm-wrap ${className}`}
      style={{
        position:'relative',width:'100%',height:'100%',minHeight:0,
        display:'flex',borderRadius:20,overflow:'hidden',
        background:AM.sidebar,
        ...style,
      }}>

      {/* Left Sidebar */}
      <Sidebar
        panel={panel} setPanel={setPanel}
        detections={detections}
        onFlyTo={flyTo}
        onFilteredDetections={setFilteredDets}
        mapInstance={mapInstanceRef.current}
      />

      {/* Map area */}
      <div style={{flex:1,position:'relative',overflow:'hidden'}}>

        {/* Loading overlay */}
        {loading && (
          <div style={{position:'absolute',inset:0,zIndex:1500,display:'flex',
            alignItems:'center',justifyContent:'center',
            background:'rgba(0,0,0,0.5)',backdropFilter:'blur(6px)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,color:AM.text,fontSize:13,fontWeight:600}}>
              <div style={{width:18,height:18,border:'2px solid rgba(255,255,255,0.2)',
                borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
              Loading map…
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && !loading && (
          <div style={{position:'absolute',inset:0,zIndex:1500,display:'flex',
            alignItems:'center',justifyContent:'center',padding:24,
            background:'rgba(0,0,0,0.45)',backdropFilter:'blur(6px)'}}>
            <div style={{padding:'16px 20px',borderRadius:16,background:AM.sidebar,
              display:'flex',alignItems:'center',gap:12,maxWidth:340,
              boxShadow:'0 4px 24px rgba(0,0,0,0.5)'}}>
              <AlertCircle size={18} style={{color:'#ff3b30',flexShrink:0}}/>
              <span style={{fontSize:13,color:AM.text,flex:1}}>{error}</span>
              <button onClick={loadDetections} style={{padding:'6px 12px',borderRadius:10,border:'none',
                cursor:'pointer',background:AM.accentDim,color:AM.accent,fontSize:12,fontWeight:700}}>
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Map DOM */}
        <div ref={mapRef} style={{width:'100%',height:'100%',minHeight:0}}/>

        {/* Floating controls */}
        {!loading && !error && (
          <>
            <Toast toast={toast}/>
            <StatsPill detections={activeDetections}/>
            {movingDet && (
              <div style={{position:'absolute',top:58,left:'50%',transform:'translateX(-50%)',
                zIndex:1000,display:'flex',alignItems:'center',gap:8,
                padding:'8px 12px',borderRadius:16,background:AM.panel,
                border:`1px solid ${AM.sidebarBdr}`,color:AM.text,fontSize:12,
                fontWeight:700,boxShadow:'0 10px 30px rgba(0,0,0,0.22)'}}>
                <LocateFixed size={14} color={AM.accent}/>
                Click the road to reposition this detection
                <button onClick={()=>setMovingDet(null)} style={{border:'none',background:AM.input,
                  color:AM.sub,borderRadius:8,padding:'4px 7px',cursor:'pointer',
                  fontSize:11,fontWeight:700}}>
                  Cancel
                </button>
              </div>
            )}
            <Compass/>
            <MapControls
              showDetections={showDetections}
              onToggleDetections={() => {
                if (showDetections) {
                  setSelected(null);
                  setClusterSelection(null);
                  setMovingDet(null);
                }
                setShowDetections(!showDetections);
              }}
              onZoomIn  ={()=>mapInstanceRef.current?.zoomIn()}
              onZoomOut ={()=>mapInstanceRef.current?.zoomOut()}
              onLocate  ={()=>{
                navigator.geolocation?.getCurrentPosition(
                  p=>flyTo([p.coords.latitude,p.coords.longitude],14),
                  ()=>showToast('Location unavailable','error')
                );
              }}
            />
            {/* Refresh */}
            <button onClick={loadDetections} style={{
              position:'absolute',bottom:24,right:16,zIndex:1000,
              display:'flex',alignItems:'center',gap:6,
              padding:'8px 14px',borderRadius:20,border:`1px solid ${AM.sidebarBdr}`,
              cursor:'pointer',background:AM.panel,
              color:AM.text,fontSize:12,fontWeight:600,
              boxShadow:'0 2px 12px rgba(0,0,0,0.3)',
            }}>
              <RefreshCw size={13}/> Refresh
            </button>

            {/* Guest badge */}
            {isGuest && (
              <div style={{position:'absolute',bottom:24,left:16,zIndex:1000,
                display:'flex',alignItems:'center',gap:6,
                padding:'7px 13px',borderRadius:20,
                background:AM.panel,border:'1px solid rgba(255,159,10,0.4)',
                color:'#ff9f0a',fontSize:12,fontWeight:700,
                boxShadow:'0 2px 12px rgba(0,0,0,0.3)'}}>
                <Eye size={13}/> Verified only
              </div>
            )}
          </>
        )}

        <ClusterCard
          cluster={clusterSelection}
          onClose={() => setClusterSelection(null)}
          onZoom={() => {
            if (clusterSelection?.bounds) {
              mapInstanceRef.current?.fitBounds(clusterSelection.bounds, { padding: [50, 50] });
            }
          }}
          onSelectDetection={(detection) => {
            setClusterSelection(null);
            setSelected(detection);
            flyTo([detection.latitude, detection.longitude], 18);
          }}
        />

        {/* Detail card */}
        <DetailCard
          detection={selected} isGuest={isGuest}
          onStatusUpdate={handleStatusUpdate} updating={updating}
          onLocate={(d) => {
            flyTo([d.latitude, d.longitude], 18);
            setSelected(d);
          }}
          onStartMove={startMove}
          moving={movingDet?.detection_id === selected?.detection_id}
          onViewDetection={onViewDetection}
          onOpenImage={setImageViewerDetection}
          onClose={()=>{
            setSelected(null);
            setMovingDet(null);
          }}
        />
        <DetectionFrameModal
          detection={imageViewerDetection}
          onClose={() => setImageViewerDetection(null)}
        />
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
