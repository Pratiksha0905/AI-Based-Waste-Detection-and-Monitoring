/**
 * EcoWatch AI — Centralized API client.
 *
 * Base URL is read from VITE_API_URL (defaults to http://localhost:8000).
 * All requests automatically attach the stored Bearer token.
 * 401 responses clear the token and redirect to /login.
 */

const BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000';

function getToken(): string | null {
  return localStorage.getItem('ecowatch_token');
}

function clearToken(): void {
  localStorage.removeItem('ecowatch_token');
}

export function setToken(token: string): void {
  localStorage.setItem('ecowatch_token', token);
}

function buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthenticated');
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
  });
  return handleResponse<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: buildHeaders(), // no Content-Type — browser sets multipart boundary
    body: form,
  });
  return handleResponse<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

/** Returns the raw Response so the caller can stream binary data (images). */
export async function apiGetRaw(path: string): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: buildHeaders(),
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthenticated');
  }
  return res;
}

export { BASE_URL };
