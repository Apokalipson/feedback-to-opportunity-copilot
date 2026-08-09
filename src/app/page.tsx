import Link from "next/link";

const foundationItems = [
  "Private Product Manager workspace",
  "CSV survey import",
  "AI-assisted feedback analysis",
  "Human-reviewed Opportunity Cards",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100 sm:px-10 lg:px-16">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl flex-col justify-between rounded-[2rem] border border-white/10 bg-slate-900 p-8 shadow-2xl shadow-cyan-950/30 sm:p-12 lg:p-16">
        <header className="flex items-center justify-between gap-6">
          <p className="text-sm font-semibold tracking-[0.18em] text-cyan-300 uppercase">
            Feedback-to-Opportunity
          </p>
          <Link
            className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
            href="/login"
          >
            Product Manager sign in
          </Link>
        </header>

        <section className="my-16 max-w-4xl">
          <p className="mb-5 text-sm font-medium text-slate-400">
            Product intelligence, with a human decision at the end.
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Turn raw customer feedback into opportunities worth reviewing.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
            This MVP will organize survey responses, draft evidence-backed
            Opportunity Cards, and keep the Product Manager in control of every
            approval, edit, and rejection.
          </p>
          <div className="mt-8">
            <Link
              className="inline-flex rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
              href="/login"
            >
              Open private workspace
            </Link>
          </div>
        </section>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {foundationItems.map((item, index) => (
            <li
              key={item}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-slate-200"
            >
              <span className="mb-6 block font-mono text-xs text-cyan-300">
                0{index + 1}
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
