import { useEffect, useState } from 'react';
import { AlertCircle, BarChart3, Bot, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dashboardApi, type DashboardStats, type TrendPoint } from '../api/endpoints';
import { formatShortDate } from '../utils/display';

const STATUS_COLORS: Record<string, string> = {
  pending: '#d97706',
  processing: '#2563eb',
  completed: '#059669',
  failed: '#dc2626',
  pending_review: '#d97706',
  reviewed: '#2563eb',
  resolved: '#059669',
  rejected: '#6b7280',
};

function StatusChart({ title, data }: { title: string; data: Array<{ status: string; count: number }> }) {
  return (
    <section className="card">
      <div className="card-header flex items-center gap-2">
        <BarChart3 size={15} className="text-gray-500" />
        <h2 className="section-title">{title}</h2>
      </div>
      <div className="card-body">
        {data.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#edf0ed" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="status" width={110} tickFormatter={(value: string) => value.replaceAll('_', ' ')} />
              <Tooltip />
              <Bar dataKey="count" name="Reports" radius={[0, 4, 4, 0]}>
                {data.map((item) => <Cell key={item.status} fill={STATUS_COLORS[item.status] ?? '#64748b'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="py-12 text-center text-sm text-gray-500">No status data is available.</p>}
      </div>
    </section>
  );
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([dashboardApi.stats(), dashboardApi.trends(30)])
      .then(([dashboard, trends]) => {
        if (!active) return;
        setStats(dashboard);
        setTrend(trends.observations_by_date);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load analytics.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="p-5 grid gap-5 md:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="card skeleton h-72" />)}</div>;
  }

  if (error || !stats) {
    return (
      <div className="p-5">
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />{error ?? 'Analytics data is unavailable.'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-5">
      <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${stats.model_available ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
        <Bot size={17} className="mt-0.5 shrink-0" />
        {stats.model_available
          ? 'AI checkpoint is available. Detection metrics below are populated only when analysis has returned results.'
          : 'AI analysis is unavailable: no model checkpoint is configured. AI-dependent analytics are not fabricated.'}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card"><span className="text-xs text-gray-500">Reports total</span><strong className="text-2xl text-gray-900">{stats.total_reports}</strong></div>
        <div className="metric-card"><span className="text-xs text-gray-500">Last 7 days</span><strong className="text-2xl text-gray-900">{stats.reports_last_7_days}</strong></div>
        <div className="metric-card"><span className="text-xs text-gray-500">Last 30 days</span><strong className="text-2xl text-gray-900">{stats.reports_last_30_days}</strong></div>
        <div className="metric-card"><span className="text-xs text-gray-500">Detection success rate</span><strong className="text-2xl text-gray-900">{stats.processing_success_rate == null ? 'Unavailable' : `${(stats.processing_success_rate * 100).toFixed(1)}%`}</strong></div>
      </div>

      <section className="card">
        <div className="card-header flex items-center gap-2">
          <TrendingUp size={15} className="text-gray-500" />
          <div>
            <h2 className="section-title">Reports submitted over time</h2>
            <p className="section-subtitle">Daily backend totals for the last 30 days</p>
          </div>
        </div>
        <div className="card-body">
          {trend.some((point) => point.count > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trend.map((point) => ({ ...point, date: formatShortDate(point.date) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#edf0ed" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Reports" fill="#16845b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="py-12 text-center text-sm text-gray-500">No reports were submitted during this period.</p>}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <StatusChart title="AI processing status" data={stats.by_processing_status} />
        <StatusChart title="Admin review status" data={stats.by_review_status} />
      </div>

      <section className="card">
        <div className="card-header"><h2 className="section-title">AI detection categories</h2></div>
        <div className="card-body">
          {stats.top_waste_categories?.length ? (
            <div className="space-y-3">
              {stats.top_waste_categories.map((category) => (
                <div key={category.category} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-700">{category.category}</span>
                  <span className="font-semibold text-gray-900">{category.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No AI detections have been recorded; category analytics are unavailable.</p>
          )}
        </div>
      </section>
    </div>
  );
}
