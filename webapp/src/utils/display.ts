import type { Severity, WasteCategory } from '../types/observation';

export function severityColor(severity: Severity): string {
  switch (severity) {
    case 'low':
      return 'text-emerald-700';
    case 'medium':
      return 'text-amber-600';
    case 'high':
      return 'text-orange-600';
    case 'critical':
      return 'text-red-600';
  }
}

export function severityBg(severity: Severity): string {
  switch (severity) {
    case 'low':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'medium':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'high':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    case 'critical':
      return 'bg-red-50 text-red-800 border-red-200';
  }
}

export function severityDot(severity: Severity): string {
  switch (severity) {
    case 'low':
      return 'bg-emerald-500';
    case 'medium':
      return 'bg-amber-500';
    case 'high':
      return 'bg-orange-500';
    case 'critical':
      return 'bg-red-500';
  }
}

export function severityMarkerColor(severity: Severity): string {
  switch (severity) {
    case 'low':
      return '#10b981';
    case 'medium':
      return '#f59e0b';
    case 'high':
      return '#f97316';
    case 'critical':
      return '#ef4444';
  }
}

export function categoryColor(category: WasteCategory): string {
  const map: Record<WasteCategory, string> = {
    Plastic: '#3b82f6',
    Organic: '#10b981',
    Glass: '#8b5cf6',
    Metal: '#6b7280',
    Paper: '#f59e0b',
    Construction: '#92400e',
    'E-waste': '#ec4899',
    Textile: '#14b8a6',
    Hazardous: '#ef4444',
    Mixed: '#64748b',
  };
  return map[category] ?? '#64748b';
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function severityLabel(s: Severity): string {
  return capitalise(s);
}

export function confidencePercent(conf: number): string {
  return `${Math.round(conf * 100)}%`;
}

export function getSeverityAriaLabel(severity: Severity): string {
  const labels: Record<Severity, string> = {
    low: 'Low severity',
    medium: 'Medium severity',
    high: 'High severity',
    critical: 'Critical severity',
  };
  return labels[severity];
}
