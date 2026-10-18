// ─────────────────────────────────────────────────────────────────────────────
// Analysis Service
//
// This module provides the application's data and analysis contract.
// Currently backed by mock data only.
//
// FUTURE INTEGRATION:
//   Replace the implementations below with real API calls once the backend
//   (YOLOv8n + MiDaS pipeline) is available.  The function signatures and
//   return types should remain unchanged.
//
// Integration contract:
//   analyzeImage(file: File) → AnalysisResult
//     POST /api/analyze with multipart/form-data
//     Returns detection, depth, calibration, and volume-estimation results.
//
//   getObservations(filters) → Observation[]
//     GET /api/observations?...
//
//   getObservationById(id) → Observation | null
//     GET /api/observations/:id
//
//   getDashboardSummary() → DashboardSummary
//     GET /api/dashboard/summary
//
//   getHotspots(filters) → Hotspot[]
//     GET /api/hotspots?...
//
//   getAnalytics(filters) → AnalyticsData
//     GET /api/analytics?...
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Observation,
  Hotspot,
  DashboardSummary,
  AnalyticsData,
  ObservationFilters,
  AnalysisResult,
  WasteCategory,
  Detection,
} from '../types/observation';

import {
  MOCK_OBSERVATIONS,
  MOCK_HOTSPOTS,
  MOCK_DAILY_OBSERVATIONS,
  MOCK_VOLUME_TREND,
} from '../data/mockObservations';

// ─── Utility helpers ──────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyFilters(
  observations: Observation[],
  filters: ObservationFilters,
): Observation[] {
  return observations.filter((obs) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match =
        obs.imageName.toLowerCase().includes(q) ||
        obs.location.name.toLowerCase().includes(q) ||
        obs.location.district.toLowerCase().includes(q) ||
        obs.detections.some((d) => d.category.toLowerCase().includes(q));
      if (!match) return false;
    }

    if (filters.categories && filters.categories.length > 0) {
      const hasCategory = obs.detections.some((d) =>
        filters.categories!.includes(d.category),
      );
      if (!hasCategory) return false;
    }

    if (filters.severities && filters.severities.length > 0) {
      if (!filters.severities.includes(obs.severity)) return false;
    }

    if (filters.locationName) {
      if (
        !obs.location.name
          .toLowerCase()
          .includes(filters.locationName.toLowerCase())
      )
        return false;
    }

    if (filters.dateFrom) {
      if (obs.timestamp < filters.dateFrom) return false;
    }

    if (filters.dateTo) {
      if (obs.timestamp > filters.dateTo) return false;
    }

    return true;
  });
}

// ─── Demo analysis payload ────────────────────────────────────────────────────

