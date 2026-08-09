begin;

create extension if not exists pgcrypto with schema extensions;

create type public.import_status as enum (
  'pending',
  'validating',
  'ready',
  'failed'
);

create type public.validation_status as enum (
  'valid',
  'warning',
  'invalid'
);

create type public.review_status as enum (
  'pending',
  'approved',
  'rejected'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Product Manager'
    check (char_length(display_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  source_filename text not null
    check (char_length(source_filename) between 1 and 255),
  status public.import_status not null default 'pending',
  is_current boolean not null default false,
  total_rows integer not null default 0 check (total_rows >= 0),
  accepted_rows integer not null default 0 check (accepted_rows >= 0),
  rejected_rows integer not null default 0 check (rejected_rows >= 0),
  warning_rows integer not null default 0 check (warning_rows >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  check (accepted_rows + rejected_rows <= total_rows),
  check (warning_rows <= total_rows)
);

create unique index imports_one_current_per_owner
  on public.imports (owner_id)
  where is_current;

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null,
  owner_id uuid not null,
  source_row_number integer not null check (source_row_number > 0),
  raw_payload jsonb not null,
  normalized_texts jsonb not null default '{}'::jsonb,
  q2_feature_codes smallint[] not null default '{}'::smallint[],
  q3_feature_code smallint,
  validation_status public.validation_status not null default 'valid',
  validation_issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (import_id, source_row_number),
  unique (id, import_id, owner_id),
  foreign key (import_id, owner_id)
    references public.imports (id, owner_id) on delete cascade,
  check (jsonb_typeof(raw_payload) = 'object'),
  check (jsonb_typeof(normalized_texts) = 'object'),
  check (jsonb_typeof(validation_issues) = 'array'),
  check (
    q2_feature_codes
      <@ array[1, 2, 3, 4, 5, 6]::smallint[]
  ),
  check (q3_feature_code is null or q3_feature_code between 1 and 6)
);

create table public.response_analyses (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null,
  import_id uuid not null,
  owner_id uuid not null,
  topic text,
  user_problem text,
  sentiment text,
  product_area text,
  confidence numeric(4, 3)
    check (confidence is null or confidence between 0 and 1),
  uncertainty_metadata jsonb not null default '{}'::jsonb,
  model_identifier text,
  analysis_version text,
  created_at timestamptz not null default now(),
  unique (response_id),
  unique (id, import_id, owner_id),
  foreign key (response_id, import_id, owner_id)
    references public.survey_responses (id, import_id, owner_id)
    on delete cascade,
  check (jsonb_typeof(uncertainty_metadata) = 'object')
);

create table public.feedback_groups (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null,
  owner_id uuid not null,
  label text not null check (char_length(label) between 1 and 160),
  summary text,
  confidence numeric(4, 3)
    check (confidence is null or confidence between 0 and 1),
  grouping_version text,
  created_at timestamptz not null default now(),
  unique (id, import_id, owner_id),
  foreign key (import_id, owner_id)
    references public.imports (id, owner_id) on delete cascade
);

create table public.group_memberships (
  group_id uuid not null,
  response_id uuid not null,
  import_id uuid not null,
  owner_id uuid not null,
  confidence numeric(4, 3)
    check (confidence is null or confidence between 0 and 1),
  created_at timestamptz not null default now(),
  primary key (group_id, response_id),
  foreign key (group_id, import_id, owner_id)
    references public.feedback_groups (id, import_id, owner_id)
    on delete cascade,
  foreign key (response_id, import_id, owner_id)
    references public.survey_responses (id, import_id, owner_id)
    on delete cascade
);

create table public.opportunity_cards (
  id uuid primary key default gen_random_uuid(),
  group_id uuid,
  import_id uuid not null,
  owner_id uuid not null,
  user_need text not null check (char_length(user_need) > 0),
  potential_solution text,
  research_questions text[] not null default '{}'::text[],
  review_status public.review_status not null default 'pending',
  ai_generated boolean not null default true,
  analysis_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, import_id, owner_id),
  foreign key (import_id, owner_id)
    references public.imports (id, owner_id) on delete cascade,
  foreign key (group_id, import_id, owner_id)
    references public.feedback_groups (id, import_id, owner_id)
    on delete set null (group_id)
);

create table public.opportunity_evidence (
  card_id uuid not null,
  response_id uuid not null,
  import_id uuid not null,
  owner_id uuid not null,
  representative_quote text not null
    check (char_length(representative_quote) > 0),
  created_at timestamptz not null default now(),
  primary key (card_id, response_id),
  foreign key (card_id, import_id, owner_id)
    references public.opportunity_cards (id, import_id, owner_id)
    on delete cascade,
  foreign key (response_id, import_id, owner_id)
    references public.survey_responses (id, import_id, owner_id)
    on delete cascade
);

create table public.opportunity_review_history (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null,
  import_id uuid not null,
  owner_id uuid not null,
  previous_status public.review_status,
  new_status public.review_status not null,
  edited_fields jsonb not null default '{}'::jsonb,
  review_note text,
  created_at timestamptz not null default now(),
  foreign key (card_id, import_id, owner_id)
    references public.opportunity_cards (id, import_id, owner_id)
    on delete cascade,
  check (jsonb_typeof(edited_fields) = 'object')
);

create index imports_owner_id_idx
  on public.imports (owner_id);
create index survey_responses_owner_import_idx
  on public.survey_responses (owner_id, import_id);
create index response_analyses_owner_import_idx
  on public.response_analyses (owner_id, import_id);
create index feedback_groups_owner_import_idx
  on public.feedback_groups (owner_id, import_id);
create index group_memberships_owner_import_idx
  on public.group_memberships (owner_id, import_id);
create index opportunity_cards_owner_import_idx
  on public.opportunity_cards (owner_id, import_id);
create index opportunity_evidence_owner_import_idx
  on public.opportunity_evidence (owner_id, import_id);
create index opportunity_review_history_owner_import_idx
  on public.opportunity_review_history (owner_id, import_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger imports_set_updated_at
before update on public.imports
for each row execute function public.set_updated_at();

create trigger opportunity_cards_set_updated_at
before update on public.opportunity_cards
for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(new.raw_user_meta_data ->> 'display_name', ''),
        'Product Manager'
      ),
      120
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.imports enable row level security;
alter table public.survey_responses enable row level security;
alter table public.response_analyses enable row level security;
alter table public.feedback_groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.opportunity_cards enable row level security;
alter table public.opportunity_evidence enable row level security;
alter table public.opportunity_review_history enable row level security;

grant usage on schema public to anon, authenticated;
grant usage on type public.import_status to authenticated;
grant usage on type public.validation_status to authenticated;
grant usage on type public.review_status to authenticated;

revoke all on table public.profiles from anon, authenticated;
grant select, update on table public.profiles to authenticated;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id)
with check ((select auth.uid()) is not null and (select auth.uid()) = id);

