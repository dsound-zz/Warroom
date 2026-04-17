import { formatDistanceToNow } from 'date-fns';
import type { Signal } from '@warroom/shared';

interface SignalCardProps {
  signal: Signal;
}

export function SignalCard({ signal }: SignalCardProps) {
  const ago = signal.ingestedAt
    ? formatDistanceToNow(new Date(signal.ingestedAt), { addSuffix: true })
    : null;

  return (
    <article className="bg-surface border border-border rounded-lg p-4 hover:border-accent/40 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <a
            href={signal.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-foreground hover:text-accent transition-colors line-clamp-2"
          >
            {signal.title}
          </a>
          {signal.snippet && (
            <p className="mt-1 text-xs text-muted line-clamp-2">{signal.snippet}</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted font-mono bg-bg px-2 py-0.5 rounded border border-border uppercase tracking-wide">
          {signal.source}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-muted">
        {signal.companyNameHint && (
          <span className="text-accent/80">{signal.companyNameHint}</span>
        )}
        {ago && <span>{ago}</span>}
      </div>
    </article>
  );
}
