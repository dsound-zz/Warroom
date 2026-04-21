import { formatDistanceToNow } from 'date-fns';
import type { Signal } from '@warroom/shared';

interface SignalCardProps {
  signal: Signal;
  onAct: (id: number) => void;
  onDismiss: (id: number) => void;
}

export function SignalCard({ signal, onAct, onDismiss }: SignalCardProps) {
  const ago = formatDistanceToNow(new Date(signal.detectedAt), { addSuffix: true });

  return (
    <article
      className={`bg-surface border border-border rounded-md p-4 mb-3 transition-opacity ${
        signal.actedOn ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-bg border border-border rounded px-2 py-0.5 text-muted uppercase tracking-wide">
            {signal.source}
          </span>
          {signal.isDna && (
            <span className="text-xs bg-danger/20 text-danger border border-danger/30 rounded px-2 py-0.5">
              DNA
            </span>
          )}
          {signal.actedOn && (
            <span className="text-xs bg-accent/20 text-accent rounded px-2 py-0.5">Acted</span>
          )}
        </div>
        <span className="text-xs text-muted">{ago}</span>
      </div>

      <div className="mb-1">
        {signal.url ? (
          <a
            href={signal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-medium text-foreground hover:text-accent transition-colors"
          >
            {signal.title ?? signal.url}
          </a>
        ) : (
          <p className="text-lg font-medium text-foreground">{signal.title}</p>
        )}
      </div>

      {signal.company && (
        <p className="text-sm text-muted mb-1">{signal.company.name}</p>
      )}

      {signal.extractedSummary && (
        <p className="text-sm text-muted line-clamp-2 mb-3">{signal.extractedSummary}</p>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onAct(signal.id)}
          disabled={signal.actedOn}
          className="text-xs px-3 py-1 rounded border border-accent text-accent hover:bg-accent/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Mark acted
        </button>
        <button
          onClick={() => onDismiss(signal.id)}
          disabled={signal.dismissed}
          className="text-xs px-3 py-1 rounded border border-border text-muted hover:border-danger hover:text-danger transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Dismiss
        </button>
      </div>
    </article>
  );
}
