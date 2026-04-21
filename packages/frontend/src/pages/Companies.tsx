import { useState, useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Company, DoNotApply, DnaReasonCategory } from '@warroom/shared';
import { DNA_REASON_CATEGORIES } from '@warroom/shared';
import {
  fetchCompanies,
  fetchDoNotApply,
  addToDoNotApply,
  removeFromDoNotApply,
} from '../lib/api.js';

const LIMIT = 50;

const REASON_LABELS: Record<DnaReasonCategory, string> = {
  bad_interview: 'Bad interview',
  ghosted: 'Ghosted',
  wrong_stack: 'Wrong stack',
  wrong_stage: 'Wrong stage',
  ethical_concerns: 'Ethical concerns',
  already_rejected: 'Already rejected',
  hiring_freeze: 'Hiring freeze',
  other: 'Other',
};

interface FormState {
  reasonCategory: DnaReasonCategory;
  reasonNotes: string;
  blockType: 'hard' | 'soft';
  reconsiderAt: string;
}

const DEFAULT_FORM: FormState = {
  reasonCategory: 'other',
  reasonNotes: '',
  blockType: 'hard',
  reconsiderAt: '',
};

export function Companies() {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [openFormId, setOpenFormId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const companiesQuery = useInfiniteQuery({
    queryKey: ['companies', search],
    queryFn: ({ pageParam }) =>
      fetchCompanies({ ...(search ? { search } : {}), limit: LIMIT, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  const allCompanies: Company[] = useMemo(
    () => companiesQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [companiesQuery.data],
  );
  const total = companiesQuery.data?.pages[0]?.total ?? 0;

  const dnaQuery = useQuery({
    queryKey: ['doNotApply'],
    queryFn: fetchDoNotApply,
  });

  const dnaMap = useMemo(() => {
    const map = new Map<number, DoNotApply>();
    for (const entry of dnaQuery.data?.items ?? []) {
      map.set(entry.companyId, entry);
    }
    return map;
  }, [dnaQuery.data]);

  const addMutation = useMutation({
    mutationFn: addToDoNotApply,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['doNotApply'] });
      setOpenFormId(null);
      setForm(DEFAULT_FORM);
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : 'Failed to add to DNA list');
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeFromDoNotApply,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['doNotApply'] });
    },
    onError: () => {
      alert('Failed to remove from DNA list');
    },
  });

  function openForm(companyId: number) {
    setOpenFormId(companyId);
    setForm(DEFAULT_FORM);
  }

  function closeForm() {
    setOpenFormId(null);
    setForm(DEFAULT_FORM);
  }

  return (
    <div>
      <h1 className="font-serif text-4xl mb-2">Companies</h1>

      <input
        type="text"
        placeholder="Search companies…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="w-full mt-4 mb-6 bg-surface border border-border rounded px-3 py-2 text-foreground placeholder-muted focus:outline-none focus:border-accent"
      />

      {companiesQuery.isLoading && <p className="text-muted">Loading…</p>}

      {companiesQuery.isError && (
        <p className="text-danger">
          {companiesQuery.error instanceof Error
            ? companiesQuery.error.message
            : 'Error loading companies'}
        </p>
      )}

      {!companiesQuery.isLoading && allCompanies.length === 0 && (
        <p className="text-muted">No companies found.</p>
      )}

      <div>
        {allCompanies.map((company) => {
          const dnaEntry = dnaMap.get(company.id);
          const isOpen = openFormId === company.id;

          return (
            <div key={company.id} className="bg-surface border border-border rounded-md p-4 mb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg text-foreground">{company.name}</span>
                    {dnaEntry && (
                      <span
                        className="text-xs bg-danger/20 text-danger border border-danger/30 rounded px-2 py-0.5 shrink-0"
                        title={
                          REASON_LABELS[dnaEntry.reasonCategory as DnaReasonCategory] ??
                          dnaEntry.reasonCategory
                        }
                      >
                        DNA
                      </span>
                    )}
                  </div>
                  {company.domain && (
                    <p className="text-sm text-muted mt-0.5 truncate">{company.domain}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {dnaEntry ? (
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove ${company.name} from Do Not Apply list?`)) {
                          removeMutation.mutate(dnaEntry.id);
                        }
                      }}
                      disabled={removeMutation.isPending}
                      className="text-xs px-3 py-1 rounded border border-border text-muted hover:border-danger hover:text-danger transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Remove from DNA
                    </button>
                  ) : (
                    <button
                      onClick={() => (isOpen ? closeForm() : openForm(company.id))}
                      className="text-xs px-3 py-1 rounded border border-danger text-danger hover:bg-danger/10 transition-colors"
                    >
                      Add to DNA
                    </button>
                  )}
                </div>
              </div>

              {isOpen && (
                <form
                  className="mt-4 pt-4 border-t border-border space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addMutation.mutate({
                      companyId: company.id,
                      reasonCategory: form.reasonCategory,
                      reasonNotes: form.reasonNotes || null,
                      blockType: form.blockType,
                      reconsiderAt:
                        form.blockType === 'soft' && form.reconsiderAt
                          ? new Date(form.reconsiderAt).toISOString()
                          : null,
                    });
                  }}
                >
                  <div>
                    <label className="block text-xs text-muted mb-1">Reason</label>
                    <select
                      value={form.reasonCategory}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          reasonCategory: e.target.value as DnaReasonCategory,
                        }))
                      }
                      className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
                    >
                      {DNA_REASON_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {REASON_LABELS[cat]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Notes (optional)</label>
                    <input
                      type="text"
                      value={form.reasonNotes}
                      onChange={(e) => setForm((f) => ({ ...f, reasonNotes: e.target.value }))}
                      placeholder="Optional notes…"
                      className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted">Block type:</span>
                    {(['hard', 'soft'] as const).map((bt) => (
                      <label
                        key={bt}
                        className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={`blockType-${company.id}`}
                          value={bt}
                          checked={form.blockType === bt}
                          onChange={() => setForm((f) => ({ ...f, blockType: bt }))}
                          className="accent-accent"
                        />
                        {bt.charAt(0).toUpperCase() + bt.slice(1)}
                      </label>
                    ))}
                  </div>
                  {form.blockType === 'soft' && (
                    <div>
                      <label className="block text-xs text-muted mb-1">Reconsider at</label>
                      <input
                        type="date"
                        value={form.reconsiderAt}
                        onChange={(e) => setForm((f) => ({ ...f, reconsiderAt: e.target.value }))}
                        className="bg-bg border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={addMutation.isPending}
                      className="text-xs px-3 py-1.5 rounded border border-danger text-danger hover:bg-danger/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {addMutation.isPending ? 'Adding…' : 'Add to DNA'}
                    </button>
                    <button
                      type="button"
                      onClick={closeForm}
                      className="text-xs px-3 py-1.5 rounded border border-border text-muted hover:border-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {companiesQuery.hasNextPage && (
        <button
          onClick={() => void companiesQuery.fetchNextPage()}
          disabled={companiesQuery.isFetchingNextPage}
          className="w-full mt-2 py-2 border border-border rounded text-sm text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {companiesQuery.isFetchingNextPage
            ? 'Loading…'
            : `Load more (${allCompanies.length} of ${total})`}
        </button>
      )}
    </div>
  );
}
