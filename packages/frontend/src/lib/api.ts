import type {
  SignalListResponse,
  CompanyListResponse,
  ApplicationListResponse,
  Signal,
  Company,
  Application,
} from '@warroom/shared';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// Signals
export const api = {
  signals: {
    list: (params?: { limit?: number; offset?: number; companyId?: number }) =>
      request<SignalListResponse>(
        `/signals?${new URLSearchParams(Object.entries(params ?? {}).map(([k, v]) => [k, String(v)])).toString()}`,
      ),
    get: (id: number) => request<Signal>(`/signals/${id}`),
  },

  companies: {
    list: (params?: { limit?: number; offset?: number; search?: string }) =>
      request<CompanyListResponse>(
        `/companies?${new URLSearchParams(Object.entries(params ?? {}).map(([k, v]) => [k, String(v)])).toString()}`,
      ),
    get: (id: number) => request<Company>(`/companies/${id}`),
  },

  applications: {
    list: (params?: { limit?: number; offset?: number; stage?: string }) =>
      request<ApplicationListResponse>(
        `/applications?${new URLSearchParams(Object.entries(params ?? {}).map(([k, v]) => [k, String(v)])).toString()}`,
      ),
    get: (id: number) => request<Application>(`/applications/${id}`),
    updateStage: (id: number, stage: string) =>
      request<Application>(`/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      }),
  },
};
