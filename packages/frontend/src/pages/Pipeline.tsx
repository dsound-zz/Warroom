import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../lib/api.js';
import { STAGES, STAGE_LABELS, type Stage, type Application } from '@warroom/shared';

export function Pipeline() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['applications'],
    queryFn: () => api.applications.list({ limit: 200 }),
  });

  const byStage = STAGES.reduce<Record<Stage, Application[]>>((acc, s) => {
    acc[s] = [];
    return acc;
  }, {} as Record<Stage, Application[]>);

  if (data) {
    for (const app of data.items) {
      const stage = app.stage as Stage;
      byStage[stage]?.push(app);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground mb-1">Pipeline</h1>
      <p className="text-muted text-sm mb-8">Application tracker by stage</p>

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
        <div className="space-y-8">
          {STAGES.map((stage) => {
            const items = byStage[stage] ?? [];
            if (items.length === 0) return null;

            return (
              <section key={stage}>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
                  {STAGE_LABELS[stage]}
                  <span className="text-accent font-mono">{items.length}</span>
                </h2>
                <div className="grid gap-2">
                  {items.map((app) => (
                    <div
                      key={app.id}
                      className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center justify-between gap-4 hover:border-accent/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{app.role}</p>
                        <p className="text-xs text-muted mt-0.5">{app.companyName ?? '—'}</p>
                      </div>
                      <div className="shrink-0 text-xs text-muted font-mono">
                        {app.lastActivityAt
                          ? format(new Date(app.lastActivityAt), 'MMM d')
                          : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          {data.items.length === 0 && (
            <p className="text-muted text-sm mt-8 text-center">
              No applications yet. Import one to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
