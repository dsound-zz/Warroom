import {
  SignalsListResponseSchema,
  SignalSchema,
  type Signal,
  type SignalsListResponse,
  type SignalsListQuery,
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
