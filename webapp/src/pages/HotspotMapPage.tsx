import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { MapPin, Search, Filter, AlertTriangle, Info, List } from 'lucide-react';
import type { Hotspot, Severity } from '../types/observation';
import { getHotspots } from '../services/analysisService';
import SeverityBadge from '../components/SeverityBadge';
import { formatTimestamp, severityMarkerColor } from '../utils/display';
import 'leaflet/dist/leaflet.css';

const ALL_SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical'];

const SEVERITY_LABELS: Record<Severity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

// ── Map center (Bengaluru) ────────────────────────────────────────────────────
const MAP_CENTER: [number, number] = [12.9716, 77.5946];
const MAP_ZOOM = 11;

// ── Hotspot Map Page ──────────────────────────────────────────────────────────

const HotspotMapPage: React.FC = () => {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSeverities, setActiveSeverities] = useState<Severity[]>([...ALL_SEVERITIES]);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    getHotspots().then((hs) => {
      setHotspots(hs);
      setLoading(false);
    });
  }, []);

  const toggleSeverity = (sev: Severity) => {
    setActiveSeverities((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev],
    );
  };

  const filtered = useMemo(() => {
    return hotspots.filter((hs) => {
      if (!activeSeverities.includes(hs.severity)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          hs.locationName.toLowerCase().includes(q) ||
          hs.district.toLowerCase().includes(q) ||
          hs.dominantCategory.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [hotspots, activeSeverities, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Demo notice ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border-b border-violet-200 text-xs text-violet-700 flex-shrink-0">
        <Info size={13} aria-hidden="true" />
        <span>
          <strong>Demonstration locations only.</strong> Coordinates are sample data in Bengaluru, India.
          These do not represent actual municipal waste observations.
        </span>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* ── Side panel ───────────────────────────────────────────────────── */}
        <aside className="lg:w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
          {/* Filters */}
          <div className="p-4 border-b border-gray-100 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                className="input pl-9"
                placeholder="Search location…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search hotspot locations"
              />
            </div>

            {/* Severity filter */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Filter size={12} className="text-gray-400" aria-hidden="true" />
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Severity
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_SEVERITIES.map((sev) => (
                  <button
                    key={sev}
                    onClick={() => toggleSeverity(sev)}
                    aria-pressed={activeSeverities.includes(sev)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                      activeSeverities.includes(sev)
                        ? sev === 'low' ? 'bg-emerald-500 text-white border-emerald-500' :
                          sev === 'medium' ? 'bg-amber-500 text-white border-amber-500' :
                          sev === 'high' ? 'bg-orange-500 text-white border-orange-500' :
                          'bg-red-500 text-white border-red-500'
                        : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {SEVERITY_LABELS[sev]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Hotspot list */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <List size={13} className="text-gray-400" aria-hidden="true" />
                <span className="text-xs font-semibold text-gray-600">
                  Locations
                </span>
              </div>
              <span className="text-xs text-gray-400">{filtered.length} shown</span>
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="skeleton h-4 w-3/4 rounded" />
                    <div className="skeleton h-3 w-1/2 rounded" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-state py-10">
                <MapPin size={24} className="text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No locations match filters</p>
              </div>
            ) : (
              <ul>
                {filtered.map((hs) => (
                  <li key={hs.id}>
                    <button
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        selectedHotspot?.id === hs.id ? 'bg-emerald-50 border-l-2 border-l-emerald-600' : ''
                      }`}
                      onClick={() => setSelectedHotspot(hs === selectedHotspot ? null : hs)}
                      aria-pressed={selectedHotspot?.id === hs.id}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{hs.locationName}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{hs.district}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {hs.observationCount} obs · {hs.totalDetections} detections · {hs.dominantCategory}
                          </p>
                        </div>
                        <SeverityBadge severity={hs.severity} showDot={false} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Legend */}
          <div className="p-4 border-t border-gray-100">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Legend</p>
            <div className="space-y-1.5">
              {ALL_SEVERITIES.map((sev) => (
                <div key={sev} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: severityMarkerColor(sev) }}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-gray-600">{SEVERITY_LABELS[sev]}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Map ────────────────────────────────────────────────────────────── */}
        <div className="flex-1 relative min-h-64">
          {mapError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 gap-3">
              <AlertTriangle size={28} className="text-amber-500" />
              <p className="text-sm font-medium text-gray-700">Map tiles unavailable</p>
              <p className="text-xs text-gray-500">OpenStreetMap could not be loaded. Check internet connection.</p>
            </div>
          ) : (
            <MapContainer
              center={MAP_CENTER}
              zoom={MAP_ZOOM}
              className="h-full w-full"
              style={{ minHeight: '400px' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                eventHandlers={{
                  tileerror: () => setMapError(true),
                }}
              />

              {filtered.map((hs) => (
                <CircleMarker
                  key={hs.id}
                  center={[hs.coordinates.lat, hs.coordinates.lng]}
                  radius={hs.severity === 'critical' ? 16 : hs.severity === 'high' ? 12 : 9}
                  pathOptions={{
                    fillColor: severityMarkerColor(hs.severity),
                    fillOpacity: 0.75,
                    color: 'white',
                    weight: 2,
                  }}
                  eventHandlers={{
                    click: () => setSelectedHotspot(hs),
                  }}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <p className="font-semibold text-gray-900 text-sm">{hs.locationName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{hs.district}</p>
                      <div className="mt-2 space-y-1 text-xs text-gray-700">
                        <p><span className="text-gray-500">Severity:</span> <span className="font-medium capitalize">{hs.severity}</span></p>
                        <p><span className="text-gray-500">Observations:</span> {hs.observationCount}</p>
                        <p><span className="text-gray-500">Total detections:</span> {hs.totalDetections}</p>
                        <p><span className="text-gray-500">Dominant:</span> {hs.dominantCategory}</p>
                        <p><span className="text-gray-500">Last seen:</span> {formatTimestamp(hs.lastSeen)}</p>
                      </div>
                      <p className="text-[10px] text-violet-600 mt-2 border-t border-gray-100 pt-1.5">
                        Demonstration location — not a real observation
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          )}

          {/* Selected hotspot detail overlay */}
          {selectedHotspot && (
            <div className="absolute bottom-4 right-4 bg-white border border-gray-200 rounded-xl shadow-lg p-4 max-w-xs w-full fade-in z-[1000]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selectedHotspot.locationName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedHotspot.district}</p>
                </div>
                <button
                  onClick={() => setSelectedHotspot(null)}
                  className="text-gray-400 hover:text-gray-600 p-0.5"
                  aria-label="Close hotspot detail"
                >
                  ×
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <SeverityBadge severity={selectedHotspot.severity} />
                <span className="badge bg-gray-50 border-gray-200 text-gray-600">
                  {selectedHotspot.dominantCategory}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="font-semibold text-gray-800">{selectedHotspot.observationCount}</div>
                  <div className="text-gray-500">Observations</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="font-semibold text-gray-800">{selectedHotspot.totalDetections}</div>
                  <div className="text-gray-500">Detections</div>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-2">
                Last: {formatTimestamp(selectedHotspot.lastSeen)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HotspotMapPage;
