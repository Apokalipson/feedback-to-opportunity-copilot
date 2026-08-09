"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CSV_IMPORT_LIMITS } from "@/lib/imports/contract";
import type { ImportApiResponse, ImportSummary } from "@/lib/imports/types";

type CompletedImport = {
  filename: string;
  summary: ImportSummary;
  warnings: string[];
};

export function CsvImportForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedImport, setCompletedImport] =
    useState<CompletedImport | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setCompletedImport(null);

    try {
      const response = await fetch("/api/imports", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const result = (await response.json()) as ImportApiResponse;

      if (!response.ok || !result.ok) {
        setErrorMessage(
          result.ok ? "The CSV import failed." : result.message,
        );
        return;
      }

      setCompletedImport({
        filename: result.filename,
        summary: result.summary,
        warnings: result.warnings,
      });
      formRef.current?.reset();
      router.refresh();
    } catch {
      setErrorMessage(
        "The CSV import could not be completed. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mt-5 rounded-3xl border border-white/10 bg-slate-900 p-7">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-cyan-300">Secure CSV import</p>
        <h2 className="mt-2 text-2xl font-semibold">Replace the current import</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Upload the UTF-8 CSV survey export. The file may include its title row,
          followed by the standard survey headers. The limit is {" "}
          {CSV_IMPORT_LIMITS.maxBytes / 1024 / 1024} MiB and {" "}
          {CSV_IMPORT_LIMITS.maxRows.toLocaleString("en-US")} response rows.
        </p>
      </div>

      <form
        className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end"
        onSubmit={handleSubmit}
        ref={formRef}
      >
        <label className="flex-1 text-sm font-medium text-slate-200">
          Survey CSV
          <input
            accept=".csv,text/csv"
            className="mt-2 block w-full cursor-pointer rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:font-semibold file:text-slate-950 hover:border-white/30"
            disabled={isSubmitting}
            name="file"
            required
            type="file"
          />
        </label>
        <button
          className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Validating…" : "Validate and import"}
        </button>
      </form>

      <div aria-live="polite" className="mt-5">
        {errorMessage ? (
          <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}

        {completedImport ? (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5">
            <p className="font-medium text-emerald-200">
              {completedImport.filename} is now the current import.
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-slate-400">Total</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {completedImport.summary.totalRows}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Accepted</dt>
                <dd className="mt-1 text-lg font-semibold text-emerald-200">
                  {completedImport.summary.acceptedRows}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Rejected</dt>
                <dd className="mt-1 text-lg font-semibold text-rose-200">
                  {completedImport.summary.rejectedRows}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Warnings</dt>
                <dd className="mt-1 text-lg font-semibold text-amber-200">
                  {completedImport.summary.warningRows}
                </dd>
              </div>
            </dl>
            {completedImport.warnings.length > 0 ? (
              <ul className="mt-4 space-y-1 text-sm text-amber-100">
                {completedImport.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
