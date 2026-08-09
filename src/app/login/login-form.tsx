"use client";

import { useActionState } from "react";
import { login } from "./actions";
import type { LoginState } from "@/lib/auth/schema";

const initialState: LoginState = {};

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      <div>
        <label className="text-sm font-medium text-slate-200" htmlFor="email">
          Email
        </label>
        <input
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          autoComplete="email"
          className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!configured || pending}
          id="email"
          name="email"
          type="email"
        />
        {state.fieldErrors?.email && (
          <p className="mt-2 text-sm text-rose-300" id="email-error">
            {state.fieldErrors.email[0]}
          </p>
        )}
      </div>

      <div>
        <label
          className="text-sm font-medium text-slate-200"
          htmlFor="password"
        >
          Password
        </label>
        <input
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
          aria-invalid={Boolean(state.fieldErrors?.password)}
          autoComplete="current-password"
          className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!configured || pending}
          id="password"
          name="password"
          type="password"
        />
        {state.fieldErrors?.password && (
          <p className="mt-2 text-sm text-rose-300" id="password-error">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      {state.message && (
        <p aria-live="polite" className="text-sm text-rose-300">
          {state.message}
        </p>
      )}

      <button
        className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        disabled={!configured || pending}
        type="submit"
      >
        {pending ? "Signing in…" : "Sign in to workspace"}
      </button>
    </form>
  );
}
