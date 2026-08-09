"use client";

import { useMemo, useState } from "react";
import { filterResponses } from "@/lib/review/filters";
import type { ReviewWorkspaceData } from "@/lib/review/types";
import { FilterSelect, humanize } from "@/app/workspace/_review/review-ui";

const featureNames: Record<number, string> = {
  1: "myDisplay",
  2: "myLock",
  3: "Find my Glo",
  4: "mySession",
  5: "myUsage",
  6: "Other",
};

export function ResponseExplorer({ data }: { data: ReviewWorkspaceData }) {
  const [query, setQuery] = useState("");
  const [validationStatus, setValidationStatus] = useState("all");
  const [topic, setTopic] = useState("all");
  const [sentiment, setSentiment] = useState("all");
  const [productArea, setProductArea] = useState("all");

  const topics = useMemo(
    () =>
      [...new Set(data.responses.flatMap((response) => response.analysis?.topic ?? []))].sort(),
    [data.responses],
  );
  const sentiments = useMemo(
    () =>
      [...new Set(data.responses.flatMap((response) => response.analysis?.sentiment ?? []))].sort(),
    [data.responses],
  );
  const productAreas = useMemo(
    () =>
      [...new Set(data.responses.flatMap((response) => response.analysis?.productArea ?? []))].sort(),
    [data.responses],
  );
  const visibleResponses = useMemo(
    () =>
      filterResponses(data.responses, {
        query,
        validationStatus,
        topic,
        sentiment,
        productArea,
      }),
    [data.responses, productArea, query, sentiment, topic, validationStatus],
  );

  return (
    <section aria-labelledby="response-explorer-title" className="mt-6 rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-8">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-cyan-300">Current-import explorer</p>
        <h2 className="mt-2 text-2xl font-semibold" id="response-explorer-title">
          Search normalized feedback
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Search stays within the authenticated current import. Raw payloads and respondent identifiers are not displayed.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm font-medium text-slate-200 md:col-span-2 xl:col-span-1">
          Search
          <input
            className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Feedback or user problem"
            type="search"
            value={query}
          />
        </label>
        <FilterSelect label="Validation" onChange={setValidationStatus} options={["valid", "warning", "invalid"]} value={validationStatus} />
        <FilterSelect label="Topic" onChange={setTopic} options={topics} value={topic} />
        <FilterSelect label="Sentiment" onChange={setSentiment} options={sentiments} value={sentiment} />
        <FilterSelect label="Product area" onChange={setProductArea} options={productAreas} value={productArea} />
      </div>

      <p aria-live="polite" className="mt-5 text-sm text-slate-400">
        Showing {visibleResponses.length} of {data.responses.length} current-import responses.
      </p>

      <div className="mt-4 space-y-3">
        {visibleResponses.map((response) => (
          <details className="group rounded-2xl border border-white/10 bg-slate-950 open:border-cyan-300/30" key={response.sourceRowNumber}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
              <span className="font-medium">Source row {response.sourceRowNumber}</span>
              <span className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-white/15 px-2.5 py-1 text-slate-300">{humanize(response.validationStatus)}</span>
                {response.analysis ? (
                  <>
                    <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-cyan-200">{humanize(response.analysis.topic)}</span>
                    <span className="rounded-full border border-white/15 px-2.5 py-1 text-slate-300">{humanize(response.analysis.productArea)}</span>
                  </>
                ) : (
                  <span className="rounded-full border border-white/15 px-2.5 py-1 text-slate-400">Not analyzed</span>
                )}
              </span>
            </summary>
            <div className="border-t border-white/10 px-5 py-5">
              {response.analysis ? (
                <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                  <p className="text-xs font-semibold tracking-wide text-cyan-300 uppercase">AI-proposed user problem</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{response.analysis.userProblem}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {humanize(response.analysis.sentiment)} sentiment
                    {response.analysis.confidence === null ? "" : ` · ${(response.analysis.confidence * 100).toFixed(0)}% confidence`}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {response.texts.length > 0 ? response.texts.map((text) => (
                  <div key={text.field}>
                    <p className="text-xs font-medium text-slate-500">{text.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{text.value}</p>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">No normalized feedback text is available for this row.</p>
                )}
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Used features: {response.q2FeatureCodes.length > 0 ? response.q2FeatureCodes.map((code) => featureNames[code] ?? `Code ${code}`).join(", ") : "None"}
                {response.q3FeatureCode ? ` · Most valuable: ${featureNames[response.q3FeatureCode] ?? `Code ${response.q3FeatureCode}`}` : ""}
              </p>
              {response.issueCodes.length > 0 ? (
                <p className="mt-2 text-xs text-amber-200">Validation issues: {response.issueCodes.map(humanize).join(", ")}</p>
              ) : null}
            </div>
          </details>
        ))}
        {visibleResponses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-slate-400">No responses match the selected filters.</p>
        ) : null}
      </div>
    </section>
  );
}
