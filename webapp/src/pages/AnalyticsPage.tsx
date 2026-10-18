import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { BarChart3, TrendingUp, MapPin, Info } from 'lucide-react';
import type { AnalyticsData } from '../types/observation';
import { getAnalytics } from '../services/analysisService';
import { categoryColor, formatShortDate, capitalise } from '../utils/display';

const SEVERITY_COLORS: Record<string, string> = {
  Low: '#10b981',
  Medium: '#f59e0b',
  High: '#f97316',
  Critical: '#ef4444',
};

// Custom tooltips

const ChartTooltip = ({
  active,
  payload,
  label,
  valueSuffix = '',
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  valueSuffix?: string;
}) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
        <p className="font-semibold text-gray-800">{label}</p>
        <p className="text-gray-600 mt-0.5">
          {payload[0].value}{valueSuffix}
        </p>
      </div>
    );
  }
  return null;
};

// ── Analytics Page ────────────────────────────────────────────────────────────

const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalytics().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card">
              <div className="card-header">
                <div className="skeleton h-4 w-32 rounded" />
              </div>
              <div className="card-body">
                <div className="skeleton h-48 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const observationLineData = data.observationsByDate.map((d) => ({
    ...d,
    date: formatShortDate(d.date),
  }));

  const volumeLineData = data.volumeTrend.map((d) => ({
    ...d,
    date: formatShortDate(d.date),
  }));

  const severityChartData = data.severityDistribution.map((s) => ({
    name: capitalise(s.severity),
    count: s.count,
  }));

  const categoryChartData = data.categoryDistribution
    .sort((a, b) => b.count - a.count)
    .map((c) => ({ name: c.category, count: c.count }));

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-5">
      {/* Simulated notice */}
      <div className="flex items-start gap-2 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700">
        <Info size={13} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          All charts below are derived from <strong>simulated demonstration data</strong>.
          Trend percentages and patterns do not represent statistically meaningful findings.
        </span>
      </div>

      {/* ── Row 1: Observations over time + Volume trend ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Observations by date */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <TrendingUp size={15} className="text-gray-400" />
            <span className="section-title">Observations Over Time</span>
            <span className="ml-auto text-[10px] text-gray-400">Last 14 days</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={observationLineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#059669' }}
                  activeDot={{ r: 5 }}
                  name="Observations"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Volume trend */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <BarChart3 size={15} className="text-gray-400" />
            <span className="section-title">Estimated Volume Trend</span>
            <span className="ml-auto badge badge-demo">Simulated</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={volumeLineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" L" />
                <Tooltip content={<ChartTooltip valueSuffix=" L" />} />
                <Line
                  type="monotone"
                  dataKey="simulatedVolumeLitres"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#6366f1' }}
                  activeDot={{ r: 5 }}
                  name="Volume (L)"
                  strokeDasharray="4 2"
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-violet-600 mt-2">
              Volume values are simulated estimates — not physically measured.
            </p>
          </div>
        </div>
      </div>

      {/* ── Row 2: Category + Severity ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Category distribution */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <BarChart3 size={15} className="text-gray-400" />
            <span className="section-title">Detections by Category</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={categoryChartData} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {categoryChartData.map((entry) => (
                    <Cell key={entry.name} fill={categoryColor(entry.name as Parameters<typeof categoryColor>[0])} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity distribution */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <BarChart3 size={15} className="text-gray-400" />
            <span className="section-title">Observations by Severity</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={severityChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="name"
                  aria-label="Severity distribution donut chart"
                >
                  {severityChartData.map((entry) => (
                    <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? '#64748b'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [value, `${name} severity`]}
                />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-gray-600">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Row 3: Location comparison ───────────────────────────────────── */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <MapPin size={15} className="text-gray-400" />
          <span className="section-title">Observations by Location</span>
          <span className="ml-auto text-[10px] text-gray-400">Top 10</span>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.locationComparison.map(l => ({ name: l.location.split(' ').slice(0, 2).join(' '), count: l.count, severity: l.severity }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#059669" barSize={28}>
                {data.locationComparison.map((entry) => (
                  <Cell
                    key={entry.location}
                    fill={
                      entry.severity === 'critical' ? '#ef4444' :
                      entry.severity === 'high' ? '#f97316' :
                      entry.severity === 'medium' ? '#f59e0b' : '#10b981'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
