import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fetchSignals, dismissSignal, addSignalAction } from '../lib/api.js';
import { SignalCard } from '../components/SignalCard.js';
import type { SignalsListResponse } from '@warroom/shared';

type SourceFilter = 'hn' | 'techcrunch' | 'engBlogs';

const SOURCE_PILLS: { label: string; value: SourceFilter | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'HN', value: 'hn' },
  { label: 'TechCrunch', value: 'techcrunch' },
  { label: 'Eng Blogs', value: 'engBlogs' },
];

const LOCATION_PRESETS: { label: string; value: string }[] = [
  { label: 'All locations', value: '' },
  { label: 'NYC / Remote', value: 'nyc OR new york OR remote' },
  { label: 'Remote only', value: 'remote' },
  { label: 'NYC only', value: 'nyc OR new york OR manhattan OR brooklyn' },
];

export function Today() {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSource, setSelectedSource] = useState<SourceFilter | undefined>(undefined);
  const [hideDna, setHideDna] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const QUERY_KEY = ['signals', { limit: 100, includeActed: true, search: debouncedSearch, source: selectedSource }] as const;

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchSignals({
      limit: 100,
      includeActed: true,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(selectedSource ? { source: selectedSource } : {}),
    }),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: import('@warroom/shared').CreateSignalAction }) =>
      addSignalAction(id, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const snapshot = qc.getQueryData<SignalsListResponse>(QUERY_KEY);
      qc.setQueryData<SignalsListResponse>(QUERY_KEY, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((s) => {
            if (s.id !== id) return s;
            return {
              ...s,
              actedOn: true,
              latestAction: {
                id: Date.now(),
                signalId: id,
                statusTags: body.statusTags,
                contact: body.contact ?? null,
                note: body.note ?? null,
                createdAt: new Date().toISOString(),
              },
            };
          }),
        };
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(QUERY_KEY, ctx.snapshot);
      alert('Failed to save action');
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const dismissMutation = useMutation({
    mutationFn: dismissSignal,
    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const snapshot = qc.getQueryData<SignalsListResponse>(QUERY_KEY);
      qc.setQueryData<SignalsListResponse>(QUERY_KEY, (prev) => {
        if (!prev) return prev;
        return { ...prev, items: prev.items.filter((s) => s.id !== id) };
      });
      return { snapshot };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(QUERY_KEY, ctx.snapshot);
      alert('Failed to dismiss signal');
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });



  return (
    <div>
      <h1 className="font-serif text-4xl mb-2">Today</h1>
      <p className="text-muted">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>

      <div className="flex flex-col gap-3 mb-6 mt-8">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Filter signals..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 min-w-48 bg-surface border border-border rounded px-3 py-2 text-foreground placeholder-muted focus:outline-none focus:border-accent"
          />
          <div className="flex items-center gap-2">
            {SOURCE_PILLS.map((pill) => (
              <button
                key={pill.label}
                onClick={() => setSelectedSource(pill.value)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  selectedSource === pill.value
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-border text-muted hover:border-accent/50'
                }`}
              >
                {pill.label}
              </button>
            ))}
            <button
              onClick={() => setHideDna((v) => !v)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                hideDna
                  ? 'border-danger text-danger bg-danger/10'
                  : 'border-border text-muted hover:border-danger/50'
              }`}
            >
              Hide DNA
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted">Location:</span>
          {LOCATION_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setSearchInput(preset.value)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                debouncedSearch === preset.value
                  ? 'border-accent text-accent bg-accent/10'
                  : 'border-border text-muted hover:border-accent/50'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <h2 className="text-xl mb-4">Recent signals (last 7 days)</h2>

      {query.isLoading && <p className="text-muted">Loading...</p>}

      {query.isError && (
        <div>
          <p className="text-danger mb-2">
            {query.error instanceof Error ? query.error.message : 'Unknown error'}
          </p>
          <button
            onClick={() => void query.refetch()}
            className="text-sm text-accent hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {query.data && query.data.items.length === 0 && (
        <div className="text-muted mt-8">
          <p>No signals yet. Run the HN ingester.</p>
          <pre className="mt-2 text-sm bg-surface border border-border rounded p-3 text-foreground font-mono">
            pnpm ingester:hn
          </pre>
        </div>
      )}

      {query.data && query.data.items.length > 0 && (
        <div>
          {query.data.items.filter((s) => !hideDna || !s.isDna).map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onAction={(id, body) => actionMutation.mutate({ id, body })}
              onDismiss={(id) => dismissMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
