import { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle, RotateCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { apiGetRaw } from '../api/client';
import {
  reportsApi,
  type ReportOut,
  type ReviewStatus,
} from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { formatTimestamp } from '../utils/display';

const reviewStatuses: ReviewStatus[] = ['pending_review', 'reviewed', 'resolved', 'rejected'];
type ReportRequestError = { reportId: string; message: string };
type LoadedReportImage = { reportId: string; url?: string; error?: string };

function statusClass(status: string) {
  if (status === 'completed' || status === 'resolved') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (status === 'failed' || status === 'rejected') return 'bg-red-50 text-red-800 border-red-200';
  if (status === 'processing' || status === 'reviewed') return 'bg-blue-50 text-blue-800 border-blue-200';
  return 'bg-amber-50 text-amber-800 border-amber-200';
}

function Status({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusClass(value)}`}>
      {value.replaceAll('_', ' ')}
    </span>
  );
}

export default function ReportDetailPage() {
  const { reportId } = useParams();
  const { user } = useAuth();
  const [reportData, setReportData] = useState<ReportOut | null>(null);
  const [loadedImage, setLoadedImage] = useState<LoadedReportImage | null>(null);
  const [requestError, setRequestError] = useState<ReportRequestError | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!reportId) return;
    reportsApi.getById(reportId)
      .then((result) => {
        if (active) setReportData(result);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setRequestError({
            reportId,
            message: requestError instanceof Error ? requestError.message : 'Unable to load this report.',
          });
        }
      });
    return () => { active = false; };
  }, [reportId]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!reportId) return;
    apiGetRaw(reportsApi.imageUrl(reportId))
      .then((response) => response.blob())
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setLoadedImage({ reportId, url: objectUrl });
      })
      .catch((requestError: unknown) => {
        if (active) {
          setLoadedImage({
            reportId,
            error: requestError instanceof Error ? requestError.message : 'Unable to load the report image.',
          });
        }
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reportId]);

  const currentReport = reportData?.id === reportId ? reportData : null;
  const currentRequestError = requestError && requestError.reportId === reportId ? requestError.message : null;

  async function updateReviewStatus(status: ReviewStatus) {
    if (!currentReport || (status === 'rejected' && !window.confirm('Reject this report?'))) return;
    setActionLoading(true);
    setActionError(null);
    try {
      setReportData(await reportsApi.updateStatus(currentReport.id, status));
    } catch (requestError: unknown) {
      setActionError(requestError instanceof Error ? requestError.message : 'Unable to update review status.');
    } finally {
      setActionLoading(false);
    }
  }

  async function retryAnalysis() {
    if (!currentReport) return;
    setActionLoading(true);
    setActionError(null);
    try {
      setReportData(await reportsApi.retry(currentReport.id));
    } catch (requestError: unknown) {
      setActionError(requestError instanceof Error ? requestError.message : 'Unable to retry AI analysis.');
    } finally {
      setActionLoading(false);
    }
  }

  if (!reportId || (!currentReport && !currentRequestError)) {
    return <div className="p-8 text-center text-sm text-gray-500"><LoaderCircle className="mx-auto mb-2 animate-spin" />Loading report…</div>;
  }

  if (!currentReport) {
    return (
      <div className="p-5 max-w-3xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          {currentRequestError ?? 'Report not found.'}
        </div>
        <Link className="btn-secondary mt-4" to={user?.role === 'admin' ? '/admin/reports' : '/history'}>Back to reports</Link>
      </div>
    );
  }

  const report = currentReport;
  const currentImage = loadedImage?.reportId === report.id ? loadedImage : null;

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link className="text-sm font-medium text-emerald-800 hover:underline" to={user?.role === 'admin' ? '/admin/reports' : '/history'}>
            ← Back to reports
          </Link>
          <h2 className="mt-3 text-lg font-semibold text-gray-900">Report details</h2>
          <p className="mt-1 break-all font-mono text-xs text-gray-500">{report.id}</p>
        </div>
        {(report.processing_status === 'failed' || (report.processing_status === 'pending' && Boolean(report.processing_error))) && (
          <button type="button" className="btn-secondary justify-center" disabled={actionLoading} onClick={retryAnalysis}>
            <RotateCw size={15} /> Retry analysis
          </button>
        )}
      </div>

      {actionError && (
        <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />{actionError}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <section className="card overflow-hidden">
          <div className="card-header"><h3 className="section-title">Uploaded image</h3></div>
          {currentImage?.url ? (
            <div className="bg-gray-50 p-3">
              <div className="relative mx-auto w-fit max-w-full">
                <img src={currentImage.url} alt="Uploaded waste report" className="max-h-[560px] max-w-full object-contain" />
                {report.detections.map((detection) => {
                  const box = detection.bbox;
                  if (!box || box.x2 <= box.x1 || box.y2 <= box.y1) return null;
                  return (
                    <div
                      key={detection.id}
                      className="pointer-events-none absolute border-2 border-emerald-500"
                      style={{
                        left: `${box.x1 * 100}%`,
                        top: `${box.y1 * 100}%`,
                        width: `${(box.x2 - box.x1) * 100}%`,
                        height: `${(box.y2 - box.y1) * 100}%`,
                      }}
                      aria-label={`${detection.predicted_class} detection bounding box`}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="empty-state px-5">
              {currentImage?.error
                ? <p className="text-sm text-red-700">{currentImage.error}</p>
                : <p className="text-sm text-gray-500">Loading image…</p>}
            </div>
          )}
        </section>

        <div className="space-y-5">
          <section className="card">
            <div className="card-header"><h3 className="section-title">Report status</h3></div>
            <div className="card-body space-y-4">
              <div>
                <p className="mb-1 text-xs text-gray-500">AI processing</p>
                <Status value={report.processing_status} />
              </div>
              <div>
                <p className="mb-1 text-xs text-gray-500">Admin review</p>
                {user?.role === 'admin' ? (
                  <label>
                    <span className="sr-only">Update review status</span>
                    <select
                      className="select"
                      value={report.review_status}
                      disabled={actionLoading}
                      onChange={(event) => void updateReviewStatus(event.target.value as ReviewStatus)}
                    >
                      {reviewStatuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                    </select>
                  </label>
                ) : <Status value={report.review_status} />}
              </div>
              <dl className="space-y-2 border-t border-gray-100 pt-3 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Submitted</dt><dd className="text-right text-gray-800">{formatTimestamp(report.submitted_at)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Location</dt><dd className="text-right font-mono text-xs text-gray-800">{report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Attempts</dt><dd className="text-gray-800">{report.retry_count}</dd></div>
              </dl>
              {report.description && <p className="border-t border-gray-100 pt-3 text-sm text-gray-700">{report.description}</p>}
              {report.processing_error && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Analysis unavailable: {report.processing_error}
                </p>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="section-title">AI detection results</h3>
              <span className="text-xs text-gray-500">{report.detections.length} detections</span>
            </div>
            {report.detections.length ? (
              <ul className="divide-y divide-gray-100">
                {report.detections.map((detection) => (
                  <li key={detection.id} className="space-y-1 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-gray-800">{detection.predicted_class}</span>
                      <span className="text-sm font-semibold text-gray-700">{(detection.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {detection.model_version ? `Model ${detection.model_version}` : 'Model version not reported'}
                      {detection.relative_depth !== null && detection.relative_depth !== undefined
                        ? ` · Relative depth ${detection.relative_depth.toFixed(3)}`
                        : ' · Depth estimate unavailable'}
                    </p>
                    <p className="text-[11px] text-gray-400">Analyzed {formatTimestamp(detection.analyzed_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-sm text-gray-600">
                {report.processing_error
                  ? `AI analysis is unavailable: ${report.processing_error}`
                  : report.processing_status === 'pending' || report.processing_status === 'processing'
                  ? 'AI analysis is pending or still processing. No detection results are available yet.'
                  : report.processing_status === 'failed'
                    ? 'AI analysis did not complete. No detections are available.'
                    : 'Analysis completed with no detections returned.'}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
