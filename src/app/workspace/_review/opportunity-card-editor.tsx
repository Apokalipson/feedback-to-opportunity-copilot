"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REVIEW_LIMITS } from "@/lib/review/contract";
import type {
  OpportunityReviewCard,
  ReviewApiResponse,
  ReviewStatus,
} from "@/lib/review/types";
import { humanize, stableTimestamp, statusClasses } from "./review-ui";

export function OpportunityCardEditor({
  card,
  totalRows,
}: {
  card: OpportunityReviewCard;
  totalRows: number;
}) {
  const router = useRouter();
  const [userNeed, setUserNeed] = useState(card.userNeed);
  const [potentialSolution, setPotentialSolution] = useState(card.potentialSolution);
  const [researchQuestions, setResearchQuestions] = useState(card.researchQuestions);
  const [reviewNote, setReviewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  function updateQuestion(index: number, value: string) {
    setResearchQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? value : question));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const nextStatus = (submitter?.value || card.reviewStatus) as ReviewStatus;
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/opportunity-cards/review", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          importId: card.importId,
          cardId: card.id,
          expectedUpdatedAt: card.updatedAt,
          userNeed,
          potentialSolution,
          researchQuestions,
          reviewStatus: nextStatus,
          reviewNote: reviewNote.trim() || null,
        }),
      });
      const result = (await response.json()) as ReviewApiResponse;

      if (!response.ok || !result.ok) {
        setMessage({ type: "error", text: result.ok ? "The review failed." : result.message });
        return;
      }

      setReviewNote("");
      setMessage({
        type: "success",
        text: nextStatus === "approved" ? "Card approved and history recorded." : nextStatus === "rejected" ? "Card rejected and history recorded." : "Card edits and history saved.",
      });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "The review could not be saved. Check your connection and try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full border px-3 py-1 ${statusClasses(card.reviewStatus)}`}>{humanize(card.reviewStatus)}</span>
            <span className="rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1 text-violet-200">
              {card.aiGenerated ? "AI-generated origin" : "Human-authored"}
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1 text-slate-300">
              {card.scaleCount} {card.scaleCount === 1 ? "response" : "responses"} · {card.scalePercentage.toFixed(1)}% of current import
            </span>
          </div>
          <h3 className="mt-4 text-xl font-semibold">{card.groupLabel}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{card.groupSummary}</p>
          <p className="mt-2 text-xs text-slate-500">Scale denominator: all {totalRows} rows in the current import.</p>
        </div>
        <p className="text-xs text-slate-500">Updated {stableTimestamp(card.updatedAt)}</p>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950 p-5">
        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Source evidence</p>
        <div className="mt-3 space-y-4">
          {card.evidence.length > 0 ? card.evidence.map((evidence) => (
            <blockquote className="border-l-2 border-cyan-300/60 pl-4 text-sm leading-6 text-slate-300" key={evidence.sourceRowNumber}>
              “{evidence.quote}”
              <footer className="mt-1 text-xs text-slate-500">Synthetic source row {evidence.sourceRowNumber}</footer>
            </blockquote>
          )) : (
            <p className="text-sm text-slate-500">No source evidence is available for this card.</p>
          )}
        </div>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-200">
          User need
          <textarea
            className="mt-2 min-h-24 w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-sm leading-6 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
            disabled={isSubmitting}
            maxLength={REVIEW_LIMITS.maxUserNeedCharacters}
            onChange={(event) => setUserNeed(event.target.value)}
            required
            value={userNeed}
          />
        </label>
        <label className="block text-sm font-medium text-slate-200">
          Potential solution
          <textarea
            className="mt-2 min-h-24 w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-sm leading-6 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
            disabled={isSubmitting}
            maxLength={REVIEW_LIMITS.maxPotentialSolutionCharacters}
            onChange={(event) => setPotentialSolution(event.target.value)}
            required
            value={potentialSolution}
          />
        </label>

        <fieldset>
          <legend className="text-sm font-medium text-slate-200">Research questions</legend>
          <div className="mt-2 space-y-3">
            {researchQuestions.map((question, index) => (
              <div className="flex items-start gap-2" key={`${card.id}-question-${index}`}>
                <label className="sr-only" htmlFor={`${card.id}-question-${index}`}>Research question {index + 1}</label>
                <textarea
                  className="min-h-20 flex-1 rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-sm leading-6 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                  disabled={isSubmitting}
                  id={`${card.id}-question-${index}`}
                  maxLength={REVIEW_LIMITS.maxResearchQuestionCharacters}
                  onChange={(event) => updateQuestion(index, event.target.value)}
                  required
                  value={question}
                />
                {researchQuestions.length > 1 ? (
                  <button
                    aria-label={`Remove research question ${index + 1}`}
                    className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
                    disabled={isSubmitting}
                    onClick={() => setResearchQuestions((current) => current.filter((_, questionIndex) => questionIndex !== index))}
                    type="button"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {researchQuestions.length < REVIEW_LIMITS.maxResearchQuestions ? (
            <button
              className="mt-3 rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
              disabled={isSubmitting}
              onClick={() => setResearchQuestions((current) => [...current, ""])}
              type="button"
            >
              Add research question
            </button>
          ) : null}
        </fieldset>

        <label className="block text-sm font-medium text-slate-200">
          Review note <span className="font-normal text-slate-500">(optional)</span>
          <textarea
            className="mt-2 min-h-20 w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-sm leading-6 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
            disabled={isSubmitting}
            maxLength={REVIEW_LIMITS.maxReviewNoteCharacters}
            onChange={(event) => setReviewNote(event.target.value)}
            placeholder="Reason for the decision or edit"
            value={reviewNote}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-60" disabled={isSubmitting} type="submit" value={card.reviewStatus}>
            {isSubmitting ? "Saving…" : "Save edits"}
          </button>
          <button className="rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-200 disabled:opacity-60" disabled={isSubmitting} type="submit" value="approved">
            Approve card
          </button>
          <button className="rounded-xl bg-rose-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-rose-200 disabled:opacity-60" disabled={isSubmitting} type="submit" value="rejected">
            Reject card
          </button>
        </div>

        <div aria-live="polite">
          {message ? (
            <p className={`rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-rose-400/30 bg-rose-400/10 text-rose-200"}`}>
              {message.text}
            </p>
          ) : null}
        </div>
      </form>

      <details className="mt-6 rounded-xl border border-white/10 bg-slate-950">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
          Review history ({card.history.length})
        </summary>
        <div className="border-t border-white/10 px-4 py-4">
          {card.history.length > 0 ? (
            <ol className="space-y-4">
              {card.history.map((event) => (
                <li className="text-sm text-slate-300" key={event.id}>
                  <p>
                    {event.previousStatus ? `${humanize(event.previousStatus)} → ` : ""}{humanize(event.newStatus)} · {stableTimestamp(event.createdAt)}
                  </p>
                  {event.editedFields.length > 0 ? <p className="mt-1 text-xs text-slate-500">Edited: {event.editedFields.map(humanize).join(", ")}</p> : null}
                  {event.reviewNote ? <p className="mt-1 text-xs leading-5 text-slate-400">Note: {event.reviewNote}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">No human review has been recorded yet.</p>
          )}
        </div>
      </details>
    </article>
  );
}