revoke all on table public.imports from anon, authenticated;
grant select, insert, update, delete on table public.imports to authenticated;

create policy "imports_select_own"
on public.imports for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "imports_insert_own"
on public.imports for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "imports_update_own"
on public.imports for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "imports_delete_own"
on public.imports for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

revoke all on table public.survey_responses from anon, authenticated;
grant select, insert, update, delete on table public.survey_responses to authenticated;

create policy "survey_responses_select_own"
on public.survey_responses for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "survey_responses_insert_own"
on public.survey_responses for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "survey_responses_update_own"
on public.survey_responses for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "survey_responses_delete_own"
on public.survey_responses for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

revoke all on table public.response_analyses from anon, authenticated;
grant select, insert, update, delete on table public.response_analyses to authenticated;

create policy "response_analyses_select_own"
on public.response_analyses for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "response_analyses_insert_own"
on public.response_analyses for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "response_analyses_update_own"
on public.response_analyses for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "response_analyses_delete_own"
on public.response_analyses for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

revoke all on table public.feedback_groups from anon, authenticated;
grant select, insert, update, delete on table public.feedback_groups to authenticated;

create policy "feedback_groups_select_own"
on public.feedback_groups for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "feedback_groups_insert_own"
on public.feedback_groups for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "feedback_groups_update_own"
on public.feedback_groups for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "feedback_groups_delete_own"
on public.feedback_groups for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

revoke all on table public.group_memberships from anon, authenticated;
grant select, insert, update, delete on table public.group_memberships to authenticated;

create policy "group_memberships_select_own"
on public.group_memberships for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "group_memberships_insert_own"
on public.group_memberships for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "group_memberships_update_own"
on public.group_memberships for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "group_memberships_delete_own"
on public.group_memberships for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

revoke all on table public.opportunity_cards from anon, authenticated;
grant select, insert, update, delete on table public.opportunity_cards to authenticated;

create policy "opportunity_cards_select_own"
on public.opportunity_cards for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "opportunity_cards_insert_own"
on public.opportunity_cards for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "opportunity_cards_update_own"
on public.opportunity_cards for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "opportunity_cards_delete_own"
on public.opportunity_cards for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

revoke all on table public.opportunity_evidence from anon, authenticated;
grant select, insert, update, delete on table public.opportunity_evidence to authenticated;

create policy "opportunity_evidence_select_own"
on public.opportunity_evidence for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "opportunity_evidence_insert_own"
on public.opportunity_evidence for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "opportunity_evidence_update_own"
on public.opportunity_evidence for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "opportunity_evidence_delete_own"
on public.opportunity_evidence for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

revoke all on table public.opportunity_review_history from anon, authenticated;
grant select, insert on table public.opportunity_review_history to authenticated;

create policy "opportunity_review_history_select_own"
on public.opportunity_review_history for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "opportunity_review_history_insert_own"
on public.opportunity_review_history for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

commit;
