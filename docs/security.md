# Security checklist

## Secrets

- Keep local values in `.env.local` or `.env`; both are ignored by Git.
- Commit only `.env.example`, with variable names and no usable credentials.
- Configure production values in Vercel rather than copying the local file.
- Treat `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` as server-only.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the legacy anon key are
  browser-safe identifiers, but they never replace authentication or RLS.
- Rotate a credential immediately if it appears in Git history, logs, or a
  screenshot; removing the file alone does not revoke the exposed credential.

If an environment file is accidentally staged but not committed:

```bash
git restore --staged .env
```

If it was previously tracked:

```bash
git rm --cached .env
```

Then confirm ignore behavior with:

```bash
git check-ignore -v .env .env.local
git status --ignored
```

## Data

- Never commit the supplied survey export or production/customer data.
- Use clearly synthetic records and non-routable example identities in tests.
- Preserve raw input separately from AI output.
- Redact quotes in any demonstration artifact that could identify a respondent.

## CSV ingestion

- Treat filenames, MIME types, encodings, headers, cells, and row counts as
  untrusted even after login.
- Accept only same-origin authenticated POST requests and repeat `getClaims()`
  at the import boundary.
- Limit the CSV to 1 MiB and 1,000 response rows before database persistence.
- Require valid UTF-8, frozen unique headers, consistent row lengths, and
  bounded cells. Never guess unsupported Q2/Q3 feature codes.
- Return counts and safe validation messages to the browser; do not echo raw
  survey cells or authorization data.
- Keep the previous current import available until the complete replacement has
  been saved successfully.

## Supabase access control

- Public signup is disabled for the one-PM MVP.
- Verify server-side identity with `supabase.auth.getClaims()`; never authorize
  a request from `getSession()` data alone.
- Keep service-role or secret keys out of browser code and normal user flows.
- Enable RLS on every public application table and scope policies with
  `(select auth.uid()) = owner_id` (or the profile ID).
- Use composite foreign keys so a child row cannot combine another owner's IDs.
- Do not apply synthetic seed data to production. Remote seeding is permitted
  only for an explicitly selected development or staging project.
- Revoke Data API execution from automatic-RLS `SECURITY DEFINER` helpers.
  Migration `20260809015343_security_hardening.sql` removes `EXECUTE` from
  `public`, `anon`, and `authenticated`.
- Supabase leaked-password protection is unavailable on the Free plan. For the
  development project, compensate with a generated unique password stored in a
  password manager, disabled public signup, and one administrative account.
  Require leaked-password protection before treating a future hosted project
  as production-ready.

## HTTP evidence

- Capture method, URL path, content type, redacted payload shape, status, and
  redacted JSON response.
- Never expose a bearer token or server-side environment value in evidence.
- The browser should call our authenticated backend; only the server calls
  OpenAI with the secret authorization header.

## AI analysis controls

- `OPENAI_API_KEY` and `OPENAI_MODEL` are read only in a `server-only` module.
  The browser receives neither the key nor an OpenAI authorization header.
- The development key belongs to a dedicated OpenAI project and is restricted
  to write access for `/v1/responses`; every other API capability remains
  disabled.
- Provider cost controls combine USD 5 prepaid credit, disabled auto-reload,
  60% and 100% alerts, and an enforced project hard limit. Application controls
  separately cap responses, input characters, output tokens, groups, retries,
  and timeout.
- Survey text is treated as untrusted prompt data. The developer instruction
  tells the model to ignore embedded instructions, and no tools are available
  to the request.
- OpenAI response storage is disabled. The request uses a SHA-256 digest of the
  Supabase user UUID as `safety_identifier`, never an email address.
- Model output cannot supply quote text. The atomic database function resolves
  evidence from an allowed normalized source field and refuses missing or
  cross-group references.
- Logs, HTTP evidence, and API responses contain only redacted payload shape,
  aggregate counts, model/version, and token usage. They exclude source text,
  model content, cookies, bearer values, and environment variables.

## Product Manager review controls

- Load review data under the authenticated server session and RLS; never expose
  raw survey payloads to the browser review workspace.
- Accept review mutations only as same-origin authenticated JSON with a 16 KiB
  request cap and runtime validation of UUIDs, status, text lengths, question
  count, and unknown fields.
- Verify the card belongs to the authenticated owner's current ready import
  inside the same database transaction that updates it.
- Use optimistic concurrency so a stale editor cannot overwrite newer content
  or status. Refuse no-op requests rather than creating misleading history.
- Keep review history append-only. Revoke direct authenticated updates and
  inserts; expose only the bounded review function.
- Evidence excerpts remain database-derived and read-only in the review flow.
  The browser cannot replace or invent source evidence while editing a card.
