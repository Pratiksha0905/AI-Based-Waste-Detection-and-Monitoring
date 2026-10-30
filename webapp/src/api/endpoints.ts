/**
 * EcoWatch AI — Typed API wrappers for all backend endpoints.
 * Keeps all URL strings and response-type mappings in one place.
 */

import { apiGet, apiPatch, apiPost, apiPostForm } from './client';

// ── Types mirroring backend Pydantic schemas ───────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  is_active: boolean;
  created_at: string;
}

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ReviewStatus = 'pending_review' | 'reviewed' | 'resolved' | 'rejected';

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export interface DetectionOut {
  id: string;
  predicted_class: string;
  confidence: number;
  bbox?: { x1: number; y1: number; x2: number; y2: number } | null;
  relative_depth?: number | null;
  model_version?: string | null;
  analyzed_at: string;
}

export interface ReportOut {
  id: string;
  user_id: string;
  image_key: string;
  latitude: number;
  longitude: number;
  description?: string | null;
  submitted_at: string;
  updated_at: string;
  processing_status: ProcessingStatus;
  review_status: ReviewStatus;
  retry_count: number;
  processing_error?: string | null;
  detections: DetectionOut[];
}

export interface ReportSummary {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  description?: string | null;
  submitted_at: string;
  processing_status: ProcessingStatus;
  review_status: ReviewStatus;
  detection_count: number;
}

export interface PaginatedReports {
  items: ReportSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface HotspotOut {
  id: string;
  latitude: number;
  longitude: number;
  report_count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  color: string;
  dominant_category?: string | null;
  last_report_at?: string | null;
}

export type Severity = HotspotOut['severity'];

export interface HotspotListResponse {
  items: HotspotOut[];
  total: number;
  cluster_radius_m: number;
}

export interface StatusCount { status: string; count: number; }
export interface CategoryCount { category: string; count: number; }
export interface SeverityCount { severity: string; count: number; }

export interface DashboardStats {
  total_reports: number;
  reports_today: number;
  reports_last_7_days: number;
  reports_last_30_days: number;
  by_processing_status: StatusCount[];
  by_review_status: StatusCount[];
  distinct_reporters: number;
  hotspot_count: number;
  by_hotspot_severity: SeverityCount[];
  model_available: boolean;
  total_detections?: number | null;
  top_waste_categories?: CategoryCount[] | null;
  processing_success_rate?: number | null;
}

export interface TrendPoint { date: string; count: number; }
export interface TrendsResponse { observations_by_date: TrendPoint[]; days: number; }

export interface HealthStatus { status: string; database: boolean; }
export interface ModelStatus { available: boolean; model_path?: string | null; error?: string | null; }

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (name: string, email: string, password: string) =>
    apiPost<UserProfile>('/api/auth/register', { name, email, password }),

  login: (email: string, password: string) =>
    apiPost<TokenResponse>('/api/auth/login', { email, password }),

  me: () => apiGet<UserProfile>('/api/auth/me'),
};

// ── Reports ───────────────────────────────────────────────────────────────────

export const reportsApi = {
  submit: (image: File, latitude: number, longitude: number, description?: string) => {
    const form = new FormData();
    form.append('image', image);
    form.append('latitude', String(latitude));
    form.append('longitude', String(longitude));
    if (description) form.append('description', description);
    return apiPostForm<ReportOut>('/api/reports', form);
  },

  myReports: (page = 1, pageSize = 20) =>
    apiGet<PaginatedReports>(`/api/reports/my?page=${page}&page_size=${pageSize}`),

  allReports: (page = 1, pageSize = 20, processingStatus?: ProcessingStatus, reviewStatus?: ReviewStatus) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (processingStatus) params.set('processing_status', processingStatus);
    if (reviewStatus) params.set('review_status', reviewStatus);
    return apiGet<PaginatedReports>(`/api/reports?${params}`);
  },

  getById: (id: string) => apiGet<ReportOut>(`/api/reports/${id}`),

  updateStatus: (id: string, review_status: ReviewStatus) =>
    apiPatch<ReportOut>(`/api/reports/${id}/status`, { review_status }),

  retry: (id: string) =>
    apiPost<ReportOut>(`/api/reports/${id}/retry`, {}),

  imageUrl: (id: string) => `/api/reports/${id}/image`,
};

// ── Hotspots ──────────────────────────────────────────────────────────────────

export const hotspotsApi = {
  get: () => apiGet<HotspotListResponse>('/api/hotspots'),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const dashboardApi = {
  stats: () => apiGet<DashboardStats>('/api/dashboard/stats'),
  trends: (days = 14) => apiGet<TrendsResponse>(`/api/dashboard/trends?days=${days}`),
};

// ── Health ────────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => apiGet<HealthStatus>('/api/health'),
  model: () => apiGet<ModelStatus>('/api/health/model'),
};
