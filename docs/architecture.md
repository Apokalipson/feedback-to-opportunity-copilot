# Architecture

## System boundary

```text
Browser
  -> Next.js pages and server routes (HTTPS)
      -> Supabase Auth and PostgreSQL (HTTPS)
      -> OpenAI API (HTTPS, server-side only)
```

## Frontend

- English responsive interface built with Next.js and Tailwind CSS.
- Login, upload, import status, response explorer, grouped feedback, and
  Opportunity Card review screens.
- Search and filters operate on the current import.
- Browser requests call only our backend/Supabase browser-safe interfaces.
- No OpenAI or Supabase service-role secret is shipped to the browser.

## Backend

- Next.js server routes provide CSV ingestion, validation, AI analysis,
  grouping, summaries, and review mutations.
- The server validates authentication, input size/type, parsed data, AI output,
  and database mutations.
- OpenAI requests originate on the server and return a constrained structured
  result.
- Cost controls will include an import row limit, bounded input length, one
  explicit analysis action, and documented provider limits.
- Supabase Auth sessions use server-managed cookies through `@supabase/ssr`.
- `src/proxy.ts` refreshes sessions and performs an optimistic route redirect;
  secure authorization is repeated with `getClaims()` in the server-side data
  access layer.
- `POST /api/imports` accepts same-origin authenticated multipart requests. It
  bounds the request before buffering, validates the file and parsed rows, and
  returns only a minimal import summary.
- CSV parsing uses an RFC-compatible parser so quoted commas and line breaks do
  not change record association. Runtime validation then applies the frozen
  header and Q2/Q3 contract.
- A replacement import is inserted as non-current. Only after all response rows
  are stored does the DAL switch the current-import flag; on failure it restores
  the previous current import and removes the incomplete replacement.
- `POST /api/analysis` accepts only same-origin authenticated JSON containing
  the current import UUID. It loads accepted non-empty feedback through RLS,
  enforces the analysis size limits, and calls the OpenAI Responses API only
  from a `server-only` module.
- OpenAI uses Structured Outputs for the structural schema. A second runtime
  validation layer checks complete response coverage, controlled labels,
  grouping, one-card-per-group, and evidence relationships. If a card repeats
  one valid source response with different fields, the server deterministically
  keeps the first reference before persistence.
- A single `SECURITY DEFINER` PostgreSQL function checks `auth.uid()`, locks the
  import for the transaction, replaces pending analysis records, and returns
  only counts. Any exception rolls back the complete replacement. Direct
  authenticated writes to AI-derived tables are revoked.
- Evidence payloads contain only a response UUID and normalized field name.
  PostgreSQL obtains the exact source excerpt inside the atomic transaction, so
  generated or browser-supplied quote text cannot enter the evidence table.
- The review workspace is loaded server-side through authenticated RLS-scoped
  queries. Browser view models contain normalized feedback and AI-derived
  fields required for review, but omit raw payloads and unnecessary response,
  group, and membership identifiers.
- `PATCH /api/opportunity-cards/review` accepts same-origin authenticated JSON,
  validates bounded editable content, and delegates persistence to one
  `SECURITY DEFINER` PostgreSQL function. That function verifies ownership and
  current-import state, applies optimistic concurrency, updates the card, and
  appends its review-history event atomically.
- Authenticated clients retain read access through RLS but cannot directly
  update Opportunity Cards or insert review-history rows. The narrowly scoped
  review function is the only normal Product Manager mutation path.

## Database

- Supabase PostgreSQL stores users, imports, normalized responses, analysis
  results, groups, Opportunity Cards, source links, and review history.
- UUID primary keys and UTC timestamps preserve integrity.
- Row Level Security restricts records to the authenticated MVP user.
- Synthetic seed records are maintained separately from migrations.
- Composite owner/import foreign keys prevent cross-owner relationships even
  before Row Level Security is evaluated.
- Public signup is disabled. The MVP account is created administratively and
  no password is stored in the repository.

## Trust boundaries

1. Uploaded CSV is untrusted input.
2. AI output is untrusted generated input.
3. Browser input is untrusted even after login.
4. Server-only environment variables are secrets.
5. Raw survey exports are private data and remain outside Git.

## Deployment

- GitHub is the source repository.
- Vercel will build and deploy each selected Git branch/commit.
- Supabase remains the managed backend and relational database.
- Environment values are configured separately for local and hosted runtimes.

Architecture decisions may change only through an entry in
`docs/decision-log.md`.
