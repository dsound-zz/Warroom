import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { SignalCard } from '../components/SignalCard.js';

export function Today() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['signals', 'today'],
    queryFn: () => api.signals.list({ limit: 50 }),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Today</h1>
        <p className="text-muted text-sm mt-1">Latest hiring signals across all sources</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted text-sm">
          <div className="w-4 h-4 border border-muted border-t-accent rounded-full animate-spin" />
          Loading signals…
        </div>
      )}

      {error && (
        <div className="text-danger text-sm border border-danger/30 bg-danger/5 rounded-lg px-4 py-3">
          Failed to load signals: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {data && (
        <>
          <p className="text-xs text-muted mb-4">
            {data.total} signal{data.total !== 1 ? 's' : ''} total
          </p>
          <div className="grid gap-3">
            {data.items.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
          {data.items.length === 0 && (
            <p className="text-muted text-sm mt-8 text-center">
              No signals yet. Run an ingester to populate.
            </p>
          )}
        </>
      )}
    </div>
  );
}
