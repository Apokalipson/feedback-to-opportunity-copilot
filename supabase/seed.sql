-- Synthetic, non-routable fixtures for local development only.
-- The placeholder Auth row has no password or identity and cannot sign in.
insert into auth.users (id, email, raw_user_meta_data)
values (
  '10000000-0000-4000-8000-000000000001',
  'synthetic-pm@example.test',
  '{"display_name":"Synthetic Product Manager"}'::jsonb
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
  warning_rows,
  created_at,
  updated_at
)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'synthetic-feedback.csv',
  'ready',
  true,
  6,
  5,
  1,
  1,
  '2026-01-15T09:00:00Z',
  '2026-01-15T09:05:00Z'
);

insert into public.survey_responses (
  id,
  import_id,
  owner_id,
  source_row_number,
  raw_payload,
  normalized_texts,
  q2_feature_codes,
  q3_feature_code,
  validation_status,
  validation_issues,
  created_at
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    1,
    '{"Q2":"1,3","Q3":"3","free_text":"The device finder takes too long to update."}'::jsonb,
    '{"q5_comment":"The device finder takes too long to update."}'::jsonb,
    array[1, 3]::smallint[],
    3,
    'valid',
    '[]'::jsonb,
    '2026-01-15T09:00:01Z'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    2,
    '{"Q2":null,"Q3":null,"free_text":null,"follow_up":null}'::jsonb,
    '{"q5_comment":null,"q4b_ces_comment":null}'::jsonb,
    '{}'::smallint[],
    null,
    'valid',
    '[]'::jsonb,
    '2026-01-15T09:00:02Z'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    3,
    '{"Q2":"1,3","Q3":"3","free_text":"The device finder takes too long to update."}'::jsonb,
    '{"q5_comment":"The device finder takes too long to update."}'::jsonb,
    array[1, 3]::smallint[],
    3,
    'valid',
    '[]'::jsonb,
    '2026-01-15T09:00:03Z'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    4,
    jsonb_build_object(
      'Q2',
      '5',
      'Q3',
      '5',
      'q5_comment',
      repeat(
        'The synthetic respondent describes a deliberately long usage-history explanation. ',
        80
      )
    ),
    jsonb_build_object(
      'free_text',
      repeat(
        'The synthetic respondent describes a deliberately long usage-history explanation. ',
        80
      )
    ),
    array[5]::smallint[],
    5,
    'warning',
    '[{"field":"free_text","code":"long_text"}]'::jsonb,
    '2026-01-15T09:00:04Z'
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    5,
    '{"Q2":"1,99","Q3":"2","free_text":"The lock controls were clear."}'::jsonb,
    '{"q5_comment":"The lock controls were clear."}'::jsonb,
    array[1]::smallint[],
    2,
    'invalid',
    '[{"field":"q2_feature_codes","code":"unsupported_feature_code","value":"99"}]'::jsonb,
    '2026-01-15T09:00:05Z'
  ),
  (
    '30000000-0000-4000-8000-000000000006',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    6,
    '{"Q2":"2,4,6","Q3":"4","free_text":"I need clearer session recovery guidance."}'::jsonb,
    '{"q5_comment":"I need clearer session recovery guidance."}'::jsonb,
    array[2, 4, 6]::smallint[],
    4,
    'valid',
    '[]'::jsonb,
    '2026-01-15T09:00:06Z'
  );

insert into public.response_analyses (
  id,
  response_id,
  import_id,
  owner_id,
  topic,
  user_problem,
  sentiment,
  product_area,
  confidence,
  uncertainty_metadata,
  model_identifier,
  analysis_version,
  created_at
)
values (
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'performance',
  'The user cannot quickly confirm the latest device location.',
  'negative',
  'find_my_glo',
  0.840,
  '{"synthetic":true,"reasons":[]}'::jsonb,
  'synthetic-model',
  'fixture-v1',
  '2026-01-15T09:10:00Z'
);

insert into public.feedback_groups (
  id,
  import_id,
  owner_id,
  label,
  summary,
  confidence,
  grouping_version,
  created_at
)
values (
  '50000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Slow device-location refresh',
  'Two intentionally duplicated synthetic responses report the same delay.',
  0.910,
  'fixture-v1',
  '2026-01-15T09:12:00Z'
);

insert into public.group_memberships (
  group_id,
  response_id,
  import_id,
  owner_id,
  confidence,
  created_at
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    0.950,
    '2026-01-15T09:13:00Z'
  ),
  (
    '50000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    0.950,
    '2026-01-15T09:13:01Z'
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
)
values (
  '60000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Users need timely confirmation of their device location.',
  'Investigate clearer freshness indicators and a manual refresh action.',
  array[
    'How stale is the location when users lose confidence?',
    'Would a timestamp or explicit refresh action resolve the uncertainty?'
  ],
  'pending',
  true,
  'fixture-v1',
  '2026-01-15T09:15:00Z',
  '2026-01-15T09:15:00Z'
);

insert into public.opportunity_evidence (
  card_id,
  response_id,
  import_id,
  owner_id,
  representative_quote,
  created_at
)
values (
  '60000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'The device finder takes too long to update.',
  '2026-01-15T09:16:00Z'
);

insert into public.opportunity_review_history (
  id,
  card_id,
  import_id,
  owner_id,
  previous_status,
  new_status,
  edited_fields,
  review_note,
  created_at
)
values (
  '70000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  null,
  'pending',
  '{}'::jsonb,
  'Synthetic draft awaiting Product Manager review.',
  '2026-01-15T09:17:00Z'
);
