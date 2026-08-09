import Link from "next/link";
import { LoginForm } from "./login-form";
import { hasSupabasePublicEnv } from "@/lib/supabase/config";

export default function LoginPage() {
  const configured = hasSupabasePublicEnv();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <Link
            className="text-sm font-semibold tracking-[0.18em] text-cyan-300 uppercase"
            href="/"
          >
            Feedback-to-Opportunity
          </Link>
          <h1 className="mt-8 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            A private workspace for one Product Manager.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            Sign in with the account created by the project administrator.
            Public registration is intentionally disabled for this MVP.
          </p>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-slate-900 p-8 shadow-2xl shadow-cyan-950/30 sm:p-10">
          <p className="text-sm font-medium text-slate-400">Secure access</p>
          <h2 className="mt-2 text-2xl font-semibold">Welcome back</h2>
          {!configured && (
            <div
              className="mt-6 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100"
              role="status"
            >
              Supabase is not configured yet. Add the project URL and
              publishable key to <code>.env.local</code> before signing in.
            </div>
          )}
          <LoginForm configured={configured} />
        </section>
      </div>
    </main>
  );
}
