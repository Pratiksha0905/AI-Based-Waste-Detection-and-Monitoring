import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  AlertTriangle,
  Images,
  MapPin,
  Droplets,
  TrendingUp,
  Clock,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';

import type { DashboardSummary } from '../types/observation';
import { MOCK_OBSERVATIONS, MOCK_HOTSPOTS } from '../data/mockObservations';
import { getDashboardSummary } from '../services/analysisService';
import SeverityBadge from '../components/SeverityBadge';
import {
  formatTimestamp,
  categoryColor,
  severityColor,
  capitalise,
} from '../utils/display';
import { useNavigate } from 'react-router-dom';

// ── Metric Card ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  description: string;
  iconBg?: string;
  simulated?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  description,
  iconBg = 'bg-gray-100',
  simulated,
}) => (
  <div className="metric-card fade-in">
    <div className="flex items-start justify-between">
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      {simulated && (
        <span className="text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
          Simulated
        </span>
      )}
    </div>
    <div className="mt-3">
      <div className="text-2xl font-bold text-gray-900 leading-none">{value}</div>
      <div className="text-xs font-medium text-gray-500 mt-1">{label}</div>
    </div>
    <p className="text-[11px] text-gray-400 leading-snug mt-1">{description}</p>
  </div>
);

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

const CustomPieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
        <p className="font-semibold text-gray-800">{payload[0].name}</p>
        <p className="text-gray-600">{payload[0].value} detections</p>
      </div>
    );
  }
  return null;
};

const CustomBarTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
        <p className="font-semibold text-gray-800">{label}</p>
        <p className="text-gray-600">{payload[0].value} observations</p>
      </div>
    );
  }
  return null;
};

// ── Overview Page ─────────────────────────────────────────────────────────────

const OverviewPage: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getDashboardSummary().then((s) => {
      setSummary(s);
      setLoading(false);
    });
  }, []);

  const recentObs = MOCK_OBSERVATIONS.slice(0, 5);
  const topHotspots = MOCK_HOTSPOTS.slice(0, 4);

  // Build severity bar data
  const severityData = summary?.severityDistribution.map((s) => ({
    name: capitalise(s.severity),
    count: s.count,
  })) ?? [];

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-6">
      {/* ── Simulated data notice ──────────────────────────────────────────── */}
      <div className="flex items-start gap-2 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700">
        <span className="mt-0.5 flex-shrink-0">ℹ</span>
        <span>
          All metrics and observations displayed on this page are <strong>simulated demonstration data</strong>.
          The real AI pipeline (YOLOv8n + MiDaS) is not yet connected.
        </span>
      </div>

      {/* ── Metric cards ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="metric-card">
              <div className="skeleton w-9 h-9 rounded-lg" />
              <div className="skeleton h-7 w-20 mt-3 rounded" />
              <div className="skeleton h-3 w-16 mt-1 rounded" />
            </div>
          ))}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            icon={<Images size={18} className="text-blue-600" />}
            iconBg="bg-blue-50"
            label="Analyzed Images"
            value={summary.totalImages}
            description="Demo observation records in the dataset"
          />
          <MetricCard
            icon={<BarChart3 size={18} className="text-emerald-600" />}
            iconBg="bg-emerald-50"
            label="Detected Objects"
            value={summary.totalDetections}
            description="Illustrative waste-object detections"
            simulated
          />
          <MetricCard
            icon={<AlertTriangle size={18} className="text-orange-600" />}
            iconBg="bg-orange-50"
            label="High-Severity"
            value={summary.highSeverityCount}
            description="High or critical severity observations"
          />
          <MetricCard
            icon={<MapPin size={18} className="text-red-600" />}
            iconBg="bg-red-50"
            label="Potential Hotspots"
            value={summary.potentialHotspots}
            description="Demo locations with repeated high severity"
          />
          <MetricCard
            icon={<Droplets size={18} className="text-indigo-600" />}
            iconBg="bg-indigo-50"
            label="Est. Volume (L)"
            value={`${summary.simulatedTotalVolumeLitres.toLocaleString()} L`}
            description="Simulated total — not physically measured"
            simulated
          />
        </div>
      )}

      {/* ── Charts row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Category distribution */}
        <div className="card fade-in">
          <div className="card-header flex items-center gap-2">
            <BarChart3 size={15} className="text-gray-400" />
            <span className="section-title">Waste Category Distribution</span>
            <span className="ml-auto text-[10px] text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full font-medium">Simulated</span>
          </div>
          <div className="card-body">
            {summary && (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={summary.categoryDistribution.map(c => ({ name: c.category, value: c.count }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    aria-label="Waste category pie chart"
                  >
                    {summary.categoryDistribution.map((entry) => (
                      <Cell key={entry.category} fill={categoryColor(entry.category)} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-gray-600">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Severity distribution */}
        <div className="card fade-in">
          <div className="card-header flex items-center gap-2">
            <AlertTriangle size={15} className="text-gray-400" />
            <span className="section-title">Severity Distribution</span>
          </div>
          <div className="card-body">
            {summary && (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={severityData} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {severityData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name === 'Low' ? '#10b981' :
                          entry.name === 'Medium' ? '#f59e0b' :
                          entry.name === 'High' ? '#f97316' : '#ef4444'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent observations */}
        <div className="card fade-in">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-gray-400" />
              <span className="section-title">Recent Observations</span>
            </div>
            <button
              onClick={() => navigate('/history')}
              className="text-xs text-emerald-700 font-medium hover:underline flex items-center gap-1"
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {recentObs.map((obs) => (
              <div
                key={obs.id}
                className="px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate('/history')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {obs.imageName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {obs.location.name} · {obs.detections.length} detection{obs.detections.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {formatTimestamp(obs.timestamp)}
                    </p>
                  </div>
                  <SeverityBadge severity={obs.severity} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hotspot preview */}
        <div className="card fade-in">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-gray-400" />
              <span className="section-title">Potential Hotspots</span>
            </div>
            <button
              onClick={() => navigate('/map')}
              className="text-xs text-emerald-700 font-medium hover:underline flex items-center gap-1"
            >
              Open map <ChevronRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {topHotspots.map((hs) => (
              <div
                key={hs.id}
                className="px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate('/map')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {hs.locationName}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {hs.district} · {hs.observationCount} observations · {hs.totalDetections} detections
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Dominant: {hs.dominantCategory}
                    </p>
                  </div>
                  <SeverityBadge severity={hs.severity} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent activity ────────────────────────────────────────────────── */}
      <div className="card fade-in">
        <div className="card-header flex items-center gap-2">
          <TrendingUp size={15} className="text-gray-400" />
          <span className="section-title">Recent Activity</span>
        </div>
        <div className="card-body">
          <ol className="relative border-l border-gray-200 space-y-4 ml-2" aria-label="Activity timeline">
            {MOCK_OBSERVATIONS.slice(0, 6).map((obs) => (
              <li key={obs.id} className="ml-4">
                <div className={`absolute w-2.5 h-2.5 rounded-full -left-1.5 mt-1 ${
                  obs.severity === 'critical' ? 'bg-red-500' :
                  obs.severity === 'high' ? 'bg-orange-500' :
                  obs.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                }`} aria-hidden="true" />
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{obs.detections.length}</span> waste object{obs.detections.length !== 1 ? 's' : ''} detected
                    at <span className={`font-medium ${severityColor(obs.severity)}`}>{obs.location.name}</span>
                  </p>
                  <time className="text-[11px] text-gray-400 flex-shrink-0" dateTime={obs.timestamp}>
                    {formatTimestamp(obs.timestamp)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
