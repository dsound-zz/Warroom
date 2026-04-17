import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function Companies() {
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['companies', search],
    queryFn: () => api.companies.list({ search: search || undefined, limit: 100 }),
    placeholderData: (prev) => prev,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground mb-1">Companies</h1>
      <p className="text-muted text-sm mb-6">Resolved company entities</p>

      <input
        id="company-search"
        type="search"
        placeholder="Search companies…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm bg-surface border border-border rounded-lg px-4 py-2 text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent/50 mb-6"
      />

      {isLoading && (
        <div className="flex items-center gap-2 text-muted text-sm">
          <div className="w-4 h-4 border border-muted border-t-accent rounded-full animate-spin" />
          Loading…
        </div>
      )}

      {error && (
        <div className="text-danger text-sm border border-danger/30 bg-danger/5 rounded-lg px-4 py-3">
          {error instanceof Error ? error.message : 'Error'}
        </div>
      )}

      {data && (
        <>
          <p className="text-xs text-muted mb-4">{data.total} companies</p>
          <div className="grid gap-2">
            {data.items.map((company) => (
              <div
                key={company.id}
                className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center justify-between gap-4 hover:border-accent/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{company.name}</p>
                  {company.domain && (
                    <p className="text-xs text-muted font-mono mt-0.5">{company.domain}</p>
                  )}
                </div>
                <span className="text-xs text-muted font-mono bg-bg px-2 py-0.5 rounded border border-border">
                  #{company.id}
                </span>
              </div>
            ))}
          </div>
          {data.items.length === 0 && (
            <p className="text-muted text-sm mt-8 text-center">No companies yet.</p>
          )}
        </>
      )}
    </div>
  );
}
