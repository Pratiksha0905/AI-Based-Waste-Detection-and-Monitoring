import { useEffect, useState } from 'react';
import { AlertCircle, ClipboardList, MapPin, ScanSearch, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dashboardApi, reportsApi, type DashboardStats, type ReportSummary, type TrendPoint } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { formatShortDate, formatTimestamp } from '../utils/display';

function Metric({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <span className="text-emerald-700">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function StatusList({ title, items }: { title?: string; items: Array<{ status: string; count: number }> }) {
  if (!items.length) return <p className="text-sm text-gray-500">No status data.</p>;
  return (
    <div className="space-y-3">
      {title && <h3 className="section-title">{title}</h3>}
      {items.map(({ status, count }) => (
        <div key={status} className="flex items-center justify-between gap-3 text-sm">
          <span className="capitalize text-gray-600">{status.replaceAll('_', ' ')}</span>
          <span className="font-semibold text-gray-900">{count}</span>
        </div>
      ))}
    </div>
  );
}

export default function OverviewPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<ReportSummary[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const request = isAdmin
      ? Promise.all([dashboardApi.stats(), dashboardApi.trends(14), reportsApi.allReports(1, 5)])
          .then(([dashboard, trends, reports]) => {
            if (!active) return;
            setStats(dashboard);
            setTrend(trends.observations_by_date);
            setRecent(reports.items);
          })
      : reportsApi.myReports(1, 5).then((reports) => {
          if (!active) return;
          setRecent(reports.items);
          setUserTotal(reports.total);
        });
    request
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load dashboard data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="p-5 max-w-7xl mx-auto">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="metric-card skeleton h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />{error}
        </div>
      )}

      {isAdmin && stats ? (
        <>
          {!stats.model_available && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              AI detection is unavailable because no model checkpoint is configured. Submitted reports and counts below are real backend records.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total reports" value={stats.total_reports} icon={<ClipboardList size={18} />} />
            <Metric label="Reports today" value={stats.reports_today} icon={<ScanSearch size={18} />} />
            <Metric label="Active hotspots" value={stats.hotspot_count} icon={<MapPin size={18} />} />
            <Metric label="Reporters" value={stats.distinct_reporters} icon={<Users size={18} />} />
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(240px,0.7fr)]">
            <section className="card">
              <div className="card-header">
                <h2 className="section-title">Report submissions</h2>
                <p className="section-subtitle">Daily counts for the last 14 days</p>
              </div>
              <div className="card-body">
                {trend.some((point) => point.count > 0) ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={trend.map((point) => ({ ...point, date: formatShortDate(point.date) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#edf0ed" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Reports" fill="#16845b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="py-12 text-center text-sm text-gray-500">No reports were submitted during this period.</p>}
              </div>
            </section>
            <section className="card">
              <div className="card-header"><h2 className="section-title">Processing status</h2></div>
              <div className="card-body">
                <StatusList title="" items={stats.by_processing_status} />
                <div className="mt-6 border-t border-gray-100 pt-4">
                  <StatusList title="Review status" items={stats.by_review_status} />
                </div>
                <div className="mt-6 border-t border-gray-100 pt-4 text-sm">
                  <p className="text-gray-500">AI detections</p>
                  <p className="mt-1 font-semibold text-gray-900">{stats.total_detections ?? 'Unavailable'}</p>
                </div>
              </div>
            </section>
          </div>
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="section-title">Latest reports</h2>
              <Link className="text-sm font-medium text-emerald-800 hover:underline" to="/admin/reports">Manage all</Link>
            </div>
            <ReportList items={recent} emptyMessage="No reports have been submitted." />
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 sm:flex sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-emerald-950">Welcome, {user?.name}</h2>
              <p className="mt-1 text-sm text-emerald-900">Submit waste observations and follow their processing and review status.</p>
            </div>
            <Link className="btn-primary mt-4 justify-center sm:mt-0" to="/analysis">Submit a report</Link>
          </div>
          <Metric label="Your submitted reports" value={userTotal} icon={<ClipboardList size={18} />} />
          <section className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="section-title">Recent reports</h2>
              <Link className="text-sm font-medium text-emerald-800 hover:underline" to="/history">View all</Link>
            </div>
            <ReportList items={recent} emptyMessage="You have not submitted any reports yet." />
          </section>
        </>
      )}
    </div>
  );
}

function ReportList({ items, emptyMessage }: { items: ReportSummary[]; emptyMessage: string }) {
  if (!items.length) return <p className="p-5 text-sm text-gray-500">{emptyMessage}</p>;
  return (
    <ul className="divide-y divide-gray-100">
      {items.map((report) => (
        <li key={report.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">{formatTimestamp(report.submitted_at)}</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)} · {report.detection_count} detections
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs capitalize text-gray-600">{report.processing_status}</span>
            <Link className="text-sm font-medium text-emerald-800 hover:underline" to={`/reports/${report.id}`}>Details</Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
