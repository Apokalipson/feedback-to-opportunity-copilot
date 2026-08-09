# Feedback-to-Opportunity Copilot MVP

An English-language web application that turns uploaded mobile-app survey
feedback into AI-assisted Opportunity Cards. AI prepares a draft analysis; a
human Product Manager remains responsible for approval, editing, or rejection.

## Capabilities

The Product Manager can:

1. Sign in to a private single-user workspace.
2. Upload one CSV survey export as the current import.
3. Review normalized responses and AI-assigned topic, user problem, sentiment,
   and product area.
4. Review groups of similar feedback.
5. Review Opportunity Cards containing the user need, example quotes, scale,
   a potential solution, and research questions.
6. Approve, edit, or reject every AI-generated card.
7. Search and filter the current import.

## Stack

- Next.js with TypeScript and Tailwind CSS
- Next.js server routes as the application backend
- Supabase Auth and PostgreSQL
- OpenAI API called only from the server
- GitHub connected to Vercel for CI/CD and production hosting

The system boundaries are documented in
[`docs/architecture.md`](docs/architecture.md), the survey and AI contracts in
[`docs/data-contract.md`](docs/data-contract.md), and the database workflow in
[`docs/database.md`](docs/database.md).

## Local setup

Requirements: Node.js 20 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run check
```

This runs linting, TypeScript checks, unit tests, and a production build.

Database migrations and local pgTAP tests use the project-pinned Supabase CLI:

```bash
npm run db:start
npm run db:reset
npm run db:test
```

The database commands require Docker or another Docker-compatible runtime.
Public signup is disabled; create the single Product Manager account through
the Supabase admin interface, never by adding a password to Git.

## Security

- Never place credentials, environment files, or real survey exports in Git.
- `.env.local` is local-only; `.env.example` contains names, not secrets.
- Development, testing, and demonstrations use synthetic feedback.
- OpenAI credentials and any privileged Supabase credentials remain server-only.
- See [`docs/security.md`](docs/security.md) for the operational checklist.

## Deployment

The production workflow uses GitHub as the source repository and Vercel as the
Next.js hosting platform. Hosted environment values are configured in Vercel,
not copied from local files. Every deployment must pass the quality gate and a
secret scan before promotion.
