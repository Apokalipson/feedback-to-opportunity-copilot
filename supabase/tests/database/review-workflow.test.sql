begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '12000000-0000-4000-8000-000000000005',
    'review-pm@example.test',
    '{"display_name":"Review Synthetic PM"}'::jsonb
  ),
  (
    '12000000-0000-4000-8000-000000000006',
    'review-other@example.test',
    '{"display_name":"Review Other PM"}'::jsonb
  );

insert into public.imports (
  id,
  owner_id,
  source_filename,
  status,
  is_current,
  total_rows,
  accepted_rows,
  rejected_rows,
  warning_rows
) values (
  '22000000-0000-4000-8000-000000000005',
  '12000000-0000-4000-8000-000000000005',
  'review-synthetic.csv',
  'ready',
  true,
  4,
  3,
  1,
  0
);

insert into public.survey_responses (
  id,
  import_id,
  owner_id,
  source_row_number,
  raw_payload,
  normalized_texts,
  validation_status,
  validation_issues
) values (
  '32000000-0000-4000-8000-000000000005',
  '22000000-0000-4000-8000-000000000005',
  '12000000-0000-4000-8000-000000000005',
  1,
  '{}'::jsonb,
  '{"q5_comment":"Synthetic recovery guidance feedback."}'::jsonb,
  'valid',
  '[]'::jsonb
);

insert into public.feedback_groups (
  id,
  import_id,
  owner_id,
  label,
  summary,
  confidence,
  grouping_version
) values (
  '42000000-0000-4000-8000-000000000005',
  '22000000-0000-4000-8000-000000000005',
  '12000000-0000-4000-8000-000000000005',
  'Synthetic recovery guidance',
  'One synthetic response requests clearer recovery guidance.',
  0.8,
  'review-test-model'
);

insert into public.group_memberships (
  group_id,
  response_id,
  import_id,
  owner_id,
  confidence
) values (
  '42000000-0000-4000-8000-000000000005',
  '32000000-0000-4000-8000-000000000005',
  '22000000-0000-4000-8000-000000000005',
  '12000000-0000-4000-8000-000000000005',
  0.8
);

insert into public.opportunity_cards (
  id,
  group_id,
  import_id,
  owner_id,
  user_need,
  potential_solution,
  research_questions,
  review_status,
  ai_generated,
  analysis_version,
  created_at,
  updated_at
) values (
  '52000000-0000-4000-8000-000000000005',
  '42000000-0000-4000-8000-000000000005',
  '22000000-0000-4000-8000-000000000005',
  '12000000-0000-4000-8000-000000000005',
  'Users need clear recovery guidance.',
  'Investigate a guided recovery state.',
  array['Which interruption states create confusion?'],
  'pending',
  true,
  'review-test-model',
  '2026-08-09 12:00:00+00',
  '2026-08-09 12:00:00+00'
);

insert into public.opportunity_evidence (
  card_id,
  response_id,
  import_id,
  owner_id,
  representative_quote
) values (
  '52000000-0000-4000-8000-000000000005',
  '32000000-0000-4000-8000-000000000005',
  '22000000-0000-4000-8000-000000000005',
  '12000000-0000-4000-8000-000000000005',
  'Synthetic recovery guidance feedback.'
);

create temporary table tap_output (line text) on commit drop;
grant insert, select on table tap_output to authenticated;

insert into tap_output select plan(13);

insert into tap_output select ok(
  not has_table_privilege('authenticated', 'public.opportunity_cards', 'UPDATE'),
  'authenticated clients cannot update Opportunity Cards directly'
);

insert into tap_output select ok(
  not has_table_privilege('authenticated', 'public.opportunity_review_history', 'INSERT'),
  'authenticated clients cannot forge review history directly'
);

insert into tap_output select ok(
  has_function_privilege(
    'authenticated',
    'public.review_current_opportunity_card(uuid,uuid,timestamptz,text,text,text[],public.review_status,text)',
    'EXECUTE'
  ),
  'authenticated users may execute the bounded review function'
);

set local role authenticated;
set local request.jwt.claim.sub = '12000000-0000-4000-8000-000000000005';

insert into tap_output select lives_ok(
  $$
    select public.review_current_opportunity_card(
      '22000000-0000-4000-8000-000000000005',
      '52000000-0000-4000-8000-000000000005',
      '2026-08-09 12:00:00+00',
      'Users need a clear and recoverable session state.',
      'Explore a guided recovery state with explicit next steps.',
      array[
        'Which interruption states create confusion?',
        'Which next step restores confidence?'
      ],
      'approved',
      'Approved against synthetic evidence.'
    )
  $$,
  'the owner can edit and approve a card in the current import'
);

insert into tap_output select is(
  (
    select review_status::text
    from public.opportunity_cards
    where id = '52000000-0000-4000-8000-000000000005'
  ),
  'approved',
  'the human review status persists'
);

insert into tap_output select is(
  (
    select user_need
    from public.opportunity_cards
    where id = '52000000-0000-4000-8000-000000000005'
  ),
  'Users need a clear and recoverable session state.',
  'the edited user need persists'
);

insert into tap_output select is(
  (select count(*) from public.opportunity_review_history),
  1::bigint,
  'one append-only history event records the review'
);

insert into tap_output select is(
  (
    select edited_fields
    from public.opportunity_review_history
    limit 1
  ),
  '{"potential_solution": true, "research_questions": true, "user_need": true}'::jsonb,
  'history identifies every edited content field'
);

insert into tap_output select throws_ok(
  $$
    select public.review_current_opportunity_card(
      '22000000-0000-4000-8000-000000000005',
      '52000000-0000-4000-8000-000000000005',
      '2026-08-09 12:00:00+00',
      'A stale overwrite attempt.',
      'A stale solution.',
      array['A stale question?'],
      'rejected',
      null
    )
  $$,
  '40001',
  'review_stale',
  'an outdated editor cannot overwrite the persisted review'
);

insert into tap_output select is(
  (select count(*) from public.opportunity_review_history),
  1::bigint,
  'a stale attempt does not append history'
);

set local request.jwt.claim.sub = '12000000-0000-4000-8000-000000000006';

insert into tap_output select throws_ok(
  $$
    select public.review_current_opportunity_card(
      '22000000-0000-4000-8000-000000000005',
      '52000000-0000-4000-8000-000000000005',
      '2026-08-09 12:00:00+00',
      'Another owner must not edit this card.',
      'No cross-owner solution.',
      array['Should this be blocked?'],
      'rejected',
      null
    )
  $$,
  '22023',
  'review_card_not_available',
  'another authenticated user cannot review the card'
);

set local request.jwt.claim.sub = '12000000-0000-4000-8000-000000000005';

insert into tap_output select throws_ok(
  $$
    select public.review_current_opportunity_card(
      '22000000-0000-4000-8000-000000000005',
      '52000000-0000-4000-8000-000000000005',
      (select updated_at from public.opportunity_cards where id = '52000000-0000-4000-8000-000000000005'),
      'Users need a clear and recoverable session state.',
      'Explore a guided recovery state with explicit next steps.',
      array[
        'Which interruption states create confusion?',
        'Which next step restores confidence?'
      ],
      'approved',
      null
    )
  $$,
  '22023',
  'review_no_changes',
  'a no-op review is rejected'
);

insert into tap_output select is(
  (select count(*) from public.opportunity_review_history),
  1::bigint,
  'rejected review attempts leave the accepted history unchanged'
);

reset role;

insert into tap_output select * from finish();
select line from tap_output;

rollback;
