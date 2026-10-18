import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  X,
  Info,
  ClipboardList,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import type { Observation, WasteCategory, Severity } from '../types/observation';
import { getObservations } from '../services/analysisService';
import SeverityBadge from '../components/SeverityBadge';
import {
  formatTimestamp,
  categoryColor,
} from '../utils/display';

type SortKey = 'timestamp' | 'severity' | 'detections';
type SortDir = 'asc' | 'desc';

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const ALL_CATEGORIES: WasteCategory[] = [
  'Plastic', 'Organic', 'Glass', 'Metal', 'Paper',
  'Construction', 'E-waste', 'Textile', 'Hazardous', 'Mixed',
];

const ALL_SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical'];

const PAGE_SIZE = 8;

// ── Observation Detail Panel ──────────────────────────────────────────────────

const ObservationDetail: React.FC<{
  obs: Observation;
  onClose: () => void;
}> = ({ obs, onClose }) => (
  <div className="card fade-in">
    <div className="card-header flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Info size={14} className="text-gray-400" />
        <span className="section-title">Observation Detail</span>
      </div>
      <button
        onClick={onClose}
        className="btn-ghost p-1.5"
        aria-label="Close detail panel"
      >
        <X size={14} />
      </button>
    </div>
    <div className="card-body space-y-4">
      {/* Image name + location */}
      <div>
        <p className="text-base font-semibold text-gray-900">{obs.imageName}</p>
        <p className="text-sm text-gray-500 mt-0.5">
          {obs.location.name} · {obs.location.district}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{formatTimestamp(obs.timestamp)}</p>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <SeverityBadge severity={obs.severity} />
        {obs.location.isPotentialHotspot && (
          <span className="badge bg-orange-50 text-orange-700 border-orange-200">
            Potential Hotspot
          </span>
        )}
        <span className="badge bg-gray-50 border-gray-200 text-gray-600">
          {obs.detections.length} detection{obs.detections.length !== 1 ? 's' : ''}
        </span>
        <span className="badge badge-demo">Simulated</span>
      </div>

      {/* Detections */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-2">Detections</p>
        <div className="space-y-1.5">
          {obs.detections.map((det) => (
            <div
              key={det.id}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100"
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: categoryColor(det.category) }}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-gray-800">{det.category}</span>
              <span className="ml-auto text-xs text-gray-500 font-mono">
                {Math.round(det.confidence * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Depth */}
      {obs.depthResult && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1">Depth Estimation</p>
          <p className="text-xs text-gray-600">{obs.depthResult.description}</p>
          <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs">
            {[
              { label: 'Min', value: obs.depthResult.minRelativeDepth },
              { label: 'Mean', value: obs.depthResult.meanRelativeDepth },
              { label: 'Max', value: obs.depthResult.maxRelativeDepth },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-1.5">
                <div className="font-mono font-medium text-gray-800">{value.toFixed(2)}</div>
                <div className="text-gray-500">{label}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-violet-600 mt-1.5">MiDaS not connected — simulated values</p>
        </div>
      )}

      {/* Volume */}
      {obs.volumeEstimate && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1">Volume Estimate</p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-gray-800 font-mono">
              {obs.volumeEstimate.estimatedVolumeLitres?.toFixed(1) ?? 'N/A'}
            </span>
            <span className="text-xs text-gray-500">litres (simulated)</span>
          </div>
          <p className="text-[10px] text-amber-700 mt-1">{obs.volumeEstimate.caveat}</p>
        </div>
      )}

      {/* Tags */}
      {obs.tags.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {obs.tags.map((tag) => (
              <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

// ── History Page ──────────────────────────────────────────────────────────────

const HistoryPage: React.FC = () => {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<WasteCategory | ''>('');
  const [severityFilter, setSeverityFilter] = useState<Severity | ''>('');
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    getObservations().then((obs) => {
      setObservations(obs);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return observations.filter((obs) => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          obs.imageName.toLowerCase().includes(q) ||
          obs.location.name.toLowerCase().includes(q) ||
          obs.location.district.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (categoryFilter) {
        if (!obs.detections.some((d) => d.category === categoryFilter)) return false;
      }
      if (severityFilter) {
        if (obs.severity !== severityFilter) return false;
      }
      return true;
    });
  }, [observations, search, categoryFilter, severityFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'timestamp') {
        cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      } else if (sortKey === 'severity') {
        cmp = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      } else if (sortKey === 'detections') {
        cmp = a.detections.length - b.detections.length;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const getSortIcon = (col: SortKey) => {
    if (sortKey !== col) return <ChevronDown size={13} className="text-gray-300" />;
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="text-emerald-700" />
      : <ChevronDown size={13} className="text-emerald-700" />;
  };

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setSeverityFilter('');
    setPage(1);
  };

  return (
    <div className="p-5 max-w-7xl mx-auto">
      <div className="flex items-start gap-2 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700 mb-5">
        <Info size={13} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          All records are <strong>simulated demonstration observations</strong>. No actual images are stored or transmitted.
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ── Table panel ───────────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-4">
          {/* Filters */}
          <div className="card">
            <div className="card-body flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-48">
                <label htmlFor="history-search" className="text-xs font-medium text-gray-600 mb-1 block">
                  Search
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    id="history-search"
                    className="input pl-9"
                    placeholder="Image name, location…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
              </div>

              <div className="w-40">
                <label htmlFor="category-filter" className="text-xs font-medium text-gray-600 mb-1 block">
                  Category
                </label>
                <div className="relative">
                  <select
                    id="category-filter"
                    className="select"
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value as WasteCategory | ''); setPage(1); }}
                    aria-label="Filter by waste category"
                  >
                    <option value="">All categories</option>
                    {ALL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <Filter size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
                </div>
              </div>

              <div className="w-36">
                <label htmlFor="severity-filter" className="text-xs font-medium text-gray-600 mb-1 block">
                  Severity
                </label>
                <div className="relative">
                  <select
                    id="severity-filter"
                    className="select"
                    value={severityFilter}
                    onChange={(e) => { setSeverityFilter(e.target.value as Severity | ''); setPage(1); }}
                    aria-label="Filter by severity"
                  >
                    <option value="">All severities</option>
                    {ALL_SEVERITIES.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                  <Filter size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
                </div>
              </div>

              {(search || categoryFilter || severityFilter) && (
                <button
                  onClick={clearFilters}
                  className="btn-ghost text-xs mt-4"
                  aria-label="Clear all filters"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList size={14} className="text-gray-400" />
                <span className="section-title">Observation Records</span>
              </div>
              <span className="text-xs text-gray-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-10 rounded" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="empty-state py-12">
                <ClipboardList size={28} className="text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-500">No observations match</p>
                <button onClick={clearFilters} className="btn-secondary mt-3 text-xs">
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="scroll-x">
                <table className="data-table" aria-label="Observation history table">
                  <thead>
                    <tr>
                      <th>
                        <button
                          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                          onClick={() => toggleSort('timestamp')}
                          aria-label={`Sort by timestamp ${sortKey === 'timestamp' ? (sortDir === 'asc' ? 'descending' : 'ascending') : ''}`}
                        >
                          Timestamp {getSortIcon('timestamp')}
                        </button>
                      </th>
                      <th>Image</th>
                      <th>Location</th>
                      <th>Categories</th>
                      <th>
                        <button
                          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                          onClick={() => toggleSort('detections')}
                          aria-label={`Sort by detections`}
                        >
                          Det. {getSortIcon('detections')}
                        </button>
                      </th>
                      <th>
                        <button
                          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                          onClick={() => toggleSort('severity')}
                          aria-label={`Sort by severity`}
                        >
                          Severity {getSortIcon('severity')}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((obs) => (
                      <tr
                        key={obs.id}
                        onClick={() => setSelectedObs(obs === selectedObs ? null : obs)}
                        className={selectedObs?.id === obs.id ? 'bg-emerald-50' : ''}
                        aria-selected={selectedObs?.id === obs.id}
                      >
                        <td className="whitespace-nowrap text-[12px]">
                          {formatTimestamp(obs.timestamp)}
                        </td>
                        <td className="max-w-[140px]">
                          <span className="truncate block text-gray-800 font-medium">
                            {obs.imageName}
                          </span>
                        </td>
                        <td className="max-w-[120px]">
                          <span className="truncate block">{obs.location.name}</span>
                          <span className="text-[11px] text-gray-400">{obs.location.district}</span>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {[...new Set(obs.detections.map((d) => d.category))].slice(0, 2).map((cat) => (
                              <span
                                key={cat}
                                className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
                                style={{ backgroundColor: categoryColor(cat) }}
                              >
                                {cat}
                              </span>
                            ))}
                            {obs.detections.length > 2 && (
                              <span className="text-[10px] text-gray-400">+{obs.detections.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="font-mono text-center">{obs.detections.length}</td>
                        <td>
                          <SeverityBadge severity={obs.severity} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    className="btn-ghost p-1.5"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    className="btn-ghost p-1.5"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Detail panel ──────────────────────────────────────────────── */}
        <div className="xl:col-span-1">
          {selectedObs ? (
            <ObservationDetail
              obs={selectedObs}
              onClose={() => setSelectedObs(null)}
            />
          ) : (
            <div className="card h-64 flex items-center justify-center text-center fade-in">
              <div className="empty-state">
                <ClipboardList size={24} className="text-gray-300 mb-2 mx-auto" />
                <p className="text-sm font-medium text-gray-500">Select a row</p>
                <p className="text-xs text-gray-400 mt-1">
                  Click any observation to view its full detail
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
