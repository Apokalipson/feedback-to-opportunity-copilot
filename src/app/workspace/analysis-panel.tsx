"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ANALYSIS_LIMITS } from "@/lib/analysis/contract";
import type { AnalysisApiResponse } from "@/lib/analysis/types";

type AnalysisPanelProps = {
  currentImportId: string;
  existing: {
    analyses: number;
    groups: number;
    cards: number;
  };
};

export function AnalysisPanel({ currentImportId, existing }: AnalysisPanelProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState<
    Extract<AnalysisApiResponse, { ok: true }> | undefined
  >();

  async function runAnalysis() {
    setIsSubmitting(true);
    setErrorMessage(null);
    setCompleted(undefined);

    try {
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ importId: currentImportId }),
      });
      const result = (await response.json()) as AnalysisApiResponse;

      if (!response.ok || !result.ok) {
        setErrorMessage(
          result.ok ? "AI analysis failed." : result.message,
        );
        return;
      }

      setCompleted(result);
      router.refresh();
    } catch {
      setErrorMessage(
        "AI analysis could not be completed. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const persisted = completed
    ? {
        analyses: completed.analyzedResponses,
        groups: completed.groups,
        cards: completed.cards,
      }
    : existing;

  return (
    <section className="mt-5 rounded-3xl border border-cyan-300/20 bg-slate-900 p-7">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-cyan-300">AI draft analysis</p>
          <h2 className="mt-2 text-2xl font-semibold">
            Turn accepted feedback into draft opportunities
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            One explicit run analyzes up to {ANALYSIS_LIMITS.maxResponses} accepted
            responses and {ANALYSIS_LIMITS.maxInputCharacters.toLocaleString("en-US")} input
            characters. Invalid rows and blank feedback are excluded. Existing pending
            drafts are replaced without duplication.
          </p>
        </div>
        <button
          className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          onClick={runAnalysis}
          type="button"
        >
          {isSubmitting ? "Analyzing…" : "Analyze current import"}
        </button>
      </div>

      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-950 p-4">
          <dt className="text-slate-400">Analyzed responses</dt>
          <dd className="mt-1 text-xl font-semibold">{persisted.analyses}</dd>
        </div>
        <div className="rounded-2xl bg-slate-950 p-4">
          <dt className="text-slate-400">Feedback groups</dt>
          <dd className="mt-1 text-xl font-semibold">{persisted.groups}</dd>
        </div>
        <div className="rounded-2xl bg-slate-950 p-4">
          <dt className="text-slate-400">Draft cards</dt>
          <dd className="mt-1 text-xl font-semibold">{persisted.cards}</dd>
        </div>
      </dl>

      <div aria-live="polite" className="mt-5">
        {errorMessage ? (
          <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}

        {completed ? (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            <p>
              Analysis saved: {completed.analyzedResponses} responses, {completed.groups} groups,
              and {completed.cards} AI-generated draft cards. Human review is still required.
            </p>
            <p className="mt-2 text-xs text-emerald-100/75">
              {completed.model} · {completed.version} · {completed.usage.inputTokens ?? "—"} input
              tokens · {completed.usage.outputTokens ?? "—"} output tokens · {completed.usage.totalTokens ?? "—"} total
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
