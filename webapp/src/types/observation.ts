// ─────────────────────────────────────────────────────────────────────────────
// Core domain types for EcoWatch AI
// These types define the integration contract between the UI and the future
// real AI pipeline (YOLOv8n + MiDaS).
// ─────────────────────────────────────────────────────────────────────────────

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';
export type CalibrationStatus = 'not_calibrated' | 'partial' | 'calibrated';

export type WasteCategory =
  | 'Plastic'
  | 'Organic'
  | 'Glass'
  | 'Metal'
  | 'Paper'
  | 'Construction'
  | 'E-waste'
  | 'Textile'
  | 'Hazardous'
  | 'Mixed';

/** Geographic coordinate pair. */
export interface Coordinates {
  lat: number;
  lng: number;
}

/** A single bounding-box detection result. */
export interface Detection {
  id: string;
  category: WasteCategory;
  /** Confidence score in [0, 1]. */
  confidence: number;
  /** Normalised bounding box [x1, y1, x2, y2] in [0, 1]. */
  bbox: [number, number, number, number];
  /** Relative depth estimate from MiDaS (0 = near, 1 = far). Null when not yet computed. */
  relativeDepth: number | null;
}

/** Depth estimation result from MiDaS. */
export interface DepthResult {
  /** Simulated only – MiDaS not yet connected. */
  isSimulated: true;
  minRelativeDepth: number;
  maxRelativeDepth: number;
  meanRelativeDepth: number;
  /** Textual description of the depth map. */
  description: string;
}

/** Camera calibration state. */
export interface CalibrationInfo {
  status: CalibrationStatus;
  /** Whether a physical reference scale is available. */
  hasReferenceScale: boolean;
  /** Human-readable note about current calibration state. */
  note: string;
}

/** Volume estimation result. */
export interface VolumeEstimate {
  /** Always explicitly simulated in the current version. */
  isSimulated: true;
  estimatedVolumeLitres: number | null;
  method: string;
  caveat: string;
}

/** A single image analysis record. */
export interface Observation {
  id: string;
  imageName: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  location: ObservationLocation;
  status: AnalysisStatus;
  severity: Severity;
  detections: Detection[];
  depthResult: DepthResult | null;
  calibration: CalibrationInfo;
  volumeEstimate: VolumeEstimate | null;
  /** URL to the thumbnail image (relative public path or data URL). */
  thumbnailUrl: string | null;
  tags: string[];
}

/** Location attached to an observation. */
export interface ObservationLocation {
  name: string;
  district: string;
  coordinates: Coordinates;
  /** Is this location marked as a potential hotspot? */
  isPotentialHotspot: boolean;
}

/** An aggregated hotspot record derived from multiple observations. */
export interface Hotspot {
  id: string;
  locationName: string;
  district: string;
  coordinates: Coordinates;
  observationCount: number;
  dominantCategory: WasteCategory;
  severity: Severity;
  /** ISO 8601 timestamp of the most recent observation at this location. */
  lastSeen: string;
  totalDetections: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard summary types
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  totalImages: number;
  totalDetections: number;
  highSeverityCount: number;
  potentialHotspots: number;
  /** Always simulated in the current version. */
  simulatedTotalVolumeLitres: number;
  categoryDistribution: CategoryCount[];
  severityDistribution: SeverityCount[];
}

export interface CategoryCount {
  category: WasteCategory;
  count: number;
}

export interface SeverityCount {
  severity: Severity;
  count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics types
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalyticsData {
  observationsByDate: DateCount[];
  categoryDistribution: CategoryCount[];
  severityDistribution: SeverityCount[];
  locationComparison: LocationCount[];
  volumeTrend: DateVolume[];
}

export interface DateCount {
  date: string;
  count: number;
}

export interface LocationCount {
  location: string;
  count: number;
  severity: Severity;
}

export interface DateVolume {
  date: string;
  /** Simulated volume in litres. */
  simulatedVolumeLitres: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter types used across pages
// ─────────────────────────────────────────────────────────────────────────────

export interface ObservationFilters {
  search?: string;
  categories?: WasteCategory[];
  severities?: Severity[];
  dateFrom?: string;
  dateTo?: string;
  locationName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Image analysis request/response types
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalysisRequest {
  file: File;
}

export interface AnalysisResult {
  observation: Observation;
  /** Preview URL created via URL.createObjectURL – caller must revoke. */
  previewUrl: string;
}
