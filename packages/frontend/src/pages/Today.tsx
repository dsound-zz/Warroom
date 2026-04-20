import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fetchSignals, actOnSignal, dismissSignal } from '../lib/api.js';
import { SignalCard } from '../components/SignalCard.js';
import type { SignalsListResponse } from '@warroom/shared';

const QUERY_KEY = ['signals', { limit: 100, includeActed: true }] as const;

export function Today() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchSignals({ limit: 100, includeActed: true }),
  });

  const actMutation = useMutation({
    mutationFn: actOnSignal,
    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const snapshot = qc.getQueryData<SignalsListResponse>(QUERY_KEY);
      qc.setQueryData<SignalsListResponse>(QUERY_KEY, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((s) => (s.id === id ? { ...s, actedOn: true } : s)),
        };
      });
      return { snapshot };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(QUERY_KEY, ctx.snapshot);
      alert('Failed to mark acted');
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

      <h2 className="text-xl mb-4 mt-8">Recent signals (last 7 days)</h2>

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
          {query.data.items.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onAct={(id) => actMutation.mutate(id)}
              onDismiss={(id) => dismissMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
