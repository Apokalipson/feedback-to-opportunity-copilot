import { logout } from "@/app/login/actions";
import { AnalysisPanel } from "@/app/workspace/analysis-panel";
import { CsvImportForm } from "@/app/workspace/csv-import-form";
import { ReviewWorkspace } from "@/app/workspace/review-workspace";
import { getWorkspaceOverview } from "@/lib/data/workspace";

const foundationChecks = [
  "Authenticated upload endpoint",
  "UTF-8, file size, and header validation",
  "Row-safe Q2 and Q3 normalization",
  "Owner-scoped persistence with RLS",
  "Bounded server-side AI analysis",
];

export default async function WorkspacePage() {
  const { displayName, currentImport, currentAnalysis, reviewWorkspace } =
    await getWorkspaceOverview();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-white/10 pb-8">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-cyan-300 uppercase">
              Feedback-to-Opportunity
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Private Product Manager workspace
            </p>
          </div>
          <form action={logout}>
            <button
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:bg-white/5"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </header>

        <section className="py-14">
          <p className="text-sm font-medium text-emerald-300">
            Authenticated workspace
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Welcome, {displayName}.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Import and validate the latest survey export, then explicitly request
            a bounded AI draft analysis inside the private workspace.
          </p>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-white/10 bg-slate-900 p-7">
            <p className="text-sm font-medium text-slate-400">Current import</p>
            {currentImport ? (
              <div className="mt-5">
                <h2 className="text-xl font-semibold">
                  {currentImport.source_filename}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {currentImport.total_rows} rows · {currentImport.accepted_rows} {" "}
                  accepted · {currentImport.rejected_rows} rejected · {" "}
                  {currentImport.warning_rows} warnings
                </p>
              </div>
            ) : (
              <div className="mt-5">
                <h2 className="text-xl font-semibold">No import yet</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Upload a validated survey CSV to establish the current import.
                </p>
              </div>
            )}
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-900 p-7">
            <p className="text-sm font-medium text-slate-400">
              Import controls
            </p>
            <ul className="mt-5 space-y-3">
              {foundationChecks.map((item) => (
                <li className="flex items-center gap-3 text-sm" key={item}>
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full bg-emerald-300"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </section>

        <CsvImportForm />
        {currentImport ? (
          <>
            <AnalysisPanel
              currentImportId={currentImport.id}
              existing={currentAnalysis}
            />
            <ReviewWorkspace data={reviewWorkspace} />
          </>
        ) : null}
      </div>
    </main>
  );
}
