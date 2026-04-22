import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { SIGNAL_ACTION_LABELS, type Signal, type SignalActionType, type CreateSignalAction } from '@warroom/shared';

interface SignalCardProps {
  signal: Signal;
  onDismiss: (id: number) => void;
  onAction: (id: number, action: CreateSignalAction) => void;
}

const ACTION_PILLS: SignalActionType[] = [
  'saved', 'emailed', 'applied', 'reached_out', 'scheduled_interview', 'not_relevant', 'dead_link'
];

function getBadgeProps(actionType: string) {
  switch (actionType) {
    case 'saved': return { label: 'Saved', classes: 'bg-accent/10 text-accent' };
    case 'emailed': return { label: 'Emailed', classes: 'bg-success/10 text-success' };
    case 'applied': return { label: 'Applied', classes: 'bg-success/20 text-success font-medium' };
    case 'reached_out': return { label: 'Reached out', classes: 'bg-accent/10 text-accent' };
    case 'scheduled_interview': return { label: 'Interview', classes: 'bg-success/20 text-success font-medium' };
    case 'not_relevant': return { label: 'Not relevant', classes: 'bg-muted/10 text-muted' };
    case 'dead_link': return { label: 'Dead link', classes: 'bg-danger/10 text-danger' };
    default: return { label: actionType, classes: 'bg-muted/10 text-muted' };
  }
}

export function SignalCard({ signal, onDismiss, onAction }: SignalCardProps) {
  const ago = formatDistanceToNow(new Date(signal.detectedAt), { addSuffix: true });
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<SignalActionType | null>(null);
  const [note, setNote] = useState('');

  const mostRecentAction = signal.actions && signal.actions.length > 0 ? signal.actions[0] : null;
  const isDimmed = mostRecentAction && ['not_relevant', 'dead_link'].includes(mostRecentAction.actionType);

  const handleSubmit = () => {
    if (!selectedAction) return;
    onAction(signal.id, { actionType: selectedAction, note: note.trim() || undefined });
    setPanelOpen(false);
    setSelectedAction(null);
    setNote('');
  };

  const handleCancel = () => {
    setPanelOpen(false);
    setSelectedAction(null);
    setNote('');
  };

  return (
    <article
      className={`bg-surface border border-border rounded-md p-4 mb-3 transition-opacity ${
        isDimmed ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs bg-bg border border-border rounded px-2 py-0.5 text-muted uppercase tracking-wide">
            {signal.source}
          </span>
          {signal.isDna && (
            <span className="text-xs bg-danger/20 text-danger border border-danger/30 rounded px-2 py-0.5">
              DNA
            </span>
          )}
          {signal.actions?.map((act) => {
            const props = getBadgeProps(act.actionType);
            return (
              <span key={act.id} className={`text-xs px-2 py-0.5 rounded ${props.classes}`}>
                {props.label}
              </span>
            );
          })}
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
        <div className="mb-1">
          <p className="text-sm text-muted">{signal.company.name}</p>
          {mostRecentAction?.note && (
             <p className="text-xs text-muted mt-0.5">
               {format(new Date(mostRecentAction.createdAt), 'MMM d')} - {mostRecentAction.note}
             </p>
          )}
        </div>
      )}

      {signal.extractedSummary && (
        <p className="text-sm text-muted line-clamp-2 mb-3 mt-2">{signal.extractedSummary}</p>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setPanelOpen((prev) => !prev)}
          className="text-xs px-3 py-1 rounded border border-accent text-accent hover:bg-accent/10 transition-colors"
        >
          Take action
        </button>
        <button
          onClick={() => onDismiss(signal.id)}
          disabled={signal.dismissed}
          className="text-xs px-3 py-1 rounded border border-border text-muted hover:border-danger hover:text-danger transition-colors disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
        >
          Dismiss
        </button>
      </div>

      {panelOpen && (
        <div className="mt-3 p-3 bg-bg border border-border rounded flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {ACTION_PILLS.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedAction(type)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  selectedAction === type
                    ? 'bg-accent/10 border-accent text-accent'
                    : 'border-border text-muted hover:border-accent hover:text-accent'
                }`}
              >
                {SIGNAL_ACTION_LABELS[type]}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Add a note (optional)..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={!selectedAction}
              className="px-3 py-1 text-xs rounded bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-xs rounded border border-border text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
