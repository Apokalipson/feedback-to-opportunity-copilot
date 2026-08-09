begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

create temporary table schema_security_tap_results (
  test_order integer primary key,
  result text not null
) on commit drop;

grant select, insert on schema_security_tap_results to authenticated;

insert into schema_security_tap_results values (0, plan(16));

insert into schema_security_tap_results values (
  1,
  has_table('public', 'profiles', 'profiles table exists')
);
insert into schema_security_tap_results values (
  2,
  has_table('public', 'imports', 'imports table exists')
);
insert into schema_security_tap_results values (
  3,
  has_table('public', 'survey_responses', 'responses table exists')
);
insert into schema_security_tap_results values (
  4,
  has_table('public', 'response_analyses', 'analyses table exists')
);
insert into schema_security_tap_results values (
  5,
  has_table('public', 'feedback_groups', 'groups table exists')
);
insert into schema_security_tap_results values (
  6,
  has_table('public', 'opportunity_cards', 'cards table exists')
);
insert into schema_security_tap_results values (
  7,
  has_table(
    'public',
    'opportunity_review_history',
    'review history table exists'
  )
);

insert into schema_security_tap_results values (
  8,
  ok(
    (
      select bool_and(c.relrowsecurity)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'profiles',
          'imports',
          'survey_responses',
          'response_analyses',
          'feedback_groups',
          'group_memberships',
          'opportunity_cards',
          'opportunity_evidence',
          'opportunity_review_history'
        )
    ),
    'RLS is enabled on every application table'
  )
);

insert into schema_security_tap_results values (
  9,
  is(
    (select count(*) from public.survey_responses),
    6::bigint,
    'six synthetic responses are present'
  )
);

insert into schema_security_tap_results values (
  10,
  is(
    (
      select normalized_texts -> 'q5_comment'
      from public.survey_responses
      where source_row_number = 2
    ),
    'null'::jsonb,
    'blank text remains an explicit JSON null'
  )
);

insert into schema_security_tap_results values (
  11,
  is(
    (
      select count(*)
      from public.survey_responses
      where normalized_texts ->> 'q5_comment' =
        'The device finder takes too long to update.'
    ),
    2::bigint,
    'duplicate feedback remains as two traceable rows'
  )
);

insert into schema_security_tap_results values (
  12,
  ok(
    (
      select char_length(normalized_texts ->> 'q5_comment') > 5000
      from public.survey_responses
      where source_row_number = 4
    ),
    'long synthetic feedback is preserved'
  )
);

insert into schema_security_tap_results values (
  13,
  ok(
    (
      select raw_payload ->> 'Q2' = '1,99'
        and not (99 = any(q2_feature_codes))
        and validation_status = 'invalid'
      from public.survey_responses
      where source_row_number = 5
    ),
    'unsupported code stays raw, is not normalized, and is flagged'
  )
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '10000000-0000-4000-8000-000000000002',
  'second-synthetic-pm@example.test',
  '{"display_name":"Second Synthetic PM"}'::jsonb
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';

insert into schema_security_tap_results values (
  14,
  is(
    (select count(*) from public.imports),
    1::bigint,
    'the fixture owner can read the current import'
  )
);

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';

insert into schema_security_tap_results values (
  15,
  is(
    (select count(*) from public.imports),
    0::bigint,
    'a different authenticated user cannot read the import'
  )
);

insert into schema_security_tap_results values (
  16,
  throws_ok(
    $$
      insert into public.imports (owner_id, source_filename)
      values (
        '10000000-0000-4000-8000-000000000001',
        'cross-owner-attempt.csv'
      )
    $$,
    '42501',
    'new row violates row-level security policy for table "imports"',
    'a different authenticated user cannot write as the owner'
  )
);

reset role;

insert into schema_security_tap_results (test_order, result)
select 17, finish_line
from finish() as finish_line;

select result
from schema_security_tap_results
order by test_order;

rollback;
