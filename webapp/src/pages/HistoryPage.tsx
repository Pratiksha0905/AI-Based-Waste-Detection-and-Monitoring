import { useEffect, useState } from 'react';
import { AlertCircle, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  reportsApi,
  type PaginatedReports,
  type ProcessingStatus,
  type ReviewStatus,
} from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { formatTimestamp } from '../utils/display';

const PAGE_SIZE = 20;

const processingStatuses: ProcessingStatus[] = ['pending', 'processing', 'completed', 'failed'];
const reviewStatuses: ReviewStatus[] = ['pending_review', 'reviewed', 'resolved', 'rejected'];

function StatusPill({ value }: { value: ProcessingStatus | ReviewStatus }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    processing: 'bg-blue-50 text-blue-800 border-blue-200',
    completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    failed: 'bg-red-50 text-red-800 border-red-200',
    pending_review: 'bg-amber-50 text-amber-800 border-amber-200',
    reviewed: 'bg-blue-50 text-blue-800 border-blue-200',
    resolved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    rejected: 'bg-gray-100 text-gray-700 border-gray-300',
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${styles[value]}`}>
      {value.replaceAll('_', ' ')}
    </span>
  );
}

export default function HistoryPage() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdminList = location.pathname.startsWith('/admin/');
  const [data, setData] = useState<PaginatedReports | null>(null);
  const [page, setPage] = useState(1);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | ''>('');
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const request = isAdminList
      ? reportsApi.allReports(page, PAGE_SIZE, processingStatus || undefined, reviewStatus || undefined)
      : reportsApi.myReports(page, PAGE_SIZE);
    request
      .then((response) => {
        if (active) setData(response);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load reports.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [isAdminList, page, processingStatus, reviewStatus]);

  function changeFilter<T extends ProcessingStatus | ReviewStatus>(
    setFilter: (status: T | '') => void,
    status: T | '',
  ) {
    setLoading(true);
    setError(null);
    setFilter(status);
    setPage(1);
  }

  function changePage(nextPage: number) {
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  const title = isAdminList ? 'All submitted reports' : 'Your reports';

  return (
    <div className="p-5 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {isAdminList ? 'Review incoming reports and open a report to inspect its image and AI results.' : 'Track each report’s processing and review status.'}
          </p>
        </div>
        {!isAdminList && (
          <Link className="btn-primary justify-center" to="/analysis">Submit a report</Link>
        )}
      </div>

      {isAdminList && (
        <div className="card">
          <div className="card-body grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-gray-700">
              Processing status
              <select
                className="select mt-1"
                value={processingStatus}
                onChange={(event) => changeFilter(setProcessingStatus, event.target.value as ProcessingStatus | '')}
              >
                <option value="">All processing statuses</option>
                {processingStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-700">
              Review status
              <select
                className="select mt-1"
                value={reviewStatus}
                onChange={(event) => changeFilter(setReviewStatus, event.target.value as ReviewStatus | '')}
              >
                <option value="">All review statuses</option>
                {reviewStatuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3" aria-label="Loading reports">
            {Array.from({ length: 5 }, (_, index) => <div key={index} className="skeleton h-12 rounded" />)}
          </div>
        ) : data?.items.length ? (
          <>
            <div className="scroll-x">
              <table className="data-table min-w-[740px]">
                <thead>
                  <tr>
                    <th>Submitted</th>
                    {isAdminList && <th>Reporter</th>}
                    <th>Location</th>
                    <th>Processing</th>
                    <th>Review</th>
                    <th>Detections</th>
                    <th><span className="sr-only">Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((report) => (
                    <tr key={report.id}>
                      <td className="whitespace-nowrap">{formatTimestamp(report.submitted_at)}</td>
                      {isAdminList && <td className="font-mono text-xs">{report.user_id.slice(0, 8)}</td>}
                      <td>
                        <span className="block">{report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}</span>
                        {report.description && <span className="block max-w-64 truncate text-xs text-gray-500">{report.description}</span>}
                      </td>
                      <td><StatusPill value={report.processing_status} /></td>
                      <td><StatusPill value={report.review_status} /></td>
                      <td>{report.detection_count}</td>
                      <td>
                        <Link className="text-sm font-medium text-emerald-800 hover:underline" to={`/reports/${report.id}`}>
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
              <span className="text-xs text-gray-500">
                {data.total} report{data.total === 1 ? '' : 's'} · Page {data.page} of {data.total_pages}
              </span>
              <div className="flex gap-2">
                <button className="btn-secondary px-2 py-1.5" disabled={page <= 1} onClick={() => changePage(page - 1)} aria-label="Previous page">
                  <ChevronLeft size={16} />
                </button>
                <button className="btn-secondary px-2 py-1.5" disabled={page >= data.total_pages} onClick={() => changePage(page + 1)} aria-label="Next page">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state px-5">
            <ClipboardList size={28} className="mb-2 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">
              {isAdminList ? 'No reports match these filters.' : 'You have not submitted any reports yet.'}
            </p>
            {!isAdminList && <Link className="btn-primary mt-4" to="/analysis">Submit your first report</Link>}
          </div>
        )}
      </div>

      {user?.role === 'admin' && !isAdminList && (
        <p className="text-xs text-gray-500">Use “All reports” to review submissions from every account.</p>
      )}
    </div>
  );
}
