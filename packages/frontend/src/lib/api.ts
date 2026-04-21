import {
  SignalsListResponseSchema,
  SignalSchema,
  CompanyListResponseSchema,
  DoNotApplySchema,
  type Signal,
  type SignalsListResponse,
  type SignalsListQuery,
  type CompanyListResponse,
  type DoNotApply,
  type CreateDoNotApply,
} from '@warroom/shared';

const BASE = '/api';

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method: 'POST' };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchSignals(params: Partial<SignalsListQuery>): Promise<SignalsListResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const raw = await apiGet<unknown>(`/signals?${qs.toString()}`);
  return SignalsListResponseSchema.parse(raw);
}

export async function actOnSignal(id: number): Promise<Signal> {
  const raw = await apiPost<unknown>(`/signals/${id}/act`);
  return SignalSchema.parse(raw);
}

export async function dismissSignal(id: number): Promise<Signal> {
  const raw = await apiPost<unknown>(`/signals/${id}/dismiss`);
  return SignalSchema.parse(raw);
}

export async function fetchCompanies(
  params: { search?: string; limit?: number; offset?: number } = {},
): Promise<CompanyListResponse> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const raw = await apiGet<unknown>(`/companies?${qs.toString()}`);
  return CompanyListResponseSchema.parse(raw);
}

export async function fetchDoNotApply(): Promise<{ items: DoNotApply[]; total: number }> {
  const raw = await apiGet<{ items: unknown[]; total: number }>('/do-not-apply?limit=200');
  return { items: raw.items.map((i) => DoNotApplySchema.parse(i)), total: raw.total };
}

export async function addToDoNotApply(body: CreateDoNotApply): Promise<DoNotApply> {
  const raw = await apiPost<unknown>('/do-not-apply', body);
  return DoNotApplySchema.parse(raw);
}

export async function removeFromDoNotApply(id: number): Promise<void> {
  const res = await fetch(`${BASE}/do-not-apply/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error ?? `HTTP ${res.status}`);
  }
}
