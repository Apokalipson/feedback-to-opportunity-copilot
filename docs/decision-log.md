# Decision log

## 2026-08-08 — MVP scope

- Opportunity Cards cover feedback about the complete product ecosystem.
- One privately authenticated Product Manager is sufficient for the MVP.
- The interface and AI-generated content are in English.
- Scale is calculated within the currently uploaded import.
- AI drafts analysis; a human approves, edits, or rejects it.

## 2026-08-08 — Technology direction

- Use Next.js and TypeScript for frontend and backend server routes.
- Use Supabase Auth and PostgreSQL as the managed backend/database.
- Use the OpenAI API only from server-side modules with explicit cost controls.
- Use GitHub and Vercel for automated builds and production deployment.

## 2026-08-08 — Survey score exclusion

- The numerical Q1 satisfaction-score column was deliberately excluded.
- The MVP does not make score-based claims or calculate satisfaction averages.
- Free-text feedback and Q2/Q3 feature answers remain valid inputs.

## 2026-08-09 — Data and authentication boundary

- Use the official `@supabase/ssr` cookie pattern with a Next.js `proxy.ts`.
- Use `getClaims()` for server-side identity and authorization decisions.
- Disable public signup and create the Product Manager account administratively.
- Store `owner_id` on every domain table and enforce owner/import consistency
  with composite foreign keys in addition to Row Level Security.
- Use a publishable key in browser-safe flows; privileged keys remain server-only.

## 2026-08-09 — CSV ingestion contract

- Accept the frozen 15 source headers recorded in `docs/data-contract.md`.
- Preserve extra unique columns in raw data and report them.
- Reject missing, blank, or duplicate headers.
- Limit imports to UTF-8 CSV, 1 MiB, 1,000 response rows, 30 columns, and bounded
  text values.
- Persist invalid feature-code rows for traceability without guessing normalized
  values.
- Switch the current import only after its complete replacement is stored.

## 2026-08-09 — Bounded OpenAI analysis

- Use the Responses API with Structured Outputs and the official OpenAI SDK.
- Use the approved model with low reasoning effort, response storage disabled,
  one retry, and a 60-second timeout.
- Limit one run to 25 eligible responses, 20,000 serialized input characters,
  6,000 output tokens, 10 groups, three evidence links per card, and four
  research questions per card.
- Send only accepted normalized feedback required for analysis.
- Treat survey text and model output as untrusted input.
- Never accept quote text from the model; resolve exact excerpts in PostgreSQL.
- Replace pending AI drafts atomically and never overwrite a human-reviewed card.

## 2026-08-09 — Product Manager review workflow

- Load review data server-side under the authenticated Supabase session and RLS.
- Keep `ai_generated` as immutable origin metadata.
- Persist edits and append-only review events in one database transaction.
- Reject stale writes with optimistic concurrency.
- Display scale as linked evidence responses divided by all rows in the current
  import, with the denominator shown explicitly.

## Deferred decisions

- Production Supabase region and retention policy.
- Production domain and operational monitoring policy.
