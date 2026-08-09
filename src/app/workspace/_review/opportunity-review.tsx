"use client";

import { useMemo, useState } from "react";
import { OpportunityCardEditor } from "@/app/workspace/_review/opportunity-card-editor";
import { FilterSelect } from "@/app/workspace/_review/review-ui";
import { filterCards } from "@/lib/review/filters";
import type { ReviewStatus, ReviewWorkspaceData } from "@/lib/review/types";

export function OpportunityReview({ data }: { data: ReviewWorkspaceData }) {
  const [query, setQuery] = useState("");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | "all">("all");
  const visibleCards = useMemo(
    () => filterCards(data.cards, { query, reviewStatus }),
    [data.cards, query, reviewStatus],
  );

  return (
    <section aria-labelledby="opportunity-review-title" className="mt-6">
      <div className="rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-8">
        <p className="text-sm font-medium text-violet-300">Human review workflow</p>
        <h2 className="mt-2 text-2xl font-semibold" id="opportunity-review-title">Review Opportunity Cards</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          AI-generated content remains a draft until you approve or reject it. Every edit and decision is recorded in append-only review history.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-200">
            Search cards
            <input className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-300/20" onChange={(event) => setQuery(event.target.value)} placeholder="Need, solution, evidence" type="search" value={query} />
          </label>
          <FilterSelect label="Review status" onChange={(value) => setReviewStatus(value as ReviewStatus | "all")} options={["pending", "approved", "rejected"]} value={reviewStatus} />
        </div>
        <p aria-live="polite" className="mt-5 text-sm text-slate-400">Showing {visibleCards.length} of {data.cards.length} cards.</p>
      </div>

      <div className="mt-5 space-y-5">
        {visibleCards.map((card) => <OpportunityCardEditor card={card} key={`${card.id}:${card.updatedAt}`} totalRows={data.totalRows} />)}
        {visibleCards.length === 0 ? <p className="rounded-3xl border border-dashed border-white/15 p-8 text-sm text-slate-400">No Opportunity Cards match the selected filters.</p> : null}
      </div>
    </section>
  );
}
