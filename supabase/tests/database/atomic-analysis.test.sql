begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

insert into auth.users (id, email, raw_user_meta_data)
values (
  '11000000-0000-4000-8000-000000000004',
  'analysis-pm@example.test',
  '{"display_name":"Analysis Synthetic PM"}'::jsonb
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
  '21000000-0000-4000-8000-000000000004',
  '11000000-0000-4000-8000-000000000004',
  'analysis-synthetic.csv',
  'ready',
  true,
  4,
  4,
  0,
  0
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
  validation_issues
) values
  (
    '31000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000004',
    '11000000-0000-4000-8000-000000000004',
    1,
    '{}'::jsonb,
    '{"q5_comment":"The device finder takes too long to update."}'::jsonb,
    array[1, 3]::smallint[],
    3,
    'valid',
    '[]'::jsonb
  ),
  (
    '31000000-0000-4000-8000-000000000002',
    '21000000-0000-4000-8000-000000000004',
    '11000000-0000-4000-8000-000000000004',
    2,
    '{}'::jsonb,
    '{"q5_comment":"The device finder takes too long to update."}'::jsonb,
    array[1, 3]::smallint[],
    3,
    'valid',
    '[]'::jsonb
  ),
  (
    '31000000-0000-4000-8000-000000000003',
    '21000000-0000-4000-8000-000000000004',
    '11000000-0000-4000-8000-000000000004',
    3,
    '{}'::jsonb,
    '{"q5_comment":"I need a clearer usage-history explanation."}'::jsonb,
    array[5]::smallint[],
    5,
    'valid',
    '[]'::jsonb
  ),
  (
    '31000000-0000-4000-8000-000000000004',
    '21000000-0000-4000-8000-000000000004',
    '11000000-0000-4000-8000-000000000004',
    4,
    '{}'::jsonb,
    '{"q5_comment":"I need clearer session recovery guidance."}'::jsonb,
    array[2, 4]::smallint[],
    4,
    'valid',
    '[]'::jsonb
  );

create temporary table analysis_test_payload (
  payload jsonb not null
) on commit drop;

insert into analysis_test_payload values (
  $$
  {
    "analyses": [
      {
        "response_id": "31000000-0000-4000-8000-000000000001",
        "topic": "performance",
        "user_problem": "The user cannot confirm the latest device location quickly.",
        "sentiment": "negative",
        "product_area": "find_my_glo",
        "confidence": 0.9,
        "uncertainty_reasons": []
      },
      {
        "response_id": "31000000-0000-4000-8000-000000000002",
        "topic": "performance",
        "user_problem": "The user cannot confirm the latest device location quickly.",
        "sentiment": "negative",
        "product_area": "find_my_glo",
        "confidence": 0.9,
        "uncertainty_reasons": []
      },
      {
        "response_id": "31000000-0000-4000-8000-000000000003",
        "topic": "clarity",
        "user_problem": "The user needs a clearer usage-history explanation.",
        "sentiment": "mixed",
        "product_area": "my_usage",
        "confidence": 0.7,
        "uncertainty_reasons": ["The fixture is intentionally repetitive."]
      },
      {
        "response_id": "31000000-0000-4000-8000-000000000004",
        "topic": "clarity",
        "user_problem": "The user lacks clear session recovery guidance.",
        "sentiment": "negative",
        "product_area": "my_session",
        "confidence": 0.8,
        "uncertainty_reasons": []
      }
    ],
    "groups": [
      {
        "group_key": "location_freshness",
        "label": "Slow device-location refresh",
        "summary": "Two synthetic responses report the same refresh delay.",
        "confidence": 0.9,
        "response_ids": [
          "31000000-0000-4000-8000-000000000001",
          "31000000-0000-4000-8000-000000000002"
        ]
      },
      {
        "group_key": "usage_explanation",
        "label": "Unclear usage explanation",
        "summary": "One synthetic response requests clearer usage information.",
        "confidence": 0.7,
        "response_ids": ["31000000-0000-4000-8000-000000000003"]
      },
      {
        "group_key": "session_recovery",
        "label": "Unclear session recovery",
        "summary": "One synthetic response requests recovery guidance.",
        "confidence": 0.8,
        "response_ids": ["31000000-0000-4000-8000-000000000004"]
      }
    ],
    "cards": [
      {
        "group_key": "location_freshness",
        "user_need": "Users need timely confirmation of device location.",
        "potential_solution": "Investigate freshness indicators and manual refresh.",
        "research_questions": ["When does location staleness become disruptive?"],
        "evidence": [{
          "response_id": "31000000-0000-4000-8000-000000000001",
          "text_field": "q5_comment"
        }]
      },
      {
        "group_key": "usage_explanation",
        "user_need": "Users need understandable usage-history explanations.",
        "potential_solution": "Investigate a simpler usage-history explanation.",
        "research_questions": ["Which usage details are hardest to interpret?"],
        "evidence": [{
          "response_id": "31000000-0000-4000-8000-000000000003",
          "text_field": "q5_comment"
        }]
      },
      {
        "group_key": "session_recovery",
        "user_need": "Users need clear session recovery guidance.",
        "potential_solution": "Investigate a guided recovery state.",
        "research_questions": ["Which interruption states create confusion?"],
        "evidence": [{
          "response_id": "31000000-0000-4000-8000-000000000004",
          "text_field": "q5_comment"
        }]
      }
    ]
  }
  $$::jsonb
);

grant select on analysis_test_payload to authenticated;

select plan(10);

select ok(
  not has_table_privilege('authenticated', 'public.response_analyses', 'INSERT'),
  'authenticated clients cannot insert AI analyses directly'
);

set local role authenticated;
set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000004';

select lives_ok(
  $$
    select public.replace_current_import_analysis(
      '21000000-0000-4000-8000-000000000004',
      'gpt-5.6-luna',
      'analysis-test-model',
      (select payload from analysis_test_payload)
    )
  $$,
  'a complete validated payload is saved atomically'
);

select is(
  (select count(*) from public.response_analyses),
  4::bigint,
  'every eligible response has one analysis'
);

select is(
  (select count(*) from public.feedback_groups),
  3::bigint,
  'three groups replace the previous synthetic group'
);

select is(
  (select count(*) from public.opportunity_cards),
  3::bigint,
  'one pending Opportunity Card exists per group'
);

select is(
  (select count(*) from public.opportunity_evidence),
  3::bigint,
  'every card retains a source evidence link'
);

select lives_ok(
  $$
    select public.replace_current_import_analysis(
      '21000000-0000-4000-8000-000000000004',
      'gpt-5.6-luna',
      'analysis-test-model',
      (select payload from analysis_test_payload)
    )
  $$,
  'repeating the same analysis replaces pending drafts without duplication'
);

select is(
  (select count(*) from public.opportunity_cards),
  3::bigint,
  'retry keeps one card per group'
);

select throws_ok(
  $$
    select public.replace_current_import_analysis(
      '21000000-0000-4000-8000-000000000004',
      'gpt-5.6-luna',
      'analysis-test-model',
      jsonb_set(
        (select payload from analysis_test_payload),
        '{analyses}',
        '[]'::jsonb
      )
    )
  $$,
  '22023',
  'analysis_payload_count_mismatch',
  'an incomplete payload is rejected before replacement'
);

select is(
  (select count(*) from public.opportunity_cards),
  3::bigint,
  'a failed replacement leaves the previous complete result intact'
);

select * from finish();

rollback;
