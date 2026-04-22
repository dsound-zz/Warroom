import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  SIGNAL_STATUS_TAGS,
  SIGNAL_STATUS_LABELS,
  type Signal,
  type SignalStatusTag,
  type SignalContact,
  type CreateSignalAction,
} from '@warroom/shared';

interface SignalCardProps {
  signal: Signal;
  onDismiss: (id: number) => void;
  onAction: (id: number, action: CreateSignalAction) => void;
}

function getTagBadgeClasses(tag: SignalStatusTag): string {
  switch (tag) {
    case 'applied':      return 'bg-success/20 text-success';
    case 'contacted':    return 'bg-accent/20 text-accent';
    case 'wrong_stack':  return 'bg-muted/20 text-muted';
    case 'dead_link':    return 'bg-danger/10 text-danger';
    case 'dna':          return 'bg-danger/20 text-danger';
    case 'ignored':      return 'bg-muted/20 text-muted opacity-60';
    case 'saved':        return 'bg-accent/10 text-accent';
    case 'interviewing': return 'bg-success/30 text-success font-bold';
    case 'not_relevant': return 'bg-muted/20 text-muted opacity-60';
    default:             return 'bg-muted/10 text-muted';
  }
}

const CHANNEL_OPTIONS: SignalContact['channel'][] = ['email', 'linkedin', 'twitter', 'other'];

export function SignalCard({ signal, onDismiss, onAction }: SignalCardProps) {
  const ago = formatDistanceToNow(new Date(signal.detectedAt), { addSuffix: true });
  const la = signal.latestAction;

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<SignalStatusTag>>(new Set());
  const [contactName, setContactName] = useState('');
  const [contactChannel, setContactChannel] = useState<SignalContact['channel']>('email');
  const [contactDetail, setContactDetail] = useState('');
  const [note, setNote] = useState('');

  const dimTags: SignalStatusTag[] = ['ignored', 'dead_link', 'wrong_stack', 'dna', 'not_relevant'];
  const isDimmed = la?.statusTags.some((t) => dimTags.includes(t)) ?? false;

  const openPanel = () => {
    if (la) {
      setSelectedTags(new Set(la.statusTags));
      setContactName(la.contact?.name ?? '');
      setContactChannel(la.contact?.channel ?? 'email');
      setContactDetail(la.contact?.detail ?? '');
      setNote(la.note ?? '');
    } else {
      setSelectedTags(new Set());
      setContactName('');
      setContactChannel('email');
      setContactDetail('');
      setNote('');
    }
    setPanelOpen(true);
  };

  const toggleTag = (tag: SignalStatusTag) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleSubmit = () => {
    const tags = Array.from(selectedTags);
    if (tags.length === 0) return;
    const hasContacted = selectedTags.has('contacted');
    onAction(signal.id, {
      statusTags: tags,
      contact:
        hasContacted && contactName.trim()
          ? { name: contactName.trim(), channel: contactChannel, detail: contactDetail.trim() || undefined }
          : null,
      note: note.trim() || null,
    });
    setPanelOpen(false);
  };

  const handleCancel = () => {
    setPanelOpen(false);
  };

  return (
    <article
      className={`bg-surface border border-border rounded-md p-4 mb-3 transition-opacity ${
        isDimmed ? 'opacity-50' : ''
      }`}
    >
      {/* Header row */}
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
          {la?.statusTags.map((tag) => (
            <span key={tag} className={`text-xs px-2 py-0.5 rounded ${getTagBadgeClasses(tag)}`}>
              {SIGNAL_STATUS_LABELS[tag]}
            </span>
          ))}
        </div>
        <span className="text-xs text-muted">{ago}</span>
      </div>

      {/* Title */}
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

      {/* Company + contact + note */}
      {signal.company && (
        <div className="mb-1">
          <p className="text-sm text-muted">{signal.company.name}</p>
          {la?.contact && (
            <p className="text-xs text-muted mt-0.5">
              Contacted: {la.contact.name} via {la.contact.channel}
              {la.contact.detail ? ` (${la.contact.detail})` : ''}
            </p>
          )}
          {la?.note && (
            <p className="text-xs text-muted mt-0.5">
              {format(new Date(la.createdAt), 'MMM d')} — {la.note}
            </p>
          )}
        </div>
      )}

      {signal.extractedSummary && (
        <p className="text-sm text-muted line-clamp-2 mb-3 mt-2">{signal.extractedSummary}</p>
      )}

      {/* Action bar */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={openPanel}
          className="text-xs px-3 py-1 rounded border border-accent text-accent hover:bg-accent/10 transition-colors"
        >
          {la ? 'Update' : 'Take action'}
        </button>
        <button
          onClick={() => onDismiss(signal.id)}
          disabled={signal.dismissed}
          className="text-xs px-3 py-1 rounded border border-border text-muted hover:border-danger hover:text-danger transition-colors disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
        >
          Dismiss
        </button>
      </div>

      {/* Expanded action panel */}
      {panelOpen && (
        <div className="mt-3 p-3 bg-bg border border-border rounded flex flex-col gap-3">
          {/* Status tag pills */}
          <div className="flex flex-wrap gap-2">
            {SIGNAL_STATUS_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  selectedTags.has(tag)
                    ? 'bg-accent/10 border-accent text-accent'
                    : 'border-border text-muted hover:border-accent hover:text-accent'
                }`}
              >
                {SIGNAL_STATUS_LABELS[tag]}
              </button>
            ))}
          </div>

          {/* Contact fields — shown only when "contacted" is selected */}
          {selectedTags.has('contacted') && (
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Contact name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="flex-1 min-w-32 bg-surface border border-border rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
              <select
                value={contactChannel}
                onChange={(e) => setContactChannel(e.target.value as SignalContact['channel'])}
                className="bg-surface border border-border rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
              >
                {CHANNEL_OPTIONS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch.charAt(0).toUpperCase() + ch.slice(1)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="email or URL"
                value={contactDetail}
                onChange={(e) => setContactDetail(e.target.value)}
                className="flex-1 min-w-32 bg-surface border border-border rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </div>
          )}

          {/* Note field */}
          <input
            type="text"
            placeholder="Add a comment..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
          />

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={selectedTags.size === 0}
              className="px-3 py-1 text-xs rounded bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
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
