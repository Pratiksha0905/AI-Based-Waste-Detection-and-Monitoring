import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Image as ImageIcon,
  X,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Ruler,
  Layers,
  Box,
  FileText,
  RotateCcw,
} from 'lucide-react';
import type { AnalysisResult } from '../types/observation';
import { analyzeImage } from '../services/analysisService';
import SeverityBadge from '../components/SeverityBadge';
import { formatTimestamp, confidencePercent, categoryColor } from '../utils/display';

type UploadState = 'idle' | 'selected' | 'analyzing' | 'done' | 'error';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 20;

// ── Depth Viz ─────────────────────────────────────────────────────────────────

const DepthVisualization: React.FC<{ min: number; max: number; mean: number }> = ({
  min,
  max,
  mean,
}) => (
  <div className="space-y-3">
    <div className="depth-bar w-full" aria-label="Simulated depth gradient from near (dark blue) to far (light yellow)" />
    <div className="flex justify-between text-[11px] text-gray-500">
      <span>Near (0.0)</span>
      <span>Far (1.0)</span>
    </div>
    <div className="grid grid-cols-3 gap-3 text-center">
      {[
        { label: 'Min', value: min },
        { label: 'Mean', value: mean },
        { label: 'Max', value: max },
      ].map(({ label, value }) => (
        <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
          <div className="text-sm font-semibold text-gray-800 font-mono">
            {value.toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-500">{label} depth</div>
        </div>
      ))}
    </div>
  </div>
);

// ── Bounding Box Overlay ───────────────────────────────────────────────────────

const BBoxOverlay: React.FC<{
  bbox: [number, number, number, number];
  category: string;
  confidence: number;
  color: string;
}> = ({ bbox, category, confidence, color }) => {
  const [x1, y1, x2, y2] = bbox;
  return (
    <div
      className="absolute border-2 rounded-sm"
      style={{
        left: `${x1 * 100}%`,
        top: `${y1 * 100}%`,
        width: `${(x2 - x1) * 100}%`,
        height: `${(y2 - y1) * 100}%`,
        borderColor: color,
      }}
      role="img"
      aria-label={`Demo bounding box for ${category} with ${confidencePercent(confidence)} confidence`}
    >
      <div
        className="absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-semibold text-white rounded whitespace-nowrap"
        style={{ backgroundColor: color }}
      >
        {category} {confidencePercent(confidence)}
      </div>
    </div>
  );
};

// ── Image Analysis Page ───────────────────────────────────────────────────────

const ImageAnalysisPage: React.FC = () => {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Unsupported file type: ${file.type || 'unknown'}. Please use JPEG, PNG, or WebP.`;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_SIZE_MB} MB.`;
    }
    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const err = validateFile(file);
    if (err) {
      setError(err);
      setUploadState('error');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);
    setResult(null);
    setError(null);
    setUploadState('selected');
  }, [previewUrl]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setUploadState('analyzing');
    setError(null);
    try {
      const res = await analyzeImage(selectedFile);
      setResult(res);
      setUploadState('done');
    } catch {
      setError('Analysis failed unexpectedly. Please try again.');
      setUploadState('error');
    }
  };

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setUploadState('idle');
  };

  return (
    <div className="p-5 max-w-6xl mx-auto space-y-5">
      {/* AI Disclaimer */}
      <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
        <Info size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          <strong>Demo Analysis Mode:</strong> This workspace demonstrates the intended AI workflow.
          YOLOv8n detection and MiDaS depth estimation are <strong>not yet connected</strong>.
          All results shown are explicitly simulated and do not represent actual model predictions.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Left: Upload + Preview ─────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Upload zone */}
          {uploadState === 'idle' && (
            <div
              className={`upload-zone ${isDragging ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload image — click or drag and drop"
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <Upload size={24} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Drop an image here, or click to browse
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    JPEG, PNG, WebP — up to {MAX_SIZE_MB} MB
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleInputChange}
                aria-label="File input for image upload"
              />
            </div>
          )}

          {/* Image preview */}
          {(uploadState === 'selected' || uploadState === 'analyzing' || uploadState === 'done') && previewUrl && (
            <div className="card fade-in">
              <div className="card-header flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon size={15} className="text-gray-400" />
                  <span className="section-title">Selected Image</span>
                </div>
                <button
                  onClick={handleReset}
                  className="btn-ghost p-1.5 rounded-md text-xs"
                  aria-label="Remove selected image and reset"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="relative">
                <img
                  src={previewUrl}
                  alt={`Preview of ${selectedFile?.name ?? 'selected image'}`}
                  className="w-full object-contain max-h-72 bg-gray-50"
                />

                {/* Show demo bounding boxes if analysis is done */}
                {uploadState === 'done' && result && (
                  <div className="absolute inset-0">
                    {result.observation.detections.map((det) => (
                      <BBoxOverlay
                        key={det.id}
                        bbox={det.bbox}
                        category={det.category}
                        confidence={det.confidence}
                        color={categoryColor(det.category)}
                      />
                    ))}
                    <div className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white px-2 py-1 rounded font-medium">
                      DEMO VISUALIZATION — Not real detections
                    </div>
                  </div>
                )}

                {/* Analysis loading overlay */}
                {uploadState === 'analyzing' && (
                  <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-3">
                    <Loader2 size={32} className="text-emerald-700 animate-spin" />
                    <p className="text-sm font-medium text-gray-700">Running demo analysis…</p>
                    <p className="text-xs text-gray-400">Simulating YOLOv8n + MiDaS workflow</p>
                  </div>
                )}
              </div>
              <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
                <span className="font-medium">{selectedFile?.name}</span>
                {selectedFile && ` · ${(selectedFile.size / 1024).toFixed(0)} KB`}
              </div>
            </div>
          )}

          {/* Error state */}
          {uploadState === 'error' && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl fade-in">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
              <button onClick={handleReset} className="text-red-600 hover:text-red-800">
                <RotateCcw size={14} />
              </button>
            </div>
          )}

          {/* Action buttons */}
          {(uploadState === 'selected' || uploadState === 'error') && (
            <div className="flex gap-3">
              {uploadState === 'selected' && (
                <button
                  className="btn-primary flex-1"
                  onClick={handleAnalyze}
                  id="run-demo-analysis-btn"
                  aria-describedby="analysis-note"
                >
                  <Play size={14} aria-hidden="true" />
                  Run Demo Analysis
                </button>
              )}
              <button className="btn-secondary" onClick={handleReset}>
                <X size={14} aria-hidden="true" />
                Remove
              </button>
            </div>
          )}

          {uploadState === 'done' && (
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={handleReset}>
                <RotateCcw size={14} aria-hidden="true" />
                New Analysis
              </button>
              <button
                className="btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} aria-hidden="true" />
                Upload Another
              </button>
            </div>
          )}

          <p id="analysis-note" className="text-[11px] text-gray-400">
            * Demo analysis does not send data to any external server. All processing is local.
          </p>
        </div>

        {/* ── Right: Results ────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Empty state */}
          {uploadState === 'idle' && (
            <div className="card h-64 flex items-center justify-center text-center fade-in">
              <div className="empty-state">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3 mx-auto">
                  <ImageIcon size={24} className="text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">No image selected</p>
                <p className="text-xs text-gray-400 mt-1">Upload an image to see demo analysis results</p>
              </div>
            </div>
          )}

          {/* Analyzing state */}
          {uploadState === 'analyzing' && (
            <div className="card h-64 flex items-center justify-center fade-in">
              <div className="empty-state">
                <Loader2 size={28} className="text-emerald-700 animate-spin mb-3" />
                <p className="text-sm font-medium text-gray-700">Running demo analysis…</p>
                <p className="text-xs text-gray-400 mt-1">Simulating detection + depth workflow</p>
              </div>
            </div>
          )}

          {/* Results */}
          {uploadState === 'done' && result && (
            <div className="space-y-4 fade-in">
              {/* Summary banner */}
              <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Demo analysis complete</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    {result.observation.detections.length} illustrative detection{result.observation.detections.length !== 1 ? 's' : ''} ·
                    {' '}<SeverityBadge severity={result.observation.severity} />
                  </p>
                </div>
              </div>

              {/* A. Waste Detection */}
              <div className="card">
                <div className="card-header flex items-center gap-2">
                  <Layers size={14} className="text-gray-400" />
                  <span className="section-title">A. Waste Detection</span>
                  <span className="ml-auto badge badge-demo">Simulated</span>
                </div>
                <div className="card-body space-y-3">
                  {result.observation.detections.map((det, i) => (
                    <div key={det.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: categoryColor(det.category) }}
                        aria-hidden="true"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-800">{det.category}</span>
                        <div className="flex gap-4 mt-0.5 text-[11px] text-gray-500 font-mono">
                          <span>Conf: {confidencePercent(det.confidence)}</span>
                          <span>Depth: {det.relativeDepth?.toFixed(2) ?? 'N/A'}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          bbox [{det.bbox.map(v => v.toFixed(2)).join(', ')}]
                        </div>
                      </div>
                      <span className="text-[11px] text-gray-400">#{i + 1}</span>
                    </div>
                  ))}
                  <p className="text-[11px] text-violet-600 bg-violet-50 border border-violet-200 px-2 py-1 rounded-md">
                    Confidence scores and bounding boxes are illustrative. YOLOv8n is not connected.
                  </p>
                </div>
              </div>

              {/* B. Depth Estimation */}
              {result.observation.depthResult && (
                <div className="card">
                  <div className="card-header flex items-center gap-2">
                    <Ruler size={14} className="text-gray-400" />
                    <span className="section-title">B. Depth Estimation</span>
                    <span className="ml-auto badge badge-demo">Simulated</span>
                  </div>
                  <div className="card-body space-y-3">
                    <DepthVisualization
                      min={result.observation.depthResult.minRelativeDepth}
                      max={result.observation.depthResult.maxRelativeDepth}
                      mean={result.observation.depthResult.meanRelativeDepth}
                    />
                    <p className="text-xs text-gray-600">{result.observation.depthResult.description}</p>
                    <p className="text-[11px] text-violet-600 bg-violet-50 border border-violet-200 px-2 py-1 rounded-md">
                      MiDaS depth model not connected. These relative depth values are simulated.
                    </p>
                  </div>
                </div>
              )}

              {/* C. Calibration */}
              <div className="card">
                <div className="card-header flex items-center gap-2">
                  <Ruler size={14} className="text-gray-400" />
                  <span className="section-title">C. Calibration Status</span>
                </div>
                <div className="card-body space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-300 flex-shrink-0" aria-hidden="true" />
                    <span className="text-sm text-gray-600 capitalize">
                      {result.observation.calibration.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{result.observation.calibration.note}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Reference scale:</span>
                    <span className={result.observation.calibration.hasReferenceScale ? 'text-emerald-600' : 'text-gray-400'}>
                      {result.observation.calibration.hasReferenceScale ? 'Available' : 'Not available'}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
                    Metric calibration not yet implemented. Physical size measurements are unavailable.
                  </p>
                </div>
              </div>

              {/* D. Volume Estimation */}
              {result.observation.volumeEstimate && (
                <div className="card">
                  <div className="card-header flex items-center gap-2">
                    <Box size={14} className="text-gray-400" />
                    <span className="section-title">D. Volume Estimation</span>
                    <span className="ml-auto badge badge-demo">Simulated</span>
                  </div>
                  <div className="card-body space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gray-800 font-mono">
                        {result.observation.volumeEstimate.estimatedVolumeLitres?.toFixed(1) ?? 'N/A'}
                      </span>
                      <span className="text-sm text-gray-500">litres</span>
                      <span className="badge badge-demo ml-2">Illustrative</span>
                    </div>
                    <p className="text-xs text-gray-500">{result.observation.volumeEstimate.method}</p>
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
                      {result.observation.volumeEstimate.caveat}
                    </p>
                  </div>
                </div>
              )}

              {/* E. Analysis Summary */}
              <div className="card">
                <div className="card-header flex items-center gap-2">
                  <FileText size={14} className="text-gray-400" />
                  <span className="section-title">E. Analysis Summary</span>
                </div>
                <div className="card-body">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <dt className="text-gray-500">Image</dt>
                    <dd className="text-gray-800 font-medium truncate">{result.observation.imageName}</dd>

                    <dt className="text-gray-500">Analyzed at</dt>
                    <dd className="text-gray-800">{formatTimestamp(result.observation.timestamp)}</dd>

                    <dt className="text-gray-500">Detections</dt>
                    <dd className="text-gray-800">{result.observation.detections.length} (illustrative)</dd>

                    <dt className="text-gray-500">Severity</dt>
                    <dd><SeverityBadge severity={result.observation.severity} /></dd>

                    <dt className="text-gray-500">Status</dt>
                    <dd className="text-emerald-700 font-medium capitalize">Demo completed</dd>
                  </dl>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageAnalysisPage;
