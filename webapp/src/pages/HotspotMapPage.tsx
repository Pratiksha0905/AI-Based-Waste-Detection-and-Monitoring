import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { AlertCircle, Filter, MapPin, Search } from 'lucide-react';
import { hotspotsApi, type HotspotOut } from '../api/endpoints';
import type { Severity } from '../api/endpoints';
import SeverityBadge from '../components/SeverityBadge';
import { formatTimestamp, severityMarkerColor } from '../utils/display';
import 'leaflet/dist/leaflet.css';

const severities: Severity[] = ['low', 'medium', 'high', 'critical'];

export default function HotspotMapPage() {
  const [hotspots, setHotspots] = useState<HotspotOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedSeverities, setSelectedSeverities] = useState<Severity[]>(severities);
  const [selected, setSelected] = useState<HotspotOut | null>(null);

  useEffect(() => {
    let active = true;
    hotspotsApi.get()
      .then((response) => {
        if (active) setHotspots(response.items);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load hotspot data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => hotspots.filter((hotspot) => {
    if (!selectedSeverities.includes(hotspot.severity)) return false;
    const text = `${hotspot.id} ${hotspot.dominant_category ?? ''} ${hotspot.latitude} ${hotspot.longitude}`.toLowerCase();
    return text.includes(query.toLowerCase());
  }), [hotspots, query, selectedSeverities]);

  const center: [number, number] = hotspots.length
    ? [hotspots[0].latitude, hotspots[0].longitude]
    : [20.5937, 78.9629];

  function toggleSeverity(severity: Severity) {
    setSelectedSeverities((current) => current.includes(severity)
      ? current.filter((value) => value !== severity)
      : [...current, severity]);
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-3.5rem)] flex-col lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 bg-white lg:w-80 lg:border-b-0 lg:border-r">
        <div className="space-y-4 border-b border-gray-100 p-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input className="input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search category or coordinates" aria-label="Search hotspots" />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <Filter size={12} /> Severity
            </div>
            <div className="flex flex-wrap gap-1.5">
              {severities.map((severity) => (
                <button
                  key={severity}
                  type="button"
                  className={`rounded-full border px-2.5 py-1 text-xs capitalize ${selectedSeverities.includes(severity) ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-gray-300 bg-white text-gray-600'}`}
                  aria-pressed={selectedSeverities.includes(severity)}
                  onClick={() => toggleSeverity(severity)}
                >
                  {severity}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Report clusters</h2>
          <span className="text-xs text-gray-500">{filtered.length} shown</span>
        </div>
        {error && (
          <div className="m-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800" role="alert">
            <AlertCircle size={14} className="shrink-0" />{error}
          </div>
        )}
        {loading ? (
          <div className="space-y-3 p-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton h-12 rounded" />)}</div>
        ) : filtered.length ? (
          <ul className="max-h-64 flex-1 divide-y divide-gray-100 overflow-y-auto lg:max-h-none">
            {filtered.map((hotspot) => (
              <li key={hotspot.id}>
                <button type="button" className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${selected?.id === hotspot.id ? 'bg-emerald-50' : ''}`} onClick={() => setSelected(hotspot)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-gray-700">{hotspot.latitude.toFixed(5)}, {hotspot.longitude.toFixed(5)}</span>
                    <SeverityBadge severity={hotspot.severity} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {hotspot.report_count} reports · {hotspot.dominant_category ?? 'No AI category available'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          !loading && !error && (
            <div className="empty-state px-4 py-10">
              <MapPin size={24} className="mb-2 text-gray-300" />
              <p className="text-sm text-gray-600">{hotspots.length ? 'No clusters match these filters.' : 'No hotspot reports are available yet.'}</p>
            </div>
          )
        )}
      </aside>

      <div className="relative min-h-[420px] flex-1">
        {!loading && (
          <MapContainer center={center} zoom={hotspots.length ? 13 : 5} className="h-full min-h-[420px] w-full">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {filtered.map((hotspot) => (
              <CircleMarker
                key={hotspot.id}
                center={[hotspot.latitude, hotspot.longitude]}
                radius={Math.min(18, 7 + hotspot.report_count)}
                pathOptions={{ fillColor: hotspot.color || severityMarkerColor(hotspot.severity), color: '#fff', weight: 2, fillOpacity: 0.8 }}
                eventHandlers={{ click: () => setSelected(hotspot) }}
              >
                <Popup>
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold">{hotspot.report_count} reports in this cluster</p>
                    <p>{hotspot.latitude.toFixed(6)}, {hotspot.longitude.toFixed(6)}</p>
                    <p className="capitalize">Severity: {hotspot.severity}</p>
                    <p>Dominant category: {hotspot.dominant_category ?? 'Unavailable'}</p>
                    <p>Latest report: {hotspot.last_report_at ? formatTimestamp(hotspot.last_report_at) : 'Unavailable'}</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        )}
        {selected && (
          <div className="absolute bottom-4 right-4 z-[1000] max-w-xs rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900">Selected report cluster</p>
              <button type="button" className="text-xs text-gray-500 hover:text-gray-900" onClick={() => setSelected(null)} aria-label="Close cluster details">Close</button>
            </div>
            <p className="mt-2 font-mono text-xs text-gray-600">{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</p>
            <p className="mt-2 text-sm text-gray-700">{selected.report_count} reports · {selected.dominant_category ?? 'AI category unavailable'}</p>
            <div className="mt-2"><SeverityBadge severity={selected.severity} /></div>
            <p className="mt-2 text-xs text-gray-500">Latest report: {selected.last_report_at ? formatTimestamp(selected.last_report_at) : 'Unavailable'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