/** Generates a deterministic demo analysis result for any uploaded file. */
function buildDemoObservation(file: File): Observation {
  const now = new Date().toISOString();
  const detections: Detection[] = [
    {
      id: 'demo-det-1',
      category: 'Plastic',
      confidence: 0.87,
      bbox: [0.10, 0.25, 0.45, 0.65],
      relativeDepth: 0.42,
    },
    {
      id: 'demo-det-2',
      category: 'Organic',
      confidence: 0.74,
      bbox: [0.50, 0.30, 0.82, 0.70],
      relativeDepth: 0.48,
    },
    {
      id: 'demo-det-3',
      category: 'Paper',
      confidence: 0.61,
      bbox: [0.20, 0.60, 0.55, 0.88],
      relativeDepth: 0.45,
    },
  ];

  return {
    id: `demo-${Date.now()}`,
    imageName: file.name,
    timestamp: now,
    location: {
      name: 'User Upload — Location Unknown',
      district: 'Unspecified',
      coordinates: { lat: 12.9716, lng: 77.5946 },
      isPotentialHotspot: false,
    },
    status: 'completed',
    severity: 'medium',
    detections,
    depthResult: {
      isSimulated: true,
      minRelativeDepth: 0.28,
      maxRelativeDepth: 0.74,
      meanRelativeDepth: 0.45,
      description:
        'Simulated depth map — MiDaS model not yet connected. Values are illustrative.',
    },
    calibration: {
      status: 'not_calibrated',
      hasReferenceScale: false,
      note:
        'Camera calibration has not been implemented. Physical measurements are not available.',
    },
    volumeEstimate: {
      isSimulated: true,
      estimatedVolumeLitres: 28.5,
      method: 'Simulated geometric approximation (demo only)',
      caveat:
        'Volume estimation requires validated calibration and geometric assumptions. ' +
        'This value is a demonstration figure and does not reflect measured physical volume.',
    },
    thumbnailUrl: null,
    tags: ['user-upload', 'demo'],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Simulates uploading an image and receiving AI analysis results.
 *
 * FUTURE: Replace with real API call to the inference backend.
 */
export async function analyzeImage(file: File): Promise<AnalysisResult> {
  // Simulate network + inference latency
  await sleep(2800);

  const observation = buildDemoObservation(file);
  const previewUrl = URL.createObjectURL(file);

  return { observation, previewUrl };
}

/**
 * Returns all observations, optionally filtered.
 *
 * FUTURE: Replace with GET /api/observations?...
 */
export async function getObservations(
  filters: ObservationFilters = {},
): Promise<Observation[]> {
  await sleep(150);
  const sorted = [...MOCK_OBSERVATIONS].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  return applyFilters(sorted, filters);
}

/**
 * Returns a single observation by ID.
 *
 * FUTURE: Replace with GET /api/observations/:id
 */
export async function getObservationById(
  id: string,
): Promise<Observation | null> {
  await sleep(80);
  return MOCK_OBSERVATIONS.find((o) => o.id === id) ?? null;
}

/**
 * Returns the dashboard summary derived from all observations.
 *
 * FUTURE: Replace with GET /api/dashboard/summary
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  await sleep(120);

  const categoryMap = new Map<WasteCategory, number>();
  let totalDetections = 0;

  for (const obs of MOCK_OBSERVATIONS) {
    for (const det of obs.detections) {
      categoryMap.set(det.category, (categoryMap.get(det.category) ?? 0) + 1);
      totalDetections++;
    }
  }

  const severityMap = new Map<string, number>();
  for (const obs of MOCK_OBSERVATIONS) {
    severityMap.set(obs.severity, (severityMap.get(obs.severity) ?? 0) + 1);
  }

  const simulatedTotalVolume = MOCK_OBSERVATIONS.reduce(
    (sum, obs) => sum + (obs.volumeEstimate?.estimatedVolumeLitres ?? 0),
    0,
  );

  return {
    totalImages: MOCK_OBSERVATIONS.length,
    totalDetections,
    highSeverityCount: MOCK_OBSERVATIONS.filter(
      (o) => o.severity === 'high' || o.severity === 'critical',
    ).length,
    potentialHotspots: MOCK_HOTSPOTS.length,
    simulatedTotalVolumeLitres: Math.round(simulatedTotalVolume),
    categoryDistribution: Array.from(categoryMap.entries()).map(
      ([category, count]) => ({ category, count }),
    ),
    severityDistribution: Array.from(severityMap.entries()).map(
      ([severity, count]) => ({
        severity: severity as DashboardSummary['severityDistribution'][number]['severity'],
        count,
      }),
    ),
  };
}

/**
 * Returns hotspots, optionally filtered by severity.
 *
 * FUTURE: Replace with GET /api/hotspots?...
 */
export async function getHotspots(
  filters: { severities?: string[] } = {},
): Promise<Hotspot[]> {
  await sleep(100);
  let hotspots = [...MOCK_HOTSPOTS];
  if (filters.severities && filters.severities.length > 0) {
    hotspots = hotspots.filter((h) =>
      filters.severities!.includes(h.severity),
    );
  }
  return hotspots;
}

/**
 * Returns analytics data, optionally filtered.
 *
 * FUTURE: Replace with GET /api/analytics?...
 */
export async function getAnalytics(
  _filters: ObservationFilters = {},
): Promise<AnalyticsData> {
  await sleep(200);

  const categoryMap = new Map<WasteCategory, number>();
  const severityMap = new Map<string, number>();
  const locationMap = new Map<string, { count: number; severity: string }>();

  for (const obs of MOCK_OBSERVATIONS) {
    for (const det of obs.detections) {
      categoryMap.set(det.category, (categoryMap.get(det.category) ?? 0) + 1);
    }
    severityMap.set(obs.severity, (severityMap.get(obs.severity) ?? 0) + 1);
    const loc = obs.location.name;
    const existing = locationMap.get(loc);
    if (existing) {
      existing.count++;
    } else {
      locationMap.set(loc, { count: 1, severity: obs.severity });
    }
  }

  return {
    observationsByDate: MOCK_DAILY_OBSERVATIONS,
    categoryDistribution: Array.from(categoryMap.entries()).map(
      ([category, count]) => ({ category, count }),
    ),
    severityDistribution: Array.from(severityMap.entries()).map(
      ([severity, count]) => ({
        severity: severity as 'low' | 'medium' | 'high' | 'critical',
        count,
      }),
    ),
    locationComparison: Array.from(locationMap.entries())
      .map(([location, { count, severity }]) => ({
        location,
        count,
        severity: severity as 'low' | 'medium' | 'high' | 'critical',
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    volumeTrend: MOCK_VOLUME_TREND,
  };
}
