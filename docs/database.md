# Supabase database workflow

## Versioned assets

- `supabase/config.toml`: local Auth and database configuration;
- `supabase/migrations/`: ordered production schema changes;
- `supabase/seed.sql`: synthetic local development data only;
- `supabase/tests/database/`: pgTAP structure, fixture, and RLS tests;
- `src/types/database.ts`: typed application contract.

## Local verification

Requirements: Docker Desktop, Podman, OrbStack, or another Docker-compatible
runtime available on `PATH`.

```bash
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
```

`db:reset` is destructive only to the local development database. It replays
all migrations and then loads `supabase/seed.sql`.

## Hosted project workflow

Use separate development and production projects. Development may contain
synthetic fixtures; production must never receive the synthetic seed.

1. Disable public email signup in hosted Auth settings.
2. Authenticate the CLI without recording its access token.
3. Link the exact intended project explicitly.
4. Review `supabase db push --dry-run`.
5. Apply migrations only after the dry run is accepted.
6. Never use `--include-seed` against production.
7. Create the Product Manager administratively and keep credentials in a
   password manager.
8. Put only the project URL and publishable key in browser-visible
   configuration; privileged keys remain server-only.

Every hosted schema or data mutation requires an explicit review and approval.

## Inspection queries

Run these in Studio or `psql` after migrations are applied:

```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;
```

```sql
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Expected: all application tables have RLS enabled; `anon` has no direct table
grants; authenticated policies scope rows to `auth.uid()`; review history is
append-only through the approved mutation path.

## Evidence rules

- Capture schema names, policy definitions, aggregate row counts, and redacted
  test results—not project secrets or login credentials.
- Use only synthetic fixtures for demonstrations and screenshots.
- Record the exact environment type and test date.
