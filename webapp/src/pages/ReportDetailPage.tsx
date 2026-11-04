import { useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle, RotateCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { apiGetRaw } from '../api/client';
import {
  reportsApi,
  type AiAnalysis,
  type DepthStatistics,
  type ReportOut,
  type ReviewStatus,
  type VolumePileAnalysis,
} from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { formatTimestamp } from '../utils/display';

const reviewStatuses: ReviewStatus[] = ['pending_review', 'reviewed', 'resolved', 'rejected'];
type ReportRequestError = { reportId: string; message: string };
type LoadedImage = { url?: string; error?: string };
type LoadedImages = { reportId: string; images: Record<string, LoadedImage> };

function statusClass(status: string) {
  if (status === 'completed' || status === 'resolved' || status === 'reviewed') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (status === 'failed' || status === 'rejected') return 'bg-red-50 text-red-800 border-red-200';
  if (status === 'processing') return 'bg-blue-50 text-blue-800 border-blue-200';
  return 'bg-amber-50 text-amber-800 border-amber-200';
}

function Status({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusClass(value)}`}>
      {value.replaceAll('_', ' ')}
    </span>
  );
}

function formatNumber(value: unknown, digits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable';
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function readable(value: unknown, fallback = 'Unavailable'): string {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  return value.replaceAll('_', ' ');
}

function severityTextClass(value: unknown): string {
  const severity = typeof value === 'string' ? value.toLowerCase() : '';
  if (severity === 'critical' || severity === 'high') return 'text-red-700';
  if (severity === 'medium') return 'text-amber-700';
  if (severity === 'low') return 'text-emerald-700';
  return 'text-gray-900';
}

function Metric({
  label,
  value,
  detail,
  valueClassName,
}: {
  label: string;
  value: string;
  detail?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold capitalize ${valueClassName ?? 'text-gray-900'}`}>{value}</p>
      {detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}
    </div>
  );
}

function DepthMetrics({ stats, compact = false }: { stats?: DepthStatistics; compact?: boolean }) {
  if (!stats?.available) {
    return <p className="text-sm text-gray-500">Relative depth values are unavailable for this region.</p>;
  }
  return (
    <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'} gap-2`}>
      <Metric label="Minimum" value={formatNumber(stats.minimum, 3)} />
      <Metric label="Maximum" value={formatNumber(stats.maximum, 3)} />
      <Metric label="Mean / median" value={`${formatNumber(stats.mean, 3)} / ${formatNumber(stats.median, 3)}`} />
      <Metric label="Spread (range)" value={`${formatNumber(stats.standard_deviation, 3)} / ${formatNumber(stats.range, 3)}`} detail={`${formatNumber(stats.valid_pixel_count, 0)} valid pixels`} />
    </div>
  );
}

function ImagePanel({
  title,
  alt,
  image,
  emptyMessage,
}: {
  title: string;
  alt: string;
  image?: LoadedImage;
  emptyMessage: string;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="card-header"><h3 className="section-title">{title}</h3></div>
      <div className="flex min-h-56 items-center justify-center bg-gray-50 p-3">
        {image?.url ? (
          <img src={image.url} alt={alt} className="max-h-[520px] max-w-full object-contain" />
        ) : image?.error ? (
          <p className="max-w-sm text-center text-sm text-red-700">{image.error}</p>
        ) : (
          <p className="max-w-sm text-center text-sm text-gray-500">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}

function ProtectedCrop({ url, alt }: { url: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<LoadedImage | null>(null);

  useEffect(() => {
    let active = true;
    let requested = false;
    let objectUrl: string | null = null;
    let observer: IntersectionObserver | null = null;

    const load = () => {
      if (requested) return;
      requested = true;
      apiGetRaw(url)
        .then((response) => response.blob())
        .then((blob) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(blob);
          setImage({ url: objectUrl });
        })
        .catch((error: unknown) => {
          if (active) setImage({ error: error instanceof Error ? error.message : 'Unable to load this crop.' });
        });
    };

    if (containerRef.current && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          load();
        }
      }, { rootMargin: '160px' });
      observer.observe(containerRef.current);
    } else {
      load();
    }

    return () => {
      active = false;
      observer?.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return (
    <div ref={containerRef} className="flex min-h-40 items-center justify-center bg-gray-50 p-4 text-center">
      {image?.url
        ? <img src={image.url} alt={alt} loading="lazy" className="max-h-64 w-full object-contain" />
        : <p className={`text-sm ${image?.error ? 'text-red-700' : 'text-gray-500'}`}>{image?.error ?? 'Object crop loads when visible.'}</p>}
    </div>
  );
}

export default function ReportDetailPage() {
  const { reportId } = useParams();
  const { user } = useAuth();
  const [reportData, setReportData] = useState<ReportOut | null>(null);
  const [loadedImages, setLoadedImages] = useState<LoadedImages | null>(null);
  const [requestError, setRequestError] = useState<ReportRequestError | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!reportId) return;

    const loadReport = async () => {
      try {
        const result = await reportsApi.getById(reportId);
        if (!active) return;
        setReportData(result);
        setRequestError(null);
        if (result.processing_status === 'processing' || (result.processing_status === 'pending' && !result.processing_error)) {
          timer = setTimeout(loadReport, 2500);
        }
      } catch (error: unknown) {
        if (active) {
          setRequestError({
            reportId,
            message: error instanceof Error ? error.message : 'Unable to load this report.',
          });
        }
      }
    };

    void loadReport();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [reportId, reportData?.processing_status, reportData?.processing_error]);

  const report = reportData?.id === reportId ? reportData : null;
  const analysis: AiAnalysis | null = report?.ai_analysis ?? null;
  const annotatedArtifact = analysis?.artifacts?.annotated;
  const depthArtifact = analysis?.artifacts?.depth_map;

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    if (!reportId) return;

    const sources: Array<[string, string]> = [['original', reportsApi.imageUrl(reportId)]];
    if (annotatedArtifact) {
      sources.push(['annotated', reportsApi.annotatedImageUrl(reportId)]);
    }
    if (depthArtifact) {
      sources.push(['depth', reportsApi.depthMapUrl(reportId)]);
    }
    const loadImages = async () => {
      const entries = await Promise.all(sources.map(async ([key, url]) => {
        try {
          const response = await apiGetRaw(url);
          const blob = await response.blob();
          if (!active) return [key, {}] as const;
          const objectUrl = URL.createObjectURL(blob);
          objectUrls.push(objectUrl);
          return [key, { url: objectUrl }] as const;
        } catch (error: unknown) {
          return [
            key,
            { error: error instanceof Error ? error.message : 'Unable to load this image.' },
          ] as const;
        }
      }));
      if (active) setLoadedImages({ reportId, images: Object.fromEntries(entries) });
    };
    void loadImages();

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [reportId, annotatedArtifact, depthArtifact]);

  const currentRequestError = requestError && requestError.reportId === reportId
    ? requestError.message
    : null;

  async function updateReviewStatus(status: ReviewStatus) {
    if (!report || (status === 'rejected' && !window.confirm('Reject this report?'))) return;
    setActionLoading(true);
    setActionError(null);
    try {
      setReportData(await reportsApi.updateStatus(report.id, status));
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Unable to update review status.');
    } finally {
      setActionLoading(false);
    }
  }

  async function retryAnalysis() {
    if (!report) return;
    setActionLoading(true);
    setActionError(null);
    try {
      setReportData(await reportsApi.retry(report.id));
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Unable to retry AI analysis.');
    } finally {
      setActionLoading(false);
    }
  }

  if (!reportId || (!report && !currentRequestError)) {
    return <div className="p-8 text-center text-sm text-gray-500"><LoaderCircle className="mx-auto mb-2 animate-spin" />Loading report…</div>;
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-3xl p-5">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          {currentRequestError ?? 'Report not found.'}
        </div>
        <Link className="btn-secondary mt-4" to={user?.role === 'admin' ? '/admin/reports' : '/history'}>Back to reports</Link>
      </div>
    );
  }

  const images = loadedImages?.reportId === report.id ? loadedImages.images : {};
  const spatial = analysis?.spatial_analysis;
  const volume = analysis?.volume_analysis;
  const detectionsById = new Map(report.detections.map((detection) => [detection.id, detection]));
  const detailsById = new Map((analysis?.detections ?? [])
    .filter((item) => item.detection_id)
    .map((item) => [item.detection_id as string, item]));
  const piles = volume?.piles ?? [];
  const pileByDetection = new Map(piles.filter((pile) => pile.detection_id)
    .map((pile) => [pile.detection_id as string, pile]));
  const rankedPiles = piles
    .filter((pile) => typeof pile.relative_volume_index === 'number' && Number.isFinite(pile.relative_volume_index))
    .sort((left, right) => (right.relative_volume_index ?? 0) - (left.relative_volume_index ?? 0));
  const relativeVolumeRanks = new Map(rankedPiles.map((pile, index) => [pile.pile_index, index + 1]));
  const classCounts = analysis?.class_counts ?? {};
  const severity = readable(analysis?.severity, 'Not assessed');
  const priority = readable(analysis?.cleanup_priority, 'Not assessed');
  const hasPileAnalysis = piles.length > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link className="text-sm font-medium text-emerald-800 hover:underline" to={user?.role === 'admin' ? '/admin/reports' : '/history'}>
            ← Back to reports
          </Link>
          <h2 className="mt-3 text-xl font-semibold text-gray-900">AI report analysis</h2>
          <p className="mt-1 break-all font-mono text-xs text-gray-500">Report {report.id}</p>
        </div>
        {(report.processing_status === 'failed' || (report.processing_status === 'pending' && Boolean(report.processing_error))) && (
          <button type="button" className="btn-secondary justify-center" disabled={actionLoading} onClick={retryAnalysis}>
            <RotateCw size={15} className={actionLoading ? 'animate-spin' : ''} /> Retry analysis
          </button>
        )}
      </div>

      {actionError && (
        <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />{actionError}
        </div>
      )}

      <section className="card">
        <div className="card-header flex flex-wrap items-center justify-between gap-3">
          <h3 className="section-title">Report overview</h3>
          <div className="flex flex-wrap gap-2">
            <Status value={report.processing_status} />
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
        </div>
        <div className="card-body space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Detected objects" value={String(report.detections.length)} />
            <Metric label="Waste severity" value={severity} valueClassName={severityTextClass(analysis?.severity)} />
            <Metric label="Cleanup priority" value={priority} />
            <Metric label="Processing attempts" value={String(report.retry_count)} />
          </div>
          <dl className="grid gap-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-gray-500">Submitted</dt><dd className="mt-1 text-gray-800">{formatTimestamp(report.submitted_at)}</dd></div>
            <div><dt className="text-xs text-gray-500">Geographic location</dt><dd className="mt-1 font-mono text-xs text-gray-800">{report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}</dd></div>
          </dl>
          {report.description && <p className="border-t border-gray-100 pt-3 text-sm text-gray-700">{report.description}</p>}
          {report.processing_error && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Analysis status: {report.processing_error}
            </p>
          )}
          {report.processing_status === 'processing' && (
            <p className="text-sm text-blue-700">AI inference is running. This report refreshes automatically when processing completes.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Original and annotated images</h3>
          <p className="mt-1 text-sm text-gray-500">The annotation is rendered from the model's predicted bounding boxes. The uploaded original remains unchanged.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ImagePanel title="Original upload" alt="Original uploaded waste report" image={images.original} emptyMessage="Loading the original report image…" />
          <ImagePanel
            title="YOLO detection output"
            alt="Model-annotated waste detections"
            image={images.annotated}
            emptyMessage={analysis?.artifacts?.annotated ? 'Loading the generated annotation…' : 'The annotated image will appear when inference finishes.'}
          />
        </div>
      </section>

      <section className="card">
        <div className="card-header flex items-center justify-between gap-3">
          <h3 className="section-title">Detected objects</h3>
          <span className="text-xs text-gray-500">{report.detections.length} model predictions</span>
        </div>
        {report.detections.length ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {report.detections.map((detection, index) => {
              const details = detailsById.get(detection.id);
              const dimensions = details?.bbox_dimensions;
              const depth = details?.depth_analysis;
              const pile = pileByDetection.get(detection.id);
              const cropAvailable = Boolean(analysis?.artifacts?.detection_crops?.[detection.id]);
              return (
                <article key={detection.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  {cropAvailable
                    ? <ProtectedCrop url={reportsApi.detectionCropUrl(report.id, detection.id)} alt={`Detected ${detection.predicted_class} crop`} />
                    : <div className="flex min-h-40 items-center justify-center bg-gray-50 p-4 text-center text-sm text-gray-500">Object crop is not available.</div>}
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Object {index + 1}</p>
                        <h4 className="font-semibold capitalize text-gray-900">{detection.predicted_class.replaceAll('_', ' ')}</h4>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-800">{(detection.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Box {formatNumber(dimensions?.width_pixels, 0)} × {formatNumber(dimensions?.height_pixels, 0)} px · {formatNumber(dimensions?.image_area_percentage, 3)}% of image
                    </p>
                    {depth?.available && (
                      <div className="space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-600">
                        <p>Relative depth median: {formatNumber(depth.median, 4)}</p>
                        <p>{depth.near_far_interpretation}</p>
                        <p>Within-box spread: {formatNumber(depth.range, 4)}</p>
                      </div>
                    )}
                    {pile && <PileSummary pile={pile} />}
                    <p className="text-[11px] text-gray-400">
                      {detection.model_version ? `Model ${detection.model_version} · ` : ''}Analyzed {formatTimestamp(detection.analyzed_at)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-5 text-sm text-gray-600">
            {report.processing_status === 'pending' || report.processing_status === 'processing'
              ? 'Detection results will appear after AI processing finishes.'
              : report.processing_status === 'failed'
                ? 'AI inference failed; no detection results are available.'
                : 'Analysis completed with no detected objects.'}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-header"><h3 className="section-title">Relative depth analysis</h3></div>
        <div className="card-body space-y-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <ImagePanel
              title="Color depth map"
              alt="Colorized MiDaS relative depth visualization"
              image={images.depth}
              emptyMessage={analysis?.artifacts?.depth_map ? 'Loading depth visualization…' : 'A depth map is unavailable or has not been generated.'}
            />
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Higher MiDaS relative inverse-depth values represent nearer image regions in this model's output. They are relative to the image and are not calibrated distance measurements.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Minimum / maximum" value={`${formatNumber(analysis?.depth_analysis?.minimum, 4)} / ${formatNumber(analysis?.depth_analysis?.maximum, 4)}`} />
                <Metric label="Mean / median" value={`${formatNumber(analysis?.depth_analysis?.mean, 4)} / ${formatNumber(analysis?.depth_analysis?.median, 4)}`} />
                <Metric label="Standard deviation" value={formatNumber(analysis?.depth_analysis?.standard_deviation, 4)} />
                <Metric label="Depth range" value={formatNumber(analysis?.depth_analysis?.range, 4)} detail={`${formatNumber(analysis?.depth_analysis?.valid_pixel_count, 0)} valid pixels`} />
              </div>
              <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
                Depth variation within a detection is the spread of relative model values across its box; it can reflect changing scene geometry, but may also include background, occlusion, or model error. A monocular image cannot provide reliable metric depth without calibration and a validated reconstruction method.
              </p>
            </div>
          </div>
          {report.detections.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-800">Per-object depth statistics</h4>
              <div className="space-y-4">
                {report.detections.map((detection) => {
                  const stats = detailsById.get(detection.id)?.depth_analysis;
                  return (
                    <div key={detection.id} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium capitalize text-gray-800">{detection.predicted_class.replaceAll('_', ' ')}</span>
                        <span className="text-xs text-gray-500">{stats?.near_far_interpretation ?? 'No per-object depth estimate.'}</span>
                      </div>
                      <DepthMetrics stats={stats} compact />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-header"><h3 className="section-title">Relative Volume Analysis</h3></div>
        <div className="card-body space-y-4">
          {!hasPileAnalysis ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              {report.processing_status === 'completed'
                ? 'No waste pile was detected. Pile-specific accumulation analysis is not applicable; object detections and overall depth analysis remain available above.'
                : 'Pile-specific analysis will be available after inference completes.'}
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
                <p>
                  The <strong>Relative Volume Index</strong> combines the detected box’s share of the image with its normalized median relative depth. It is a heuristic image-based indicator, not an actual volume measurement.
                </p>
                <p className="mt-2 text-xs">
                  Each pile is scored separately. Scores are not added together because pile boxes can overlap and would double-count image regions.
                </p>
              </div>
              {piles.map((pile) => {
                const detection = pile.detection_id ? detectionsById.get(pile.detection_id) : undefined;
                const indexValue = typeof pile.relative_volume_index === 'number' && Number.isFinite(pile.relative_volume_index)
                  ? pile.relative_volume_index
                  : null;
                const barWidth = indexValue === null ? 0 : Math.max(0, Math.min(100, indexValue));
                const rank = relativeVolumeRanks.get(pile.pile_index);
                return (
                  <div key={pile.detection_id ?? pile.pile_index} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">Pile {pile.pile_index}{detection ? ` · ${detection.predicted_class.replaceAll('_', ' ')}` : ''}</h4>
                        <p className="mt-1 text-xs text-gray-500">
                          Bounding box: {formatNumber(pile.bbox_width_pixels, 0)} × {formatNumber(pile.bbox_height_pixels, 0)} px · {formatNumber(pile.bbox_area_pixels, 0)} px²
                        </p>
                        {rank && rankedPiles.length > 1 && (
                          <p className="mt-1 text-xs font-medium text-emerald-800">
                            Relative index rank: {rank} of {rankedPiles.length} detected piles
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                          Relative Volume Index: {formatNumber(indexValue, 4)}
                        </span>
                        <span className={`text-xs capitalize ${pile.analysis_status === 'available' ? 'text-emerald-700' : 'text-amber-700'}`}>
                          Analysis {readable(pile.analysis_status, indexValue === null ? 'unavailable' : 'available')}
                        </span>
                      </div>
                    </div>
                    {indexValue !== null ? (
                      <div className="mt-3">
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100" role="meter" aria-label={`Relative Volume Index for pile ${pile.pile_index}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={barWidth}>
                          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${barWidth}%` }} />
                        </div>
                        <p className="mt-1 text-right text-[11px] text-gray-500">Indicator scale: 0–100</p>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-amber-700">
                        Relative Volume Index unavailable because this pile has no valid relative-depth estimate.
                      </p>
                    )}
                    <div className="mt-3 grid gap-3 text-xs text-gray-600 sm:grid-cols-2">
                      <p>Image area occupied: {formatNumber(pile.image_area_percentage, 4)}%</p>
                      <p>Bounding-box dimensions: {formatNumber(pile.bbox_width_pixels, 0)} × {formatNumber(pile.bbox_height_pixels, 0)} px</p>
                      <p>Median relative depth: {formatNumber(pile.relative_depth_median, 4)}</p>
                      <p>Relative-depth contribution (normalized): {formatNumber(pile.normalized_relative_depth, 4)} of 1</p>
                    </div>
                  </div>
                );
              })}
              {volume?.limitations?.length ? (
                <ul className="list-disc space-y-1 pl-5 text-xs text-gray-500">
                  {volume.limitations.map((limitation, index) => <li key={`${index}-${limitation}`}>{limitation}</li>)}
                </ul>
              ) : null}
            </>
          )}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <div className="card-header"><h3 className="section-title">Waste distribution and severity</h3></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Severity" value={severity} valueClassName={severityTextClass(analysis?.severity)} />
              <Metric label="Cleanup priority" value={priority} />
            </div>
            {Object.keys(classCounts).length > 0 ? (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Class counts</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(classCounts).map(([name, count]) => (
                    <span key={name} className="rounded-full border border-gray-200 px-3 py-1 text-xs capitalize text-gray-700">
                      {name.replaceAll('_', ' ')}: {count}
                    </span>
                  ))}
                </div>
              </div>
            ) : <p className="text-sm text-gray-500">Class distribution is unavailable until inference completes.</p>}
            {spatial && (
              <div className="border-t border-gray-100 pt-3">
                <h4 className="text-sm font-semibold text-gray-800">Image-space distribution</h4>
                <p className="mt-1 text-sm text-gray-700">{formatNumber(spatial.occupied_cells, 0)} of {formatNumber(spatial.total_cells, 0)} grid cells occupied</p>
                <p className="mt-1 text-xs text-gray-500">Concentration: {readable(spatial.concentration)}</p>
                {spatial.busiest_cell && (
                  <p className="mt-1 text-xs text-gray-500">Busiest cell: row {formatNumber(spatial.busiest_cell.row, 0)}, column {formatNumber(spatial.busiest_cell.column, 0)} ({formatNumber(spatial.busiest_cell.detection_count, 0)} detections)</p>
                )}
                {spatial.interpretation && <p className="mt-2 text-xs text-gray-500">{spatial.interpretation}</p>}
              </div>
            )}
          </div>
        </section>
        <section className="card">
          <div className="card-header"><h3 className="section-title">Review and processing</h3></div>
          <div className="card-body space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">AI processing</span><Status value={report.processing_status} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Admin review</span><Status value={report.review_status} />
            </div>
            <p className="text-xs text-gray-500">
              Spatial distribution and relative depth describe image-space model output only; they do not measure real-world distance or total waste quantity.
            </p>
          </div>
        </section>
      </section>
    </div>
  );
}

function PileSummary({ pile }: { pile: VolumePileAnalysis }) {
  return (
    <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-950">
      <p className="font-semibold">Waste pile · Relative Volume Index</p>
      <p className="mt-1">{formatNumber(pile.relative_volume_index, 4)} · {formatNumber(pile.image_area_percentage, 4)}% of image</p>
      <p className="mt-1">Image-based estimate using box area and relative depth.</p>
    </div>
  );
}
